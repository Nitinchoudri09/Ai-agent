'use client';

import { useState } from 'react';
import { useMutation } from '@/lib/graphql-hooks';
import { CREATE_WORKFLOW_STEP, UPDATE_WORKFLOW_STEP, DELETE_WORKFLOW_STEP } from '@/graphql/mutations';
import { Plus, Trash2, Edit2, GripVertical, Check, X } from 'lucide-react';

const STEP_TYPES = [
  { id: 'llm_call', label: 'LLM Call', ownerOnly: false },
  { id: 'http_request', label: 'HTTP Request', ownerOnly: false },
  { id: 'conditional_branch', label: 'Conditional Branch', ownerOnly: false },
  { id: 'approval_gate', label: 'Approval Gate', ownerOnly: false },
  { id: 'db_write', label: 'DB Write', ownerOnly: true },
  { id: 'notify', label: 'Notify', ownerOnly: true },
];

export default function WorkflowBuilder({ workflowId, steps, canEdit, role, refetch }: any) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Add state
  const [newType, setNewType] = useState('llm_call');
  const [newName, setNewName] = useState('');
  
  // Edit state
  const [editConfig, setEditConfig] = useState('');

  const [createStep] = useMutation(CREATE_WORKFLOW_STEP, { onCompleted: () => { setShowAdd(false); refetch(); } });
  const [updateStep] = useMutation(UPDATE_WORKFLOW_STEP, { onCompleted: () => { setEditingId(null); refetch(); } });
  const [deleteStep] = useMutation(DELETE_WORKFLOW_STEP, { onCompleted: () => refetch() });

  const handleAdd = (e: React.FormEvent) => {
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

  const startEdit = (step: any) => {
    setEditingId(step.id);
    setEditConfig(JSON.stringify(step.config, null, 2));
  };

  const saveEdit = (step: any) => {
    try {
      const parsed = JSON.parse(editConfig);
      updateStep({
        variables: {
          id: step.id,
          name: step.name, // could allow editing name too
          config: parsed,
          stepOrder: step.step_order
        }
      });
    } catch (e) {
      alert("Invalid JSON config");
    }
  };

  return (
    <div className="space-y-6">
      {steps.map((step: any, index: number) => (
        <div key={step.id} className="relative flex items-start group">
          {/* Connector Line */}
          {index !== steps.length - 1 && (
            <div className="absolute left-6 top-14 bottom-[-24px] w-0.5 bg-gray-200"></div>
          )}
          
          <div className="flex-shrink-0 w-12 h-12 bg-white rounded-full border-2 border-blue-500 flex items-center justify-center font-bold text-blue-600 shadow-sm z-10">
            {index + 1}
          </div>
          
          <div className="ml-6 flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all hover:border-blue-300">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h3 className="font-bold text-gray-900">{step.name}</h3>
                <span className="text-xs font-medium px-2 py-1 bg-gray-200 text-gray-700 rounded-md mt-1 inline-block">
                  {STEP_TYPES.find(t => t.id === step.type)?.label || step.type}
                </span>
              </div>
              
              {canEdit && (
                <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(step)} className="p-2 text-gray-400 hover:text-blue-600 rounded-md hover:bg-blue-50">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => { if(confirm('Delete step?')) deleteStep({variables: {id: step.id}}) }} className="p-2 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50">
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
            
            {editingId === step.id ? (
              <div className="p-4 bg-gray-50 border-t border-gray-100">
                <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Configuration (JSON)</label>
                <textarea
                  className="w-full h-48 p-3 font-mono text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  value={editConfig}
                  onChange={(e) => setEditConfig(e.target.value)}
                />
                <div className="mt-3 flex justify-end space-x-2">
                  <button onClick={() => setEditingId(null)} className="px-3 py-1.5 flex items-center text-sm text-gray-600 hover:bg-gray-200 rounded-md">
                    <X size={14} className="mr-1" /> Cancel
                  </button>
                  <button onClick={() => saveEdit(step)} className="px-3 py-1.5 flex items-center text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-md">
                    <Check size={14} className="mr-1" /> Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6">
                <pre className="text-xs text-gray-600 bg-gray-50 p-4 rounded-lg overflow-x-auto border border-gray-100">
                  {JSON.stringify(step.config, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      ))}

      {canEdit && !showAdd && (
        <div className="pt-4 pl-18">
          <button 
            onClick={() => setShowAdd(true)}
            className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 font-medium px-4 py-2 border-2 border-dashed border-blue-200 hover:border-blue-400 rounded-xl transition-colors bg-blue-50/50 hover:bg-blue-50"
          >
            <Plus size={20} />
            <span>Add Step</span>
          </button>
        </div>
      )}

      {showAdd && (
        <div className="ml-18 bg-white border border-gray-200 rounded-xl p-6 shadow-lg shadow-gray-200/50 text-gray-900">
          <h3 className="font-bold text-gray-900 mb-4">Add New Step</h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Step Name</label>
              <input
                required
                className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Analyze Sentiment"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Step Type</label>
              <select
                className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
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
              {STEP_TYPES.find(t => t.id === newType)?.ownerOnly && (
                <p className="text-xs text-amber-600 mt-1">This step type requires Owner privileges.</p>
              )}
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
              >
                Add Step
              </button>
            </div>
          </form>
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
