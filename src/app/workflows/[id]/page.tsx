'use client';

import { useQuery, useMutation } from '@/lib/graphql-hooks';
import { GET_WORKFLOW_DETAILS } from '@/graphql/queries';
import { TRIGGER_WORKFLOW_RUN } from '@/graphql/mutations';
import { useAuth } from '@/lib/auth-context';
import { useParams, useRouter } from 'next/navigation';
import { use, useState } from 'react';
import WorkflowCanvas from '@/components/workflow/WorkflowCanvas';
import { ArrowLeft, Play } from 'lucide-react';

export default function WorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const { role, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  
  const { data, loading, refetch } = useQuery(GET_WORKFLOW_DETAILS, {
    variables: { workflowId: id },
    skip: !id || !isAuthenticated
  });

  const [triggerRun, { loading: isRunning }] = useMutation(TRIGGER_WORKFLOW_RUN, {
    onCompleted: (data: any) => {
      refetch();
    },
    onError: (err: any) => {
      alert(err.message);
    }
  });

  if (authLoading || loading) return <div className="p-8 bg-slate-950 text-white min-h-screen">Loading...</div>;

  const workflow = (data as any)?.workflows_by_pk;
  if (!workflow) return <div className="p-8 bg-slate-950 text-white min-h-screen">Workflow not found.</div>;

  const canEdit = role === 'owner' || role === 'editor';

  const handleRun = () => {
    if (confirm('Execute this workflow now?')) {
      triggerRun({ variables: { workflowId: id } });
    }
  };

  return (
    <div className="h-screen bg-slate-950 flex flex-col overflow-hidden text-white">
      {/* Top Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-lg">
        <div className="flex items-center space-x-4">
          <button onClick={() => router.push('/dashboard')} className="p-2 hover:bg-slate-800 rounded-full text-slate-400">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">{workflow.name}</h1>
            <p className="text-xs text-slate-400">{workflow.description || 'Interactive Canvas Designer'}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {canEdit && (
            <button
              onClick={handleRun}
              disabled={isRunning || workflow.workflow_steps.length === 0}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 text-sm shadow-lg shadow-blue-500/20 active:scale-[0.98]"
            >
              <Play size={16} />
              <span>{isRunning ? 'Starting...' : 'Execute Workflow'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Graph Canvas */}
      <div className="flex-1 min-h-0">
        <WorkflowCanvas
          workflowId={id}
          steps={workflow.workflow_steps}
          runs={workflow.workflow_runs}
          canEdit={canEdit}
          role={role}
          refetch={refetch}
        />
      </div>
    </div>
  );
}
