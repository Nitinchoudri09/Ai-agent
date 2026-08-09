'use client';

import { useState, useEffect } from 'react';
import { useSignInEmailPassword, useSignUpEmailPassword } from '@/lib/nhost-hooks';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const { signInEmailPassword, isLoading: isSignInLoading, error: signInError } = useSignInEmailPassword();
  const { signUpEmailPassword, isLoading: isSignUpLoading, error: signUpError } = useSignUpEmailPassword();

  const [isMockMode, setIsMockMode] = useState(true);

  useEffect(() => {
    const active = localStorage.getItem('mock_mode_active') === 'true' || 
                   !process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || 
                   process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN === 'local';
    setIsMockMode(active);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isMockMode) {
      let mockUserId = email; // Use email as the mock user ID to keep it unique
      
      // Seed the database if not done
      const members = JSON.parse(localStorage.getItem('org_members') || '[]');
      const exists = members.some((m: any) => m.user_id === mockUserId);
      
      if (!exists) {
        // Map role based on email context
        let role = 'owner';
        let orgId = '11111111-1111-1111-1111-111111111111'; // Org A
        
        if (email.includes('editor')) {
          role = 'editor';
        } else if (email.includes('viewer')) {
          role = 'viewer';
        } else if (email.includes('owner') && email.includes('b')) {
          role = 'owner';
          orgId = '22222222-2222-2222-2222-222222222222'; // Org B
        }
        
        members.push({ org_id: orgId, user_id: mockUserId, role });
        localStorage.setItem('org_members', JSON.stringify(members));
      }
      
      localStorage.setItem('mock_user', JSON.stringify({ id: mockUserId, email }));
      router.push('/dashboard');
      setTimeout(() => window.location.reload(), 100);
      return;
    }

    if (isLogin) {
      const { isSuccess } = await signInEmailPassword(email, password);
      if (isSuccess) router.push('/dashboard');
    } else {
      const { isSuccess } = await signUpEmailPassword(email, password);
      if (isSuccess) router.push('/dashboard');
    }
  };

  const isLoading = !isMockMode && (isSignInLoading || isSignUpLoading);
  const error = isMockMode ? null : (isLogin ? signInError : signUpError);

  return (
    <div className="flex min-h-screen bg-gray-900 text-white">
      {/* Graphic Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-12 bg-gradient-to-br from-indigo-950 via-slate-900 to-black border-r border-slate-800">
        <div className="max-w-xl text-center space-y-6">
          <h2 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            AI Agent Workflow Builder
          </h2>
          <p className="text-slate-400">
            Design, deploy, and monitor complex multi-agent chains with real-time feedback loops.
          </p>
          <div className="border border-slate-800 rounded-xl overflow-hidden shadow-2xl shadow-indigo-500/10">
            <img 
              src="/workflow_builder_ui_mockup.jpg" 
              alt="Workflow Builder Preview" 
              className="w-full object-cover select-none"
            />
          </div>
        </div>
      </div>

      {/* Input Right Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-slate-950">
        <div className="w-full max-w-md bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl">
          <h1 className="text-3xl font-extrabold text-center text-white mb-2">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="text-slate-500 text-center text-sm mb-8">
            {isLogin ? 'Sign in to access your dashboard' : 'Sign up to build your first agent chain'}
          </p>

          {error && (
            <div className="bg-red-950/50 border border-red-900 text-red-400 p-4 rounded-lg mb-6 text-sm space-y-3">
              <div>{error.message}</div>
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem('mock_mode_active', 'true');
                  window.location.reload();
                }}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-1.5 px-3 rounded-md transition-all text-xs"
              >
                Switch to Offline Sandbox Mode (No backend required)
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 border border-slate-800 bg-slate-950 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder-slate-600"
                placeholder="e.g. owner-a@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 border border-slate-800 bg-slate-950 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder-slate-600"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/25 active:scale-[0.98]"
            >
              {isLoading ? 'Processing...' : isLogin ? 'Sign In' : 'Sign Up'}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-400">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-blue-400 hover:text-blue-300 font-semibold"
            >
              {isLogin ? 'Sign Up' : 'Sign In'}
            </button>
          </p>

          <div className="mt-6 pt-6 border-t border-slate-800 text-center">
            <button
              type="button"
              onClick={() => {
                const active = localStorage.getItem('mock_mode_active') === 'true';
                localStorage.setItem('mock_mode_active', active ? 'false' : 'true');
                window.location.reload();
              }}
              className="text-xs font-semibold text-amber-500 hover:text-amber-400 transition-colors"
            >
              {isMockMode ? "☁️ Switch to Live Nhost Mode" : "🖥️ Switch to Offline Sandbox Mode"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
