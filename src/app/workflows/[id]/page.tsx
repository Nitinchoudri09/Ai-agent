'use client';

import { useQuery, useMutation } from '@/lib/graphql-hooks';
import { GET_WORKFLOW_DETAILS } from '@/graphql/queries';
import { TRIGGER_WORKFLOW_RUN } from '@/graphql/mutations';
import { useAuth } from '@/lib/auth-context';
import { useParams, useRouter } from 'next/navigation';
import { use, useState } from 'react';
import WorkflowBuilder from '@/components/workflow/WorkflowBuilder';
import LiveRunView from '@/components/runs/LiveRunView';
import { ArrowLeft, Play, Settings } from 'lucide-react';

export default function WorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const { role, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'build' | 'runs'>('build');
  
  const { data, loading, refetch } = useQuery(GET_WORKFLOW_DETAILS, {
    variables: { workflowId: id },
    skip: !id || !isAuthenticated
  });

  const [triggerRun, { loading: isRunning }] = useMutation(TRIGGER_WORKFLOW_RUN, {
    onCompleted: (data: any) => {
      // jump to runs tab
      setActiveTab('runs');
      refetch();
    },
    onError: (err: any) => {
      alert(err.message);
    }
  });

  if (authLoading || loading) return <div className="p-8">Loading...</div>;

  const workflow = (data as any)?.workflows_by_pk;
  if (!workflow) return <div className="p-8">Workflow not found.</div>;

  const canEdit = role === 'owner' || role === 'editor';

  const handleRun = () => {
    if (confirm('Execute this workflow now?')) {
      triggerRun({ variables: { workflowId: id } });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center space-x-4">
          <button onClick={() => router.push('/dashboard')} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{workflow.name}</h1>
            <p className="text-sm text-gray-500">{workflow.description}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="flex bg-gray-100 p-1 rounded-lg mr-4">
            <button 
              onClick={() => setActiveTab('build')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'build' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Builder
            </button>
            <button 
              onClick={() => setActiveTab('runs')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'runs' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Runs
            </button>
          </div>

          {canEdit && (
            <button
              onClick={handleRun}
              disabled={isRunning || workflow.workflow_steps.length === 0}
              className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <Play size={16} />
              <span>{isRunning ? 'Starting...' : 'Run Workflow'}</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto">
          {activeTab === 'build' ? (
            <WorkflowBuilder 
              workflowId={id} 
              steps={workflow.workflow_steps} 
              canEdit={canEdit} 
              role={role}
              refetch={refetch}
            />
          ) : (
            <LiveRunView 
              workflowId={id} 
              runs={workflow.workflow_runs} 
              canEdit={canEdit}
              role={role}
            />
          )}
        </div>
      </div>
    </div>
  );
}
