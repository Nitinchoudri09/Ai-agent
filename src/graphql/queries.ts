import { gql } from '@apollo/client';

export const GET_ORGANIZATION_USAGE = gql`
  query GetOrganizationUsage($orgId: uuid!) {
    organization_usage(where: {organization_id: {_eq: $orgId}}) {
      organization_id
      organization_name
      quota_allowed
      quota_used
      remaining_quota
    }
  }
`;

export const GET_WORKFLOWS = gql`
  query GetWorkflows($orgId: uuid!) {
    workflows(where: {org_id: {_eq: $orgId}}, order_by: {created_at: desc}) {
      id
      name
      description
      created_at
      workflow_runs(order_by: {created_at: desc}, limit: 1) {
        id
        status
        created_at
      }
    }
  }
`;

export const GET_WORKFLOW_DETAILS = gql`
  query GetWorkflowDetails($workflowId: uuid!) {
    workflows_by_pk(id: $workflowId) {
      id
      name
      description
      org_id
      workflow_steps(order_by: {step_order: asc}) {
        id
        name
        type
        step_order
        config
      }
      workflow_triggers {
        id
        trigger_type
        enabled
        config
      }
      workflow_runs(order_by: {created_at: desc}, limit: 10) {
        id
        status
        started_at
        completed_at
        error
      }
    }
  }
`;
