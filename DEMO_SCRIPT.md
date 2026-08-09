# AI Agent Workflow Builder Demo Script

This script outlines the flow for the 3-7 minute recording demonstration of the multi-tenant AI workflow builder.

## 1. Initial Setup & Login (0:00 - 1:00)
1. Navigate to the deployed Render url `/login`.
2. Demonstrate toggling between "Cloud Mode (Nhost)" and "Offline Sandbox Mode" using the link at the bottom.
3. Switch to **Offline Sandbox Mode** to simulate the local execution sandbox.
4. Log in as **Owner A** (`owner-a@example.com`).
5. Show the **Dashboard**: Highlight Organization A, the owner role, and the current quota (e.g. `12 / 100`).

## 2. Design the Workflow Canvas (1:00 - 2:30)
1. Open the demo workflow on the dashboard.
2. Show the visual node editor (canvas mode):
   * Node 1: **Webhook** (Trigger)
   * Node 2: **LLM Call** (configured with Groq/Gemini prompt template)
   * Node 3: **HTTP Request** (firing outward API calls)
   * Node 4: **Conditional Branch** (branching based on previous LLM output text)
   * Node 5: **Approval Gate** (which pauses execution)
   * Node 6: **Notify** (Slack webhook)
3. Demonstrate adding a new step and dragging the node. Show that clicking a node opens the configuration panel to edit parameters.

## 3. Execute the Workflow & Live Updates (2:30 - 4:00)
1. Click the **Execute Workflow** button.
2. Observe the real-time execution in the canvas:
   * The LLM node lights up with a blue loading glow (`running`) and transitions to completed.
   * The HTTP Request node runs, retries if failed, and completes.
   * The Conditional Branch evaluates the text response, routes execution, and skips alternative steps (marked as `skipped`).
   * The Approval Gate is reached: The node turns yellow and status updates to `PAUSED — WAITING FOR APPROVAL`.
3. In the right panel, observe the live console logs and the status meter.

## 4. Approval Gate Resume (4:00 - 5:00)
1. Under the owner console, click the **Approve & Resume Flow** button in the telemetry side-panel.
2. Observe that the execution resumes and proceeds to the final **Notify** node.
3. The workflow finishes, updating the run status to `completed` and incrementing the quota usage.

## 5. Security & Isolation Testing (5:00 - 6:30)
1. Log out.
2. Log in as **Editor B** (`editor-b@example.com`).
3. Show that Organization B's dashboard is completely isolated; it does not list Organization A's workflows.
4. Try to navigate directly to Organization A's workflow UUID. Show that the page displays `"Access Denied / Workflow not found"` or redirects, proving RLS bounds.
5. Demonstrate attempting to trigger a workflow run or approve a step belonging to Org A by direct GraphQL mutation, resulting in an authorization error.
