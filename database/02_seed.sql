-- Seed data for AI Agent Workflow Builder

-- Insert Organizations
INSERT INTO organizations (id, name, quota_allowed, quota_used) VALUES
('11111111-1111-1111-1111-111111111111', 'Organization A', 100, 0),
('22222222-2222-2222-2222-222222222222', 'Organization B', 100, 0);

-- Note: The user_id values below should correspond to actual user IDs in Nhost auth.users
-- For demo purposes, we assume these user IDs will be created or mapped later.
-- Owner A: aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa
-- Editor A: aaaaaaaa-2222-2222-2222-aaaaaaaaaaaa
-- Viewer A: aaaaaaaa-3333-3333-3333-aaaaaaaaaaaa
-- Owner B: bbbbbbbb-1111-1111-1111-bbbbbbbbbbbb
-- Editor B: bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb
-- Viewer B: bbbbbbbb-3333-3333-3333-bbbbbbbbbbbb

INSERT INTO org_members (org_id, user_id, role) VALUES
('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa', 'owner'),
('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-2222-2222-2222-aaaaaaaaaaaa', 'editor'),
('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-3333-3333-3333-aaaaaaaaaaaa', 'viewer'),
('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-1111-1111-1111-bbbbbbbbbbbb', 'owner'),
('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb', 'editor'),
('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-3333-3333-3333-bbbbbbbbbbbb', 'viewer');

-- Create Final Demo Workflow in Organization A
INSERT INTO workflows (id, org_id, name, description, created_by) VALUES
('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Demo Approval Workflow', 'A demo workflow with LLM, conditional branch, and approval gate.', 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa');

-- Step 1: LLM Call
INSERT INTO workflow_steps (id, workflow_id, step_order, name, type, config) VALUES
('44444444-1111-1111-1111-444444444444', '33333333-3333-3333-3333-333333333333', 1, 'Generate Approval Text', 'llm_call', '{
  "model": "llama-3.1-8b-instant",
  "system_prompt": "You are a decision engine. Always output exactly APPROVED if the input contains \"yes\", otherwise output REJECTED.",
  "prompt": "Evaluate this: yes"
}');

-- Step 2: HTTP Request
INSERT INTO workflow_steps (id, workflow_id, step_order, name, type, config) VALUES
('44444444-2222-2222-2222-444444444444', '33333333-3333-3333-3333-333333333333', 2, 'Fetch Extra Data', 'http_request', '{
  "method": "GET",
  "url": "https://jsonplaceholder.typicode.com/todos/1",
  "headers": {}
}');

-- Step 3: Conditional Branch
INSERT INTO workflow_steps (id, workflow_id, step_order, name, type, config) VALUES
('44444444-3333-3333-3333-444444444444', '33333333-3333-3333-3333-333333333333', 3, 'Check LLM Result', 'conditional_branch', '{
  "condition": "contains",
  "value": "APPROVED",
  "check_step_id": "44444444-1111-1111-1111-444444444444",
  "if_true": 4,
  "if_false": 5
}');

-- Step 4: Approval Gate (if true)
INSERT INTO workflow_steps (id, workflow_id, step_order, name, type, config) VALUES
('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 4, 'Human Verification', 'approval_gate', '{}');

-- Step 5: Notify / DB Write
INSERT INTO workflow_steps (id, workflow_id, step_order, name, type, config) VALUES
('44444444-5555-5555-5555-444444444444', '33333333-3333-3333-3333-333333333333', 5, 'Save Result', 'db_write', '{}');
