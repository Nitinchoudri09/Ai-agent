'use client';

import * as nhostNext from '@nhost/nextjs';
import { useState, useEffect } from 'react';

const isMockMode = !process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN === 'local';

export function useAuthenticationStatus() {
  const [auth, setAuth] = useState({ isAuthenticated: false, isLoading: true });

  // Call real hooks inside if not mock mode
  // Since we cannot run hooks conditionally, we have to run them, but we catch exceptions 
  // or return static values in mock mode.
  // Wait, to satisfy the rules of hooks, we MUST run them in both paths, OR we can implement 
  // our own provider that mocks them.
  // Actually, we can run them, but if isMockMode is true, we just ignore their values and don't let 
  // their fetch logic block our state.
  
  // Real hook call:
  const realAuth = nhostNext.useAuthenticationStatus();

  useEffect(() => {
    if (isMockMode) {
      const isAuth = typeof window !== 'undefined' ? !!localStorage.getItem('mock_user') : false;
      setAuth({ isAuthenticated: isAuth, isLoading: false });
    } else {
      setAuth({ isAuthenticated: realAuth.isAuthenticated, isLoading: realAuth.isLoading });
    }
  }, [realAuth.isAuthenticated, realAuth.isLoading]);

  return auth;
}

export function useUserData() {
  const realUser = nhostNext.useUserData();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    if (isMockMode) {
      const u = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('mock_user') || 'null') : null;
      setUser(u);
    } else {
      setUser(realUser);
    }
  }, [realUser]);

  return user;
}

export function useSignInEmailPassword() {
  const real = nhostNext.useSignInEmailPassword();
  if (isMockMode) {
    return {
      signInEmailPassword: async () => ({ isSuccess: true, error: null }),
      isLoading: false,
      error: null
    };
  }
  return real;
}

export function useSignUpEmailPassword() {
  const real = nhostNext.useSignUpEmailPassword();
  if (isMockMode) {
    return {
      signUpEmailPassword: async () => ({ isSuccess: true, error: null }),
      isLoading: false,
      error: null
    };
  }
  return real;
}
