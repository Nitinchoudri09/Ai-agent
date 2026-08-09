import { Request, Response } from 'express';
import { graphqlClient } from '../_utils/graphql';
import { executeStep } from '../_utils/executor';

export default async function handler(req: Request, res: Response) {
  try {
    // Hasura Actions send data in req.body.input
    const { workflow_id } = req.body.input || {};
    // Hasura session variables are in req.body.session_variables
    const sessionVars = req.body.session_variables || {};
    const userId = sessionVars['x-hasura-user-id'];

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Step 2 & 3: Find workflow and organization
    const workflowQuery = `
      query GetWorkflow($id: uuid!) {
        workflows_by_pk(id: $id) {
          id
          org_id
          organization {
            quota_allowed
            quota_used
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
    `;

    const wfData = await graphqlClient(workflowQuery, { id: workflow_id });
    const workflow = wfData.workflows_by_pk;

    if (!workflow) {
      return res.status(404).json({ message: 'Workflow not found' });
    }

    // Step 4: Verify user belongs to org and role is owner or editor
    const members = workflow.organization?.org_members || [];
    if (members.length === 0) {
      return res.status(403).json({ message: 'User does not belong to this organization' });
    }
    const role = members[0].role;
    if (role !== 'owner' && role !== 'editor') {
      return res.status(403).json({ message: 'Insufficient permissions. Must be owner or editor.' });
    }

    // Step 5: Check quota
    if (workflow.organization.quota_used >= workflow.organization.quota_allowed) {
      return res.status(403).json({ message: 'Organization quota exceeded' });
    }

    // Step 6: Create workflow_run
    const initRunMutation = `
      mutation InitRun($workflowId: uuid!, $userId: uuid!) {
        insert_workflow_runs_one(object: {
          workflow_id: $workflowId,
          status: "running",
          created_by: $userId,
          trigger_type: "manual"
        }) {
          id
        }
      }
    `;
    const runData = await graphqlClient(initRunMutation, { workflowId: workflow_id, userId });
    const runId = runData.insert_workflow_runs_one.id;

    // Fast-return to Hasura so the client isn't blocked forever, but since this is an action, 
    // Hasura expects a synchronous response if we don't use async actions.
    // For simplicity, we'll respond now and process asynchronously.
    res.status(200).json({ run_id: runId, status: 'started' });

    // Step 7 & 8: Execute each step sequentially
    // We execute in background so we don't timeout the HTTP request.
    executeWorkflow(runId, workflow.workflow_steps).catch(console.error);

  } catch (error: any) {
    console.error(error);
    return res.status(400).json({ message: error.message || 'Error triggering workflow' });
  }
}

async function executeWorkflow(runId: string, steps: any[]) {
  let previousOutput = null;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    
    // Create step run
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

    // Execute
    const context = {
      workflowRunId: runId,
      stepRunId: stepRunId,
      previousOutput: previousOutput,
      env: process.env as any
    };

    const result = await executeStep(step, context);

    // Update step run
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
      return; // Stop execution
    }

    if (result.status === 'paused') {
      await updateWorkflowRunStatus(runId, 'paused');
      return; // Stop execution, will be resumed by approveStep
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
