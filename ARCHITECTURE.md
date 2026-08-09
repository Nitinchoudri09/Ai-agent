# System Architecture - AI Agent Workflow Builder

## 1. Schema Reasoning
The database is structured to separate configuration (static workflows, steps, and triggers) from execution (dynamic workflow runs, step runs, and outputs). Foreign key references with cascade deletes guarantee referential integrity and simple cleanup.

## 2. Organization Isolation & Permissions
Tenant isolation is enforced in two layers:
- **Layer 1 (Hasura Row-Level Security)**: Queries and mutations are guarded by checking membership via the `org_members` table matching the user's `X-Hasura-User-Id`.
- **Layer 2 (Step-Level / Role Authorization)**: Enforced inside Hasura Actions (`triggerWorkflowRun` and `approveStep`) and step mutation checks, preventing `editor` and `viewer` roles from adding restricted step types (`db_write`, `notify`) or running workflows belonging to other organizations. We enforce approval validation in the Action to prevent spoofed state updates via direct DB mutations.

## 3. Action Handlers & Executor Loop
- **triggerWorkflowRun**: Authenticates the user, checks organization quota usage, creates a run tracking entry, and begins sequential step execution in a background Promise loop to avoid HTTP timeout.
- **executeStep**: A modular engine mapping step configurations to their specific executors:
  - `llm_call`: Performs the LLM API request (or invokes stub delay mode).
  - `http_request`: Fires outward HTTP calls.
  - `conditional_branch`: Analyzes JSON outputs against rules to evaluate the branch pointer.
  - `approval_gate`: Pauses loop execution, setting run state to `paused`.
- **approveStep**: Resumes the executor loop from the indexed step following the approved gate.

## 4. Real-time Subscriptions
Live UI updates are driven by Hasura GraphQL subscriptions targeting `step_runs` filtered by `workflow_run_id`. This updates the frontend state in real-time as steps progress.
