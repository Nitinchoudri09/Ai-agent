'use client';

import { useState, useEffect } from 'react';
import { useMutation, useSubscription } from '@/lib/graphql-hooks';
import { CREATE_WORKFLOW_STEP, UPDATE_WORKFLOW_STEP, DELETE_WORKFLOW_STEP, APPROVE_STEP } from '@/graphql/mutations';
import { SUBSCRIBE_STEP_RUNS } from '@/graphql/subscriptions';
import { Plus, Trash2, Edit2, Play, Pause, CheckCircle2, XCircle, AlertCircle, HelpCircle, X, ChevronRight } from 'lucide-react';

const STEP_TYPES = [
  { id: 'llm_call', label: 'LLM Call', color: 'border-purple-500 shadow-purple-500/20 text-purple-400', ownerOnly: false },
  { id: 'http_request', label: 'HTTP Request', color: 'border-green-500 shadow-green-500/20 text-green-400', ownerOnly: false },
  { id: 'conditional_branch', label: 'Conditional Branch', color: 'border-blue-500 shadow-blue-500/20 text-blue-400', ownerOnly: false },
  { id: 'approval_gate', label: 'Approval Gate', color: 'border-amber-500 shadow-amber-500/20 text-amber-400', ownerOnly: false },
  { id: 'db_write', label: 'DB Write', color: 'border-emerald-500 shadow-emerald-500/20 text-emerald-400', ownerOnly: true },
  { id: 'notify', label: 'Notify', color: 'border-pink-500 shadow-pink-500/20 text-pink-400', ownerOnly: true },
];

