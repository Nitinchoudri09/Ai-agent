'use client';

import * as apollo from '@apollo/client/react';
import { useState, useEffect } from 'react';

const isMockMode = typeof window !== 'undefined'
  ? (localStorage.getItem('mock_mode_active') === 'true' || !process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN === 'local')
  : (!process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN === 'local');

function mockUUID() {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Setup local storage mock database if not exists
if (typeof window !== 'undefined' && !localStorage.getItem('mock_db_initialized')) {
  localStorage.setItem('mock_db_initialized', 'true');
  localStorage.setItem('organizations', JSON.stringify([
    { id: '11111111-1111-1111-1111-111111111111', name: 'Organization A', quota_allowed: 100, quota_used: 0 },
    { id: '22222222-2222-2222-2222-222222222222', name: 'Organization B', quota_allowed: 100, quota_used: 0 }
  ]));
  localStorage.setItem('org_members', JSON.stringify([
    { org_id: '11111111-1111-1111-1111-111111111111', user_id: 'mock-user-owner-a-id', role: 'owner' },
    { org_id: '11111111-1111-1111-1111-111111111111', user_id: 'mock-user-editor-a-id', role: 'editor' },
    { org_id: '11111111-1111-1111-1111-111111111111', user_id: 'mock-user-viewer-a-id', role: 'viewer' },
    { org_id: '22222222-2222-2222-2222-222222222222', user_id: 'mock-user-owner-b-id', role: 'owner' }
  ]));
  localStorage.setItem('workflows', JSON.stringify([
    {
      id: '33333333-3333-3333-3333-333333333333',
      org_id: '11111111-1111-1111-1111-111111111111',
      name: 'Demo Approval Workflow',
      description: 'A demo workflow with LLM, conditional branch, and approval gate.',
      created_at: new Date().toISOString()
    }
  ]));
  localStorage.setItem('workflow_steps', JSON.stringify([
    {
      id: '44444444-1111-1111-1111-444444444444',
      workflow_id: '33333333-3333-3333-3333-333333333333',
      step_order: 1,
      name: 'Generate Approval Text',
      type: 'llm_call',
      config: {
        model: 'llama-3.1-8b-instant',
        system_prompt: 'You are a decision engine. Always output APPROVED if the input contains "yes", otherwise output REJECTED.',
        prompt: 'Evaluate this: yes'
      }
    },
    {
      id: '44444444-2222-2222-2222-444444444444',
      workflow_id: '33333333-3333-3333-3333-333333333333',
      step_order: 2,
      name: 'Fetch Extra Data',
      type: 'http_request',
      config: {
        method: 'GET',
        url: 'https://jsonplaceholder.typicode.com/todos/1',
        headers: {}
      }
    },
    {
      id: '44444444-3333-3333-3333-444444444444',
      workflow_id: '33333333-3333-3333-3333-333333333333',
      step_order: 3,
      name: 'Check LLM Result',
      type: 'conditional_branch',
      config: {
        condition: 'contains',
        value: 'APPROVED',
        check_step_id: '44444444-1111-1111-1111-444444444444',
        if_true: 4,
        if_false: 5
      }
    },
    {
      id: '44444444-4444-4444-4444-444444444444',
      workflow_id: '33333333-3333-3333-3333-333333333333',
      step_order: 4,
      name: 'Human Verification',
      type: 'approval_gate',
      config: {}
    },
    {
      id: '44444444-5555-5555-5555-444444444444',
      workflow_id: '33333333-3333-3333-3333-333333333333',
      step_order: 5,
      name: 'Save Result',
      type: 'db_write',
      config: {}
    }
  ]));
  localStorage.setItem('workflow_runs', JSON.stringify([]));
  localStorage.setItem('step_runs', JSON.stringify([]));
}

function getLocalStorageItem(key: string, fallback: any = []) {
  if (typeof window === 'undefined') return fallback;
  const item = localStorage.getItem(key);
  return item ? JSON.parse(item) : fallback;
}

function setLocalStorageItem(key: string, data: any) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
}

