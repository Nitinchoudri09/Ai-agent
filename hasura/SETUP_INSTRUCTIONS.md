# Hasura Setup & Permissions Guide

Since Nhost is being used, you will need to configure Hasura using the Nhost Dashboard -> Hasura Console.

## 1. Track Tables and Views
After running `01_schema.sql` in the SQL tab:
1. Go to **Data -> public**.
2. Click **Track All** for Tables and Views to track `organizations`, `org_members`, `workflows`, etc., and the `organization_usage` view.

## 2. Track Relationships
Hasura will automatically suggest relationships based on foreign keys. Go to **Data -> Schema -> public** and track all suggested foreign key relationships. Ensure the following names are generated (rename them in the Hasura console if necessary to match the GraphQL queries):
- `organization` -> `org_members` (Array relationship: `organization.org_members`)
- `organization` -> `workflows` (Array relationship: `organization.workflows`)
- `workflow` -> `workflow_steps` (Array relationship: `workflow.workflow_steps`)
- `workflow` -> `workflow_triggers` (Array relationship: `workflow.workflow_triggers`)
- `workflow` -> `workflow_runs` (Array relationship: `workflow.workflow_runs`)
- `workflow_run` -> `step_runs` (Array relationship: `workflow_run.step_runs`)

## 3. Configure Row-Level Security (RLS) Permissions

You need to define permissions for three roles: `user` (default authenticated user). We will use a two-layer approach where the Hasura permission checks the `org_members` table.

For every table, you will configure the `user` role.

### Table: `organizations`
- **Select**: Custom Check: `{"org_members": {"user_id": {"_eq": "X-Hasura-User-Id"}}}`. (Can read if member). Columns: All.

### Table: `org_members`
- **Select**: Custom Check: `{"user_id": {"_eq": "X-Hasura-User-Id"}}`. Columns: All.
- **Insert/Update/Delete**: Custom Check: `{"organization": {"org_members": {"user_id": {"_eq": "X-Hasura-User-Id"}, "role": {"_eq": "owner"}}}}`. (Only owners can manage members).

### Table: `workflows`
- **Select**: Custom Check: `{"organization": {"org_members": {"user_id": {"_eq": "X-Hasura-User-Id"}}}}`. Columns: All.
- **Insert/Update/Delete**: Custom Check: `{"organization": {"org_members": {"user_id": {"_eq": "X-Hasura-User-Id"}, "role": {"_in": ["owner", "editor"]}}}}`. 

### Table: `workflow_steps` & `workflow_triggers`
- **Select**: Custom Check: `{"workflow": {"organization": {"org_members": {"user_id": {"_eq": "X-Hasura-User-Id"}}}}}`. Columns: All.
- **Insert/Update/Delete**: Custom Check: `{"workflow": {"organization": {"org_members": {"user_id": {"_eq": "X-Hasura-User-Id"}, "role": {"_in": ["owner", "editor"]}}}}}`. 
*(Note: Step-level restrictions like db_write being owner-only are enforced via Hasura Actions / custom backend checks during save or execution).*

### Table: `workflow_runs` & `step_runs`
- **Select**: Custom Check: `{"workflow": {"organization": {"org_members": {"user_id": {"_eq": "X-Hasura-User-Id"}}}}}`. Columns: All.
- **Insert/Update/Delete**: Managed mostly by backend serverless functions (Hasura Actions) using the `admin` secret. However, we might grant Insert to users for manual runs, but our plan uses a Hasura Action (`triggerWorkflowRun`) instead, so no insert permissions are strictly needed here for the `user` role.

### View: `organization_usage`
- **Select**: Custom Check: `{"organization": {"org_members": {"user_id": {"_eq": "X-Hasura-User-Id"}}}}`. Columns: All.

## 4. Define Hasura Actions

Go to **Actions** -> **Create**.

### Action: `triggerWorkflowRun`
- **Action Definition**:
```graphql
type Mutation {
  triggerWorkflowRun(workflow_id: uuid!): TriggerRunOutput
}
```
- **New types**:
```graphql
type TriggerRunOutput {
  run_id : uuid!
  status : String!
}
```
- **Handler**: `https://<YOUR-NHOST-PROJECT-ID>.functions.nhost.run/v1/triggerWorkflowRun` (or local equivalent). Forward client headers.

### Action: `approveStep`
- **Action Definition**:
```graphql
type Mutation {
  approveStep(step_run_id: uuid!): ApproveStepOutput
}
```
- **New types**:
```graphql
type ApproveStepOutput {
  run_id : uuid!
  status : String!
}
```
- **Handler**: `https://<YOUR-NHOST-PROJECT-ID>.functions.nhost.run/v1/approveStep`. Forward client headers.
