'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuthenticationStatus, useUserData } from '@/lib/nhost-hooks';
import { useQuery } from '@/lib/graphql-hooks';
import { gql } from '@apollo/client/core';

const isMockMode = typeof window !== 'undefined'
  ? (localStorage.getItem('mock_mode_active') === 'true' || !process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN === 'local')
  : (!process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN === 'local');

type Role = 'owner' | 'editor' | 'viewer' | null;

interface AuthContextType {
  user: any;
  isAuthenticated: boolean;
  isLoading: boolean;
  organizationId: string | null;
  organizationName: string | null;
  role: Role;
  setOrganizationId: (id: string | null) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  organizationId: null,
  organizationName: null,
  role: null,
  setOrganizationId: () => {},
});

const GET_USER_ORG = gql`
  query GetUserOrg($userId: uuid!) {
    org_members(where: {user_id: {_eq: $userId}}, limit: 1) {
      org_id
      role
      organization {
        name
      }
    }
  }
`;

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuthenticationStatus();
  const user = useUserData();

  const [organizationId, setOrganizationId] = useState<string | null>(null);
  
  const { data, loading: isOrgLoading } = useQuery(GET_USER_ORG, {
    variables: { userId: user?.id },
    skip: !isAuthenticated || !user?.id,
  });

  const member = (data as any)?.org_members?.[0];
  const role = member?.role || null;
  const orgName = member?.organization?.name || null;

  useEffect(() => {
    if (member?.org_id && !organizationId) {
      setOrganizationId(member.org_id);
    }
  }, [member, organizationId]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading: isAuthLoading || isOrgLoading,
        organizationId,
        organizationName: orgName,
        role,
        setOrganizationId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
