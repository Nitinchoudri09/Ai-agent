import { gql } from '@apollo/client';

export const SUBSCRIBE_WORKFLOW_RUN = gql`
  subscription SubscribeWorkflowRun($runId: uuid!) {
    workflow_runs_by_pk(id: $runId) {
      id
      status
      started_at
      completed_at
      error
    }
  }
`;

export const SUBSCRIBE_STEP_RUNS = gql`
  subscription StepRunSubscription($runId: uuid!) {
    step_runs(
      where: {
        workflow_run_id: {_eq: $runId}
      }
      order_by: {
        created_at: asc
      }
    ) {
      id
      workflow_run_id
      workflow_step_id
      status
      input
      output
      error
      attempt_count
      approved_by
      approved_at
      started_at
      completed_at
    }
  }
`;
