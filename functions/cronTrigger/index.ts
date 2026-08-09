import { Request, Response } from 'express';
import { graphqlClient } from '../_utils/graphql';
import { executeStep } from '../_utils/executor';

export default async function handler(req: Request, res: Response) {
  try {
    const authHeader = req.headers.authorization;
    if (process.env.WEBHOOK_SECRET && authHeader !== `Bearer ${process.env.WEBHOOK_SECRET}`) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const query = `
      query GetScheduledTriggers {
        workflow_triggers(where: {trigger_type: {_eq: "scheduled"}, enabled: {_eq: true}}) {
          id
          workflow_id
          config
        }
      }
    `;

    const data = await graphqlClient(query, {});
    const triggers = data.workflow_triggers || [];

    const triggeredRuns = [];

    for (const trigger of triggers) {
      // Reserve quota atomically
      try {
        const wfDetails = await graphqlClient(`
          query GetWfDetails($id: uuid!) {
            workflows_by_pk(id: $id) {
              org_id
            }
          }
        `, { id: trigger.workflow_id });
        const orgId = wfDetails.workflows_by_pk?.org_id;

        if (orgId) {
          const reserveResult = await graphqlClient(`
            mutation ReserveQuota($orgId: uuid!) {
              update_organizations_by_pk(
                pk_columns: { id: $orgId },
                _inc: { quota_used: 1 }
              ) {
                id
                quota_used
                quota_allowed
              }
            }
          `, { orgId });

          const org = reserveResult.update_organizations_by_pk;
          if (!org || org.quota_used > org.quota_allowed) {
            await graphqlClient(`
              mutation RollbackQuota($orgId: uuid!) {
                update_organizations_by_pk(pk_columns: { id: $orgId }, _inc: { quota_used: -1 }) { id }
              }
            `, { orgId });
            console.warn(`Quota exceeded for Org ${orgId}. Skipping scheduled run.`);
            continue;
          }
        }
      } catch (err) {
        console.error('Error reserving quota for scheduled trigger:', err);
        continue;
      }

      // Create workflow run
      const initRunMutation = `
        mutation InitRun($workflowId: uuid!) {
          insert_workflow_runs_one(object: {
            workflow_id: $workflowId,
            status: "running",
            trigger_type: "scheduled"
          }) {
            id
            workflow {
              org_id
              workflow_steps(order_by: {step_order: asc}) {
                id
                name
                type
                config
                step_order
              }
            }
          }
        }
      `;
      const runData = await graphqlClient(initRunMutation, { workflowId: trigger.workflow_id });
      const run = runData.insert_workflow_runs_one;
      const runId = run.id;
      
      triggeredRuns.push({ workflowId: trigger.workflow_id, runId });

      // Run execution loop in background
      executeWorkflow(runId, run.workflow.org_id, run.workflow.workflow_steps).catch(console.error);
    }

    res.status(200).json({ success: true, triggersProcessed: triggers.length, triggeredRuns });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}

async function rollbackQuota(orgId: string) {
  await graphqlClient(`
    mutation RollbackQuota($orgId: uuid!) {
      update_organizations_by_pk(
        pk_columns: { id: $orgId },
        _inc: { quota_used: -1 }
      ) {
        id
      }
    }
  `, { orgId });
}

async function executeWorkflow(runId: string, orgId: string, steps: any[]) {
  let previousOutput = null;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    
    const initStepMutation = `
      mutation InitStep($runId: uuid!, $stepId: uuid!, $input: jsonb!) {
        insert_step_runs_one(object: {
          workflow_run_id: $runId,
          workflow_step_id: $stepId,
          status: "running",
          started_at: "now()",
          input: $input
        }) {
          id
        }
      }
    `;
    const stepRunData = await graphqlClient(initStepMutation, { 
      runId, 
      stepId: step.id, 
      input: { previous_output: previousOutput } 
    });
    const stepRunId = stepRunData.insert_step_runs_one.id;

    const context = {
      workflowRunId: runId,
      stepRunId: stepRunId,
      previousOutput: previousOutput,
      env: process.env as any,
      onAttempt: async (attempt: number) => {
        await graphqlClient(`
          mutation UpdateAttempt($id: uuid!, $attempt: Int!) {
            update_step_runs_by_pk(pk_columns: {id: $id}, _set: {attempt_count: $attempt}) {
              id
            }
          }
        `, { id: stepRunId, attempt });
      }
    };

    const result = await executeStep(step, context);

    const updateStepMutation = `
      mutation UpdateStep($id: uuid!, $status: String!, $output: jsonb, $error: String, $attempts: Int!) {
        update_step_runs_by_pk(pk_columns: {id: $id}, _set: {
          status: $status,
          output: $output,
          error: $error,
          attempt_count: $attempts,
          completed_at: "now()"
        }) {
          id
        }
      }
    `;
    await graphqlClient(updateStepMutation, {
      id: stepRunId,
      status: result.status,
      output: result.output || null,
      error: result.error || null,
      attempts: result.attempts || 1
    });

    if (result.status === 'failed') {
      await updateWorkflowRunStatus(runId, 'failed', result.error);
      await rollbackQuota(orgId);
      return;
    }

    if (result.status === 'paused') {
      await updateWorkflowRunStatus(runId, 'paused');
      return; 
    }

    if (result.output) {
      previousOutput = result.output;
    }
  }

  await updateWorkflowRunStatus(runId, 'completed');
}

async function updateWorkflowRunStatus(runId: string, status: string, error?: string) {
  await graphqlClient(`
    mutation UpdateRun($id: uuid!, $status: String!, $error: String) {
      update_workflow_runs_by_pk(pk_columns: {id: $id}, _set: {
        status: $status,
        error: $error,
        completed_at: "now()"
      }) {
        id
      }
    }
  `, { id: runId, status, error: error || null });
}