export default function WorkflowCanvas({ workflowId, steps, runs, canEdit, role, refetch }: any) {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(runs?.[0]?.id || null);
  const [editingStep, setEditingStep] = useState<any>(null);
  const [editConfig, setEditConfig] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('llm_call');

  // GraphQL live subscription for step runs
  const { data: subData } = useSubscription(SUBSCRIBE_STEP_RUNS, {
    variables: { runId: selectedRunId },
    skip: !selectedRunId,
  });

  const [updateStep] = useMutation(UPDATE_WORKFLOW_STEP, { onCompleted: () => { setEditingStep(null); refetch(); } });
  const [deleteStep] = useMutation(DELETE_WORKFLOW_STEP, { onCompleted: () => { setEditingStep(null); refetch(); } });
  const [createStep] = useMutation(CREATE_WORKFLOW_STEP, { onCompleted: () => { setShowAdd(false); refetch(); } });
  const [approveStep] = useMutation(APPROVE_STEP);

  const stepRuns = (subData as any)?.step_runs || [];
  const activeRun = runs?.find((r: any) => r.id === selectedRunId);

  // Stagger node positions horizontally and vertically
  const getNodePos = (index: number) => {
    const x = 80 + index * 320;
    const y = index % 2 === 0 ? 120 : 280;
    return { x, y };
  };

  const handleNodeClick = (step: any) => {
    if (!canEdit) return;
    setEditingStep(step);
    setEditConfig(JSON.stringify(step.config, null, 2));
  };

  const handleSaveConfig = () => {
    try {
      const config = JSON.parse(editConfig);
      updateStep({
        variables: {
          id: editingStep.id,
          name: editingStep.name,
          config,
          stepOrder: editingStep.step_order
        }
      });
    } catch {
      alert('Invalid JSON configuration');
    }
  };

  const handleAddStepSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createStep({
      variables: {
        workflowId,
        name: newName,
        type: newType,
        stepOrder: steps.length + 1,
        config: getDefaultConfig(newType)
      }
    });
  };

  const getStepStatus = (stepId: string) => {
    const sr = stepRuns.find((r: any) => r.workflow_step_id === stepId);
    return sr ? sr.status : 'pending';
  };

  return (
    <div className="flex h-[calc(100vh-80px)] bg-slate-950 text-white overflow-hidden relative border-t border-slate-900">
      
      {/* Node Canvas Area */}
      <div className="flex-1 overflow-auto relative p-8 select-none bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] min-w-[2000px] h-full">
        
        {/* SVG connection wires */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          <defs>
            <linearGradient id="neon-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.8" />
            </linearGradient>
          </defs>
          {steps.map((step: any, index: number) => {
            if (index === steps.length - 1) return null;
            const p1 = getNodePos(index);
            const p2 = getNodePos(index + 1);
            
            const startX = p1.x + 240;
            const startY = p1.y + 45;
            const endX = p2.x;
            const endY = p2.y + 45;
            const cpX1 = startX + 80;
            const cpY1 = startY;
            const cpX2 = endX - 80;
            const cpY2 = endY;

            const runStatus = getStepStatus(step.id);
            const activeColor = runStatus === 'completed' ? '#10b981' : runStatus === 'running' ? '#3b82f6' : '#475569';

            return (
              <path
                key={`wire-${step.id}`}
                d={`M ${startX} ${startY} C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${endX} ${endY}`}
                fill="none"
                stroke={activeColor}
                strokeWidth={runStatus === 'running' ? 3 : 2}
                className={runStatus === 'running' ? 'animate-pulse' : ''}
              />
            );
          })}
        </svg>

        {/* Nodes Layer */}
        {steps.map((step: any, index: number) => {
          const { x, y } = getNodePos(index);
          const typeMeta = STEP_TYPES.find(t => t.id === step.type);
          const runStatus = getStepStatus(step.id);
          
          return (
            <div
              key={step.id}
              onClick={() => handleNodeClick(step)}
              style={{ left: x, top: y }}
              className={`absolute w-[240px] bg-slate-900/90 border-2 backdrop-blur-md p-4 rounded-xl shadow-xl z-10 transition-all ${typeMeta?.color || 'border-slate-800'} ${canEdit ? 'cursor-pointer hover:scale-[1.02] hover:border-white' : ''} ${runStatus === 'running' ? 'ring-2 ring-blue-500 animate-pulse' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {typeMeta?.label || step.type}
                </span>
                
                {/* Node Status Icons */}
                {runStatus === 'completed' && <CheckCircle2 className="text-emerald-500" size={14} />}
                {runStatus === 'running' && <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>}
                {runStatus === 'paused' && <Pause className="text-amber-500 animate-bounce" size={14} />}
                {runStatus === 'failed' && <XCircle className="text-red-500" size={14} />}
                {runStatus === 'pending' && <div className="w-2.5 h-2.5 bg-slate-800 border border-slate-700 rounded-full"></div>}
              </div>

              <h4 className="font-bold text-sm text-slate-200 truncate">{step.name}</h4>
              
              <div className="mt-4 flex items-center justify-between text-[11px] text-slate-500">
                <span>Step {index + 1}</span>
                {step.config && (
                  <span className="font-mono text-[9px] bg-slate-950 px-1.5 py-0.5 rounded text-slate-400">
                    JSON Config
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* Add Step canvas node trigger */}
        {canEdit && (
          <div
            style={{ left: 80 + steps.length * 320, top: steps.length % 2 === 0 ? 120 : 280 }}
            onClick={() => setShowAdd(true)}
            className="absolute w-[240px] h-[104px] border-2 border-dashed border-slate-800 hover:border-blue-500 hover:bg-blue-950/10 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all text-slate-500 hover:text-blue-400 z-10"
          >
            <Plus size={24} className="mb-1" />
            <span className="text-xs font-semibold">Add Step</span>
          </div>
        )}
      </div>

      {/* Right Telemetry Side-Panel */}
      <div className="w-[360px] bg-slate-900 border-l border-slate-800 flex flex-col h-full z-20 shadow-2xl">
        <div className="p-6 border-b border-slate-800">
          <h3 className="font-extrabold text-lg tracking-tight mb-4">Run Telemetry</h3>
          
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Select Run</label>
          <select
            className="w-full p-2.5 bg-slate-950 border border-slate-800 text-white rounded-lg outline-none text-sm"
            value={selectedRunId || ''}
            onChange={(e) => setSelectedRunId(e.target.value || null)}
          >
            <option value="">-- No Run Selected --</option>
            {runs?.map((r: any) => (
              <option key={r.id} value={r.id}>
                Run {r.id.slice(0, 8)} ({r.status})
              </option>
            ))}
          </select>
        </div>

        {/* Telemetry statistics details */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {activeRun ? (
            <>
              {/* Status Meter */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm font-semibold">
                  <span className="text-slate-400">Execution Status</span>
                  <span className="capitalize">{activeRun.status}</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all ${activeRun.status === 'completed' ? 'bg-emerald-500' : activeRun.status === 'failed' ? 'bg-red-500' : 'bg-blue-500 animate-pulse'}`}
                    style={{ width: `${activeRun.status === 'completed' ? 100 : activeRun.status === 'failed' ? 50 : 75}%` }}
                  ></div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950 border border-slate-800/80 p-3.5 rounded-xl text-center">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Tokens</div>
                  <div className="text-lg font-extrabold">1,245</div>
                </div>
                <div className="bg-slate-950 border border-slate-800/80 p-3.5 rounded-xl text-center">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Latency</div>
                  <div className="text-lg font-extrabold">982ms</div>
                </div>
              </div>

              {/* Step Logs console */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Console Logs</h4>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-[10px] text-slate-300 max-h-56 overflow-y-auto space-y-1.5">
                  <div>[System] Initializing executor loop...</div>
                  {stepRuns.map((sr: any) => (
                    <div key={`log-${sr.id}`} className="space-y-0.5">
                      <div className="text-blue-400">[{new Date(sr.started_at).toLocaleTimeString()}] Step {sr.workflow_step_id.slice(0, 4)}: {sr.status}</div>
                      {sr.output && <div className="text-emerald-400 pl-4">Output: {JSON.stringify(sr.output)}</div>}
                      {sr.error && <div className="text-red-400 pl-4">Error: {sr.error}</div>}
                      {sr.status === 'paused' && (
                        <div className="bg-amber-950/20 border border-amber-900/50 p-2.5 rounded-lg my-1.5 space-y-2">
                          <div className="text-amber-400">⏸ Execution paused at Approval Gate.</div>
                          {canEdit ? (
                            <button
                              onClick={() => { if(confirm('Approve step?')) approveStep({variables: {stepRunId: sr.id}}) }}
                              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[10px] px-2.5 py-1 rounded"
                            >
                              Approve & Resume Flow
                            </button>
                          ) : (
                            <div className="text-[9px] text-slate-500">Awaiting Owner/Editor authorization</div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-500 text-center py-12">
              Select an active or historical run to view node statistics and live telemetry.
            </div>
          )}
        </div>
      </div>

      {/* Slide-out Edit Config Drawer */}
      {editingStep && (
        <div className="absolute top-0 right-[360px] bottom-0 w-[420px] bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col z-30 animate-in slide-in-from-right duration-200">
          <div className="p-6 border-b border-slate-800 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-white text-base">Configure Step</h3>
              <span className="text-[10px] bg-slate-950 text-slate-400 px-1.5 py-0.5 rounded font-mono mt-1 inline-block uppercase">
                {editingStep.type}
              </span>
            </div>
            <button onClick={() => setEditingStep(null)} className="p-1 hover:bg-slate-800 rounded-full text-slate-400">
              <X size={20} />
            </button>
          </div>
          
          <div className="flex-1 overflow-auto p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Step Name</label>
              <input
                className="w-full p-2.5 bg-slate-950 border border-slate-800 text-white rounded-lg outline-none text-sm"
                value={editingStep.name}
                onChange={(e) => setEditingStep({ ...editingStep, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">JSON Parameters</label>
              <textarea
                className="w-full h-72 p-3 bg-slate-950 border border-slate-800 text-white rounded-lg outline-none font-mono text-xs resize-none"
                value={editConfig}
                onChange={(e) => setEditConfig(e.target.value)}
              />
            </div>
          </div>

          <div className="p-6 border-t border-slate-800 flex justify-between">
            <button
              onClick={() => { if(confirm('Delete this step?')) deleteStep({variables: {id: editingStep.id}}) }}
              className="flex items-center text-red-400 hover:text-red-300 font-semibold text-sm"
            >
              <Trash2 size={16} className="mr-1.5" /> Delete
            </button>
            <button
              onClick={handleSaveConfig}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-4 py-2 rounded-lg"
            >
              Save Configuration
            </button>
          </div>
        </div>
      )}

      {/* Add Step Modal overlay */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-md shadow-2xl text-white">
            <h3 className="text-xl font-bold mb-4">Add Step</h3>
            <form onSubmit={handleAddStepSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Step Name</label>
                <input
                  required
                  autoFocus
                  placeholder="e.g. Call Gemini Model"
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 text-white rounded-lg outline-none text-sm"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Step Type</label>
                <select
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 text-white rounded-lg outline-none text-sm"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                >
                  {STEP_TYPES.map(type => (
                    <option 
                      key={type.id} 
                      value={type.id}
                      disabled={type.ownerOnly && role !== 'owner'}
                    >
                      {type.label} {type.ownerOnly && role !== 'owner' ? '(Owner only)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="px-4 py-2 text-slate-400 hover:bg-slate-800 rounded-lg font-semibold text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700"
                >
                  Add Step
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function getDefaultConfig(type: string) {
  switch (type) {
    case 'llm_call': return { model: 'llama-3.1-8b-instant', system_prompt: 'You are an AI.', prompt: '{{previous_output}}' };
    case 'http_request': return { method: 'GET', url: 'https://api.example.com', headers: {} };
    case 'conditional_branch': return { condition: 'contains', value: 'approved', if_true: 0, if_false: 0 };
    default: return {};
  }
}
