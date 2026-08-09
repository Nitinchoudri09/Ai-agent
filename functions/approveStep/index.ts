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
      query GetStepRun($id: uuid!) {
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
              organization {
                org_members(where: {user_id: {_eq: "${userId}"}}) {
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

    const data = await graphqlClient(query, { id: step_run_id });
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
      mutation Approve($id: uuid!, $userId: uuid!) {
        update_step_runs_by_pk(pk_columns: {id: $id}, _set: {
          status: "completed",
          approved_by: $userId,
          approved_at: "now()"
        }) {
          id
        }
        update_workflow_runs_by_pk(pk_columns: {id: "${workflowRun.id}"}, _set: {
          status: "running"
        }) {
          id
        }
      }
    `, { id: step_run_id, userId });

    res.status(200).json({ run_id: workflowRun.id, status: 'resumed' });

    // Resume execution
    resumeWorkflow(workflowRun.id, workflow.workflow_steps, stepRun.workflow_step.id).catch(console.error);

  } catch (error: any) {
    console.error(error);
    return res.status(400).json({ message: error.message || 'Error approving step' });
  }
}

async function resumeWorkflow(runId: string, steps: any[], approvedStepId: string) {
  // Find index of approved step
  const startIndex = steps.findIndex(s => s.id === approvedStepId) + 1;
  let previousOutput = null;

  // We should ideally fetch the previous output from the DB if needed by next step,
  // For simplicity, we'll fetch the approved step's input to carry forward if it exists.
  const stepData = await graphqlClient(`
    query GetOutput($id: uuid!) {
      step_runs(where: {workflow_step_id: {_eq: $id}, workflow_run_id: {_eq: "${runId}"}}) {
        input
      }
    }
  `, { id: approvedStepId });
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
      env: process.env as any
    };

    const result = await executeStep(step, context);

    const updateStepMutation = `
      mutation UpdateStep($id: uuid!, $status: String!, $output: jsonb, $error: String) {
        update_step_runs_by_pk(pk_columns: {id: $id}, _set: {
          status: $status,
          output: $output,
          error: $error,
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
      error: result.error || null
    });

    if (result.status === 'failed') {
      await updateWorkflowRunStatus(runId, 'failed', result.error);
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

  // Completed all steps
  await updateWorkflowRunStatus(runId, 'completed');
  
  // Increment quota
  await graphqlClient(`
    mutation IncrementQuota($runId: uuid!) {
      update_organizations(
        where: {workflows: {workflow_runs: {id: {_eq: $runId}}}},
        _inc: {quota_used: 1}
      ) {
        affected_rows
      }
    }
  `, { runId });
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
