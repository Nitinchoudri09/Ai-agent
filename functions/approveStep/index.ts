import { Request, Response } from 'express';
import { graphqlClient } from '../_utils/graphql';
import { executeStep } from '../_utils/executor';

export default async function handler(req: Request, res: Response) {
  try {
    const { step_run_id } = req.body.input || {};
    const sessionVars = req.body.session_variables || {};
    const userId = sessionVars['x-hasura-user-id'];

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Find step_run and all relations
    const query = `
      query GetStepRun($id: uuid!, $userId: uuid!) {
        step_runs_by_pk(id: $id) {
          id
          status
          workflow_step {
            type
          }
          workflow_run {
            id
            status
            workflow {
              id
              org_id
              organization {
                org_members(where: {user_id: {_eq: $userId}}) {
                  role
                }
              }
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
      }
    `;

    const data = await graphqlClient(query, { id: step_run_id, userId });
    const stepRun = data.step_runs_by_pk;

    if (!stepRun) return res.status(404).json({ message: 'Step run not found' });
    
    const workflowRun = stepRun.workflow_run;
    const workflow = workflowRun.workflow;
    const members = workflow.organization?.org_members || [];

    if (members.length === 0) return res.status(403).json({ message: 'User not in org' });
    const role = members[0].role;
    if (role !== 'owner' && role !== 'editor') return res.status(403).json({ message: 'Unauthorized role' });

    if (stepRun.workflow_step.type !== 'approval_gate') return res.status(400).json({ message: 'Not an approval gate' });
    if (stepRun.status !== 'paused' || workflowRun.status !== 'paused') return res.status(400).json({ message: 'Run is not paused' });

    // Mark approved
    await graphqlClient(`
      mutation Approve($id: uuid!, $userId: uuid!, $runId: uuid!) {
        update_step_runs_by_pk(pk_columns: {id: $id}, _set: {
          status: "completed",
          approved_by: $userId,
          approved_at: "now()"
        }) {
          id
        }
        update_workflow_runs_by_pk(pk_columns: {id: $runId}, _set: {
          status: "running"
        }) {
          id
        }
      }
    `, { id: step_run_id, userId, runId: workflowRun.id });

    res.status(200).json({ run_id: workflowRun.id, status: 'resumed' });

    resumeWorkflow(workflowRun.id, workflow.org_id, workflow.workflow_steps, stepRun.workflow_step.id).catch(console.error);

  } catch (error: any) {
    console.error(error);
    return res.status(400).json({ message: error.message || 'Error approving step' });
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

async function resumeWorkflow(runId: string, orgId: string, steps: any[], approvedStepId: string) {
  const startIndex = steps.findIndex(s => s.id === approvedStepId) + 1;
  let previousOutput = null;

  const stepData = await graphqlClient(`
    query GetOutput($id: uuid!, $runId: uuid!) {
      step_runs(where: {workflow_step_id: {_eq: $id}, workflow_run_id: {_eq: $runId}}) {
        input
      }
    }
  `, { id: approvedStepId, runId });
  previousOutput = stepData.step_runs[0]?.input?.previous_output;

  for (let i = startIndex; i < steps.length; i++) {
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
      await rollbackQuota(orgId); // Release quota on failure
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