export function useQuery(query: any, options: any = {}): any {
  if (!isMockMode) {
    return apollo.useQuery(query, options);
  }

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { variables, skip } = options;

  const refetch = () => {
    if (skip) return;
    setLoading(true);
    
    // Simulate API fetch delay
    setTimeout(() => {
      const queryStr = query.loc.source.body;
      let result: any = {};

      if (queryStr.includes('GetUserOrg')) {
        const members = getLocalStorageItem('org_members');
        const orgs = getLocalStorageItem('organizations');
        const userMember = members.find((m: any) => m.user_id === variables.userId) || members[0];
        const org = orgs.find((o: any) => o.id === userMember?.org_id);
        result = {
          org_members: userMember ? [{
            org_id: userMember.org_id,
            role: userMember.role,
            organization: { name: org?.name }
          }] : []
        };
      } 
      else if (queryStr.includes('GetOrganizationUsage')) {
        const orgs = getLocalStorageItem('organizations');
        const org = orgs.find((o: any) => o.id === variables.orgId);
        result = {
          organization_usage: org ? [{
            organization_id: org.id,
            organization_name: org.name,
            quota_allowed: org.quota_allowed,
            quota_used: org.quota_used,
            remaining_quota: org.quota_allowed - org.quota_used
          }] : []
        };
      }
      else if (queryStr.includes('GetWorkflows')) {
        const workflows = getLocalStorageItem('workflows').filter((w: any) => w.org_id === variables.orgId);
        const runs = getLocalStorageItem('workflow_runs');
        result = {
          workflows: workflows.map((w: any) => {
            const wRuns = runs.filter((r: any) => r.workflow_id === w.id);
            return {
              ...w,
              workflow_runs: wRuns.length > 0 ? [wRuns[wRuns.length - 1]] : []
            };
          })
        };
      }
      else if (queryStr.includes('GetWorkflowDetails')) {
        const wf = getLocalStorageItem('workflows').find((w: any) => w.id === variables.workflowId);
        const steps = getLocalStorageItem('workflow_steps').filter((s: any) => s.workflow_id === variables.workflowId);
        const runs = getLocalStorageItem('workflow_runs').filter((r: any) => r.workflow_id === variables.workflowId);
        result = {
          workflows_by_pk: wf ? {
            ...wf,
            workflow_steps: steps,
            workflow_runs: runs
          } : null
        };
      }

      setData(result);
      setLoading(false);
    }, 100);
  };

  useEffect(() => {
    refetch();
  }, [variables?.userId, variables?.orgId, variables?.workflowId, skip]);

  return { data, loading, error: null, refetch };
}

export function useMutation(mutation: any, options: any = {}): any {
  if (!isMockMode) {
    return apollo.useMutation(mutation, options);
  }

  const [loading, setLoading] = useState(false);

  const mutate = async (mutateOptions: any = {}) => {
    setLoading(true);
    const variables = { ...options.variables, ...mutateOptions.variables };
    const mutationStr = mutation.loc.source.body;
    let result: any = {};

    await new Promise(resolve => setTimeout(resolve, 300)); // simulate delay

    if (mutationStr.includes('CreateWorkflow')) {
      const workflows = getLocalStorageItem('workflows');
      const newWf = {
        id: mockUUID(),
        org_id: variables.orgId,
        name: variables.name,
        description: variables.description,
        created_at: new Date().toISOString()
      };
      workflows.push(newWf);
      setLocalStorageItem('workflows', workflows);
      result = { insert_workflows_one: { id: newWf.id } };
    }
    else if (mutationStr.includes('CreateWorkflowStep')) {
      const steps = getLocalStorageItem('workflow_steps');
      const newStep = {
        id: mockUUID(),
        workflow_id: variables.workflowId,
        step_order: variables.stepOrder,
        name: variables.name,
        type: variables.type,
        config: variables.config
      };
      steps.push(newStep);
      setLocalStorageItem('workflow_steps', steps);
      result = { insert_workflow_steps_one: { id: newStep.id } };
    }
    else if (mutationStr.includes('DeleteWorkflowStep')) {
      let steps = getLocalStorageItem('workflow_steps');
      steps = steps.filter((s: any) => s.id !== variables.id);
      setLocalStorageItem('workflow_steps', steps);
      result = { delete_workflow_steps_by_pk: { id: variables.id } };
    }
    else if (mutationStr.includes('TriggerWorkflowRun')) {
      // Mock execute the entire workflow
      const runs = getLocalStorageItem('workflow_runs');
      const runId = mockUUID();
      const newRun = {
        id: runId,
        workflow_id: variables.workflowId,
        status: 'running',
        created_at: new Date().toISOString()
      };
      runs.push(newRun);
      setLocalStorageItem('workflow_runs', runs);

      // Trigger asynchronous execution simulation
      setTimeout(() => simulateExecution(newRun.id, variables.workflowId), 100);

      result = { triggerWorkflowRun: { run_id: runId, status: 'running' } };
    }
    else if (mutationStr.includes('ApproveStep')) {
      // Resume run
      const stepRuns = getLocalStorageItem('step_runs');
      const stepRun = stepRuns.find((sr: any) => sr.id === variables.stepRunId);
      if (stepRun) {
        stepRun.status = 'completed';
        stepRun.completed_at = new Date().toISOString();
        setLocalStorageItem('step_runs', stepRuns);

        const runs = getLocalStorageItem('workflow_runs');
        const run = runs.find((r: any) => r.id === stepRun.workflow_run_id);
        if (run) {
          run.status = 'running';
          setLocalStorageItem('workflow_runs', runs);
          
          // Resume workflow run execution
          setTimeout(() => resumeSimulation(run.id, stepRun.workflow_step_id), 100);
        }
      }
      result = { approveStep: { run_id: stepRun?.workflow_run_id, status: 'resumed' } };
    }

    setLoading(false);
    if (options.onCompleted) {
      options.onCompleted(result);
    }
    return { data: result };
  };

  return [mutate, { loading, error: null }];
}

