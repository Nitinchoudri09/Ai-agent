import { gql } from '@apollo/client';

export const CREATE_WORKFLOW = gql`
  mutation CreateWorkflow($orgId: uuid!, $name: String!, $description: String!) {
    insert_workflows_one(object: {
      org_id: $orgId, 
      name: $name, 
      description: $description
    }) {
      id
    }
  }
`;

export const UPDATE_WORKFLOW = gql`
  mutation UpdateWorkflow($id: uuid!, $name: String!, $description: String!) {
    update_workflows_by_pk(pk_columns: {id: $id}, _set: {name: $name, description: $description}) {
      id
    }
  }
`;

export const DELETE_WORKFLOW = gql`
  mutation DeleteWorkflow($id: uuid!) {
    delete_workflows_by_pk(id: $id) {
      id
    }
  }
`;

export const CREATE_WORKFLOW_STEP = gql`
  mutation CreateWorkflowStep(
    $workflowId: uuid!, 
    $name: String!, 
    $type: String!, 
    $stepOrder: Int!, 
    $config: jsonb!
  ) {
    insert_workflow_steps_one(object: {
      workflow_id: $workflowId,
      name: $name,
      type: $type,
      step_order: $stepOrder,
      config: $config
    }) {
      id
    }
  }
`;

export const UPDATE_WORKFLOW_STEP = gql`
  mutation UpdateWorkflowStep($id: uuid!, $name: String!, $config: jsonb!, $stepOrder: Int!) {
    update_workflow_steps_by_pk(
      pk_columns: {id: $id},
      _set: {name: $name, config: $config, step_order: $stepOrder}
    ) {
      id
    }
  }
`;

export const DELETE_WORKFLOW_STEP = gql`
  mutation DeleteWorkflowStep($id: uuid!) {
    delete_workflow_steps_by_pk(id: $id) {
      id
    }
  }
`;

export const TRIGGER_WORKFLOW_RUN = gql`
  mutation TriggerWorkflowRun($workflowId: uuid!) {
    triggerWorkflowRun(workflow_id: $workflowId) {
      run_id
      status
    }
  }
`;

export const APPROVE_STEP = gql`
  mutation ApproveStep($stepRunId: uuid!) {
    approveStep(step_run_id: $stepRunId) {
      run_id
      status
    }
  }
`;
