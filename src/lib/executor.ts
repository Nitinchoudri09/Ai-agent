export interface StepConfig {
  type: string;
  config: any;
}

export interface StepRunContext {
  workflowRunId: string;
  stepRunId: string;
  previousOutput: any;
  env: Record<string, string>;
}

export async function executeStep(step: StepConfig, context: StepRunContext): Promise<{status: string, output?: any, error?: string, nextStepIndex?: number}> {
  switch (step.type) {
    case 'llm_call':
      return await executeLlmCall(step.config, context);
    case 'http_request':
      return await executeHttpRequest(step.config, context);
    case 'conditional_branch':
      return executeConditionalBranch(step.config, context);
    case 'approval_gate':
      return { status: 'paused', output: { message: 'Waiting for approval' } };
    case 'db_write':
      return await executeDbWrite(step.config, context);
    case 'notify':
      return await executeNotify(step.config, context);
    default:
      return { status: 'failed', error: `Unknown step type: ${step.type}` };
  }
}

async function executeLlmCall(config: any, context: StepRunContext) {
  try {
    const prompt = config.prompt?.replace('{{previous_output}}', JSON.stringify(context.previousOutput || ''));
    
    // Stub mode if no API key
    if (!process.env.LLM_API_KEY) {
      await new Promise(resolve => setTimeout(resolve, 1500)); // simulate delay
      let response = "STUB_RESPONSE";
      if (prompt?.toLowerCase().includes('yes')) {
         response = "APPROVED";
      } else if (prompt?.toLowerCase().includes('no')) {
         response = "REJECTED";
      }
      return { status: 'completed', output: { response } };
    }

    // Example real call (simplified)
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.LLM_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model || 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: config.system_prompt || 'You are a helpful assistant.' },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!res.ok) {
      throw new Error(`LLM API Error: ${res.statusText}`);
    }
    const data = await res.json();
    return { status: 'completed', output: { response: data.choices[0].message.content } };
  } catch (error: any) {
    return { status: 'failed', error: error.message };
  }
}

async function executeHttpRequest(config: any, context: StepRunContext) {
  try {
    const url = config.url?.replace('{{previous_output}}', typeof context.previousOutput === 'string' ? context.previousOutput : '');
    
    const res = await fetch(url, {
      method: config.method || 'GET',
      headers: config.headers || {},
      body: ['GET', 'HEAD'].includes(config.method?.toUpperCase()) ? undefined : JSON.stringify(config.body)
    });

    const contentType = res.headers.get('content-type');
    let data;
    if (contentType && contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }

    if (!res.ok) {
      return { status: 'failed', error: `HTTP ${res.status}: ${JSON.stringify(data)}` };
    }

    return { status: 'completed', output: { response: data } };
  } catch (error: any) {
    return { status: 'failed', error: error.message };
  }
}

function executeConditionalBranch(config: any, context: StepRunContext) {
  const previousValue = JSON.stringify(context.previousOutput || '');
  const conditionValue = config.value || '';
  
  let result = false;
  switch(config.condition) {
    case 'contains':
      result = previousValue.includes(conditionValue);
      break;
    case 'equals':
      result = previousValue === conditionValue;
      break;
    default:
      result = false;
  }

  // nextStepIndex is purely illustrative here; 
  // the actual engine loop needs to interpret 'if_true' and 'if_false' as the next step order/ID.
  return { 
    status: 'completed', 
    output: { result, evaluatedCondition: config.condition },
    nextStepIndex: result ? config.if_true : config.if_false 
  };
}

async function executeDbWrite(config: any, context: StepRunContext) {
  // In a real Nhost function, we'd use the GraphQL admin client to write to workflow_outputs.
  // We'll return output that the main runner can persist.
  return { status: 'completed', output: { db_write: 'success', data_to_write: context.previousOutput } };
}

async function executeNotify(config: any, context: StepRunContext) {
  if (!process.env.SLACK_WEBHOOK_URL) {
    // Stub
    console.log('STUB NOTIFY:', context.previousOutput);
    return { status: 'completed', output: { notify: 'stub_success' } };
  }
  
  try {
    await fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      body: JSON.stringify({ text: `Workflow Notification:\n${JSON.stringify(context.previousOutput)}` })
    });
    return { status: 'completed', output: { notify: 'success' } };
  } catch (err: any) {
    return { status: 'failed', error: err.message };
  }
}