export function useSubscription(subscription: any, options: any = {}): any {
  if (!isMockMode) {
    return apollo.useSubscription(subscription, options);
  }

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { variables, skip } = options;

  useEffect(() => {
    if (skip || !variables?.runId) return;

    const interval = setInterval(() => {
      const stepRuns = getLocalStorageItem('step_runs').filter(
        (sr: any) => sr.workflow_run_id === variables.runId
      );
      setData({ step_runs: stepRuns });
      setLoading(false);
    }, 500);

    return () => clearInterval(interval);
  }, [variables?.runId, skip]);

  return { data, loading, error: null };
}

// SIMULATION ENGINE FOR MOCK RUNS
async function simulateExecution(runId: string, workflowId: string) {
  const steps = getLocalStorageItem('workflow_steps')
    .filter((s: any) => s.workflow_id === workflowId)
    .sort((a: any, b: any) => a.step_order - b.step_order);

  let previousOutput = "Initial Output";

  for (const step of steps) {
    const stepRuns = getLocalStorageItem('step_runs');
    const stepRunId = mockUUID();
    const newStepRun = {
      id: stepRunId,
      workflow_run_id: runId,
      workflow_step_id: step.id,
      status: 'running',
      input: { previous_output: previousOutput },
      output: null,
      error: null,
      started_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    stepRuns.push(newStepRun);
    setLocalStorageItem('step_runs', stepRuns);

    await new Promise(r => setTimeout(r, 1500)); // simulate work

    const updatedStepRuns = getLocalStorageItem('step_runs');
    const currentRun = updatedStepRuns.find((sr: any) => sr.id === stepRunId);

    if (step.type === 'approval_gate') {
      currentRun.status = 'paused';
      setLocalStorageItem('step_runs', updatedStepRuns);
      
      const runs = getLocalStorageItem('workflow_runs');
      const run = runs.find((r: any) => r.id === runId);
      if (run) {
        run.status = 'paused';
        setLocalStorageItem('workflow_runs', runs);
      }
      return; // Stop simulation here. Resumed via approveStep mutation
    }

    // Default Success execution for mock
    currentRun.status = 'completed';
    currentRun.completed_at = new Date().toISOString();
    
    if (step.type === 'llm_call') {
      currentRun.output = { response: "APPROVED" };
      previousOutput = "APPROVED";
    } else if (step.type === 'http_request') {
      currentRun.output = { response: { userId: 1, id: 1, title: "delectus aut autem", completed: false } };
      previousOutput = currentRun.output;
    } else if (step.type === 'conditional_branch') {
      currentRun.output = { result: true };
      previousOutput = currentRun.output;
    } else {
      currentRun.output = { success: true };
      previousOutput = currentRun.output;
    }
    
    setLocalStorageItem('step_runs', updatedStepRuns);
  }

  // Complete Run
  const runs = getLocalStorageItem('workflow_runs');
  const run = runs.find((r: any) => r.id === runId);
  if (run) {
    run.status = 'completed';
    setLocalStorageItem('workflow_runs', runs);
  }
}

async function resumeSimulation(runId: string, approvedStepId: string) {
  const steps = getLocalStorageItem('workflow_steps');
  const stepRuns = getLocalStorageItem('step_runs');

  const approvedStep = steps.find((s: any) => s.id === approvedStepId);
  if (!approvedStep) return;

  const remainingSteps = steps
    .filter((s: any) => s.workflow_id === approvedStep.workflow_id && s.step_order > approvedStep.step_order)
    .sort((a: any, b: any) => a.step_order - b.step_order);

  let previousOutput = "APPROVED"; // from gate/llm

  for (const step of remainingSteps) {
    const freshStepRuns = getLocalStorageItem('step_runs');
    const stepRunId = mockUUID();
    const newStepRun = {
      id: stepRunId,
      workflow_run_id: runId,
      workflow_step_id: step.id,
      status: 'running',
      input: { previous_output: previousOutput },
      output: null,
      error: null,
      started_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    freshStepRuns.push(newStepRun);
    setLocalStorageItem('step_runs', freshStepRuns);

    await new Promise(r => setTimeout(r, 1500));

    const updatedStepRuns = getLocalStorageItem('step_runs');
    const currentRun = updatedStepRuns.find((sr: any) => sr.id === stepRunId);
    currentRun.status = 'completed';
    currentRun.completed_at = new Date().toISOString();
    currentRun.output = { success: true };
    previousOutput = currentRun.output;
    setLocalStorageItem('step_runs', updatedStepRuns);
  }

  const runs = getLocalStorageItem('workflow_runs');
  const run = runs.find((r: any) => r.id === runId);
  if (run) {
    run.status = 'completed';
    setLocalStorageItem('workflow_runs', runs);
  }
}
