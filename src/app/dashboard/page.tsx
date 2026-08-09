'use client';

import { useAuth } from '@/lib/auth-context';
import { useQuery, useMutation } from '@/lib/graphql-hooks';
import { GET_ORGANIZATION_USAGE, GET_WORKFLOWS } from '@/graphql/queries';
import { CREATE_WORKFLOW } from '@/graphql/mutations';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Dashboard() {
  const { isAuthenticated, isLoading: authLoading, organizationId, organizationName, role } = useAuth();
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [newWfName, setNewWfName] = useState('');
  const [newWfDesc, setNewWfDesc] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  const { data: usageData } = useQuery(GET_ORGANIZATION_USAGE, {
    variables: { orgId: organizationId },
    skip: !organizationId
  });

  const { data: wfData, refetch: refetchWf } = useQuery(GET_WORKFLOWS, {
    variables: { orgId: organizationId },
    skip: !organizationId
  });

  const [createWorkflow] = useMutation(CREATE_WORKFLOW, {
    onCompleted: (data: any) => {
      setShowCreate(false);
      refetchWf();
      router.push(`/workflows/${data.insert_workflows_one.id}`);
    }
  });

  if (authLoading || !isAuthenticated) return <div className="p-8">Loading...</div>;

  const usage = (usageData as any)?.organization_usage?.[0];
  const workflows = (wfData as any)?.workflows || [];
  const canEdit = role === 'owner' || role === 'editor';

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newWfName) {
      createWorkflow({ variables: { orgId: organizationId, name: newWfName, description: newWfDesc } });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{organizationName || 'Organization'} Dashboard</h1>
            <p className="text-gray-500 mt-1">Logged in as <span className="font-semibold text-gray-700 capitalize">{role}</span></p>
          </div>
          
          {usage && (
            <div className="text-right">
              <div className="text-sm text-gray-500 mb-1">Quota Usage</div>
              <div className="text-2xl font-bold text-gray-900">
                {usage.quota_used} / {usage.quota_allowed}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full" 
                  style={{ width: `${Math.min(100, (usage.quota_used / usage.quota_allowed) * 100)}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Workflows */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Workflows</h2>
            {canEdit && (
              <button 
                onClick={() => setShowCreate(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                + New Workflow
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workflows.map((wf: any) => (
              <div 
                key={wf.id} 
                onClick={() => router.push(`/workflows/${wf.id}`)}
                className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md hover:border-blue-100 transition-all"
              >
                <h3 className="font-bold text-lg text-gray-900 mb-2">{wf.name}</h3>
                <p className="text-gray-500 text-sm mb-4 line-clamp-2">{wf.description || 'No description'}</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">
                    {new Date(wf.created_at).toLocaleDateString()}
                  </span>
                  {wf.workflow_runs?.[0] && (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium 
                      ${wf.workflow_runs[0].status === 'completed' ? 'bg-green-100 text-green-700' : 
                      wf.workflow_runs[0].status === 'running' ? 'bg-blue-100 text-blue-700' : 
                      wf.workflow_runs[0].status === 'failed' ? 'bg-red-100 text-red-700' : 
                      'bg-yellow-100 text-yellow-700'}`}>
                      {wf.workflow_runs[0].status}
                    </span>
                  )}
                </div>
              </div>
            ))}
            
            {workflows.length === 0 && (
              <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-dashed border-gray-300">
                <p className="text-gray-500">No workflows found. Create your first one!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md text-gray-900 shadow-xl border border-gray-100">
            <h3 className="text-xl font-bold mb-4 text-gray-900">Create Workflow</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  required
                  autoFocus
                  className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  value={newWfName}
                  onChange={(e) => setNewWfName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none h-24 text-gray-900 bg-white"
                  value={newWfDesc}
                  onChange={(e) => setNewWfDesc(e.target.value)}
                />
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
