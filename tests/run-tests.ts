import { executeStep } from '../src/lib/executor';

async function runTests() {
  console.log("=== STARTING WORKFLOW ENGINE TEST SUITE ===");

  // Test 1: LLM Call Stub execution
  console.log("\n[Test 1] Executing LLM Call (Stub mode)...");
  const llmResult = await executeStep(
    { type: 'llm_call', config: { prompt: 'Verify output: yes' } },
    { workflowRunId: 'run-1', stepRunId: 'step-1', previousOutput: null, env: {} }
  );
  console.log("Status:", llmResult.status);
  console.log("Output:", llmResult.output);
  console.log("Attempts:", llmResult.attempts);
  if (llmResult.status === 'completed' && llmResult.output?.response === 'APPROVED') {
    console.log("✅ Test 1 Passed!");
  } else {
    console.log("❌ Test 1 Failed!");
  }

  // Test 2: Conditional Branching (if_true / if_false matching)
  console.log("\n[Test 2] Evaluating Conditional Branching...");
  const condResult = await executeStep(
    { type: 'conditional_branch', config: { condition: 'contains', value: 'APPROVED', if_true: 4, if_false: 5 } },
    { workflowRunId: 'run-1', stepRunId: 'step-2', previousOutput: { response: 'APPROVED' }, env: {} }
  );
  console.log("Status:", condResult.status);
  console.log("Next step index:", condResult.nextStepIndex);
  if (condResult.nextStepIndex === 4) {
    console.log("✅ Test 2 Passed!");
  } else {
    console.log("❌ Test 2 Failed!");
  }

  // Test 3: HTTP retry behavior on failure (simulated via invalid URL)
  console.log("\n[Test 3] Testing HTTP Call Retry Loop (Failure case)...");
  let attemptsMade = 0;
  const httpResult = await executeStep(
    { type: 'http_request', config: { url: 'https://invalid-domain-name-does-not-exist.xyz' } },
    { 
      workflowRunId: 'run-1', 
      stepRunId: 'step-3', 
      previousOutput: null, 
      env: {},
      onAttempt: async (count) => {
        attemptsMade = count;
        console.log(`  -> Attempt ${count} callback triggered...`);
      }
    }
  );
  console.log("Status:", httpResult.status);
  console.log("Error:", httpResult.error);
  console.log("Callback Attempts Registered:", attemptsMade);
  if (httpResult.status === 'failed' && attemptsMade === 2) {
    console.log("✅ Test 3 Passed! (Correctly retried at least once)");
  } else {
    console.log("❌ Test 3 Failed!");
  }

  console.log("\n=== TEST SUITE COMPLETED ===");
}

runTests().catch(console.error);
