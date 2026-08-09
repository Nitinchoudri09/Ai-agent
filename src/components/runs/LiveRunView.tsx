'use client';

import { useSubscription, useMutation } from '@/lib/graphql-hooks';
import { SUBSCRIBE_STEP_RUNS } from '@/graphql/subscriptions';
import { APPROVE_STEP } from '@/graphql/mutations';
import { Play, Pause, CheckCircle2, XCircle, AlertCircle, HelpCircle } from 'lucide-react';
import { useState } from 'react';

export default function LiveRunView({ workflowId, runs, canEdit, role }: any) {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(
    runs?.[0]?.id || null
  );

  const { data, loading, error } = useSubscription(SUBSCRIBE_STEP_RUNS, {
    variables: { runId: selectedRunId },
    skip: !selectedRunId,
  });

  const [approveStep, { loading: isApproving }] = useMutation(APPROVE_STEP, {
    onCompleted: () => {
      alert('Resuming workflow...');
    },
    onError: (err: any) => {
      alert(err.message);
    }
  });

  const activeRun = runs?.find((r: any) => r.id === selectedRunId);
  const stepRuns = (data as any)?.step_runs || [];

  const handleApprove = (stepRunId: string) => {
    if (confirm('Approve this step to resume execution?')) {
      approveStep({ variables: { stepRunId } });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="text-green-500" size={20} />;
      case 'running': return <Play className="text-blue-500 animate-pulse" size={20} />;
      case 'paused': return <Pause className="text-yellow-500" size={20} />;
      case 'failed': return <XCircle className="text-red-500" size={20} />;
      case 'skipped': return <HelpCircle className="text-gray-400" size={20} />;
      default: return <AlertCircle className="text-gray-300" size={20} />;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* Run List */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Run History</h2>
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {runs?.map((run: any) => (
            <div
              key={run.id}
              onClick={() => setSelectedRunId(run.id)}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedRunId === run.id ? 'border-blue-500 bg-blue-50/30' : 'border-gray-100 hover:border-gray-200 bg-white'}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm truncate max-w-[150px]">{run.id}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize 
                  ${run.status === 'completed' ? 'bg-green-100 text-green-700' :
                    run.status === 'running' ? 'bg-blue-100 text-blue-700' :
                    run.status === 'failed' ? 'bg-red-100 text-red-700' :
                    run.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'}`}>
                  {run.status}
                </span>
              </div>
              <div className="text-xs text-gray-400 mt-2">
                {new Date(run.started_at || run.created_at).toLocaleString()}
              </div>
            </div>
          ))}
          {!runs || runs.length === 0 && (
            <div className="text-sm text-gray-500 text-center py-6">No runs recorded yet.</div>
          )}
        </div>
      </div>

      {/* Live execution view */}
      <div className="md:col-span-2 space-y-6">
        {selectedRunId ? (
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Run Details</h2>
                <p className="text-xs text-gray-400 mt-0.5">ID: {selectedRunId}</p>
              </div>
              {activeRun?.status === 'paused' && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-2 rounded-xl flex items-center space-x-2 text-sm font-medium">
                  <Pause size={16} />
                  <span>⏸ Waiting for approval</span>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {stepRuns.map((sr: any) => (
                <div key={sr.id} className="flex items-start space-x-4 p-4 rounded-xl border border-gray-50 bg-gray-50/20">
                  <div className="mt-1">{getStatusIcon(sr.status)}</div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-gray-800">Step Run {sr.id.slice(0, 8)}</span>
                      <span className="text-xs text-gray-400 capitalize">{sr.status}</span>
                    </div>

                    {sr.output && (
                      <div className="text-xs font-mono bg-white p-3 rounded-lg border border-gray-100 max-h-48 overflow-y-auto">
                        <strong>Output:</strong>
                        <pre className="mt-1">{JSON.stringify(sr.output, null, 2)}</pre>
                      </div>
                    )}

                    {sr.error && (
                      <div className="text-xs font-mono bg-red-50 text-red-600 p-3 rounded-lg border border-red-100">
                        <strong>Error:</strong>
                        <pre className="mt-1">{sr.error}</pre>
                      </div>
                    )}

                    {sr.status === 'paused' && (
                      <div className="pt-2">
                        {canEdit ? (
                          <button
                            onClick={() => handleApprove(sr.id)}
                            disabled={isApproving}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-3 py-1.5 rounded-lg transition-colors"
                          >
                            {isApproving ? 'Approving...' : 'Approve Step'}
                          </button>
                        ) : (
                          <span className="text-xs text-yellow-600 font-medium">Waiting for owner/editor approval</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {stepRuns.length === 0 && (
                <div className="text-sm text-gray-500 text-center py-12">
                  {loading ? 'Subscribing to run updates...' : 'No steps executed in this run yet.'}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white p-12 rounded-2xl border border-gray-200 shadow-sm text-center text-gray-500">
            Select a run from the history to view details.
          </div>
        )}
      </div>
    </div>
  );
}
