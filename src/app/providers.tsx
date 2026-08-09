'use client';

import { NhostProvider, useNhostClient } from '@nhost/nextjs';
import { NhostClient } from '@nhost/nextjs';
import { ReactNode, useEffect, useState } from 'react';
import { AuthProvider } from '@/lib/auth-context';
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client/core';
import { ApolloProvider } from '@apollo/client/react';

export const nhost = new NhostClient({
  subdomain: process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || 'local',
  region: process.env.NEXT_PUBLIC_NHOST_REGION || 'local'
});

function ApolloWrapper({ children }: { children: ReactNode }) {
  const nhostClient = useNhostClient();
  const [client, setClient] = useState<any>(null);

  useEffect(() => {
    const httpLink = createHttpLink({
      uri: process.env.NEXT_PUBLIC_GRAPHQL_URL || `https://${process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || 'local'}.graphql.${process.env.NEXT_PUBLIC_NHOST_REGION || 'local'}.nhost.run/v1/graphql`,
    });

    const apolloClient = new ApolloClient({
      link: httpLink,
      cache: new InMemoryCache(),
      // In a real Nhost app, we would add the authentication link here
    });

    setClient(apolloClient);
  }, [nhostClient]);

  if (!client) return <div className="p-8">Initializing client...</div>;

  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <NhostProvider nhost={nhost}>
      <ApolloWrapper>
        <AuthProvider>
          {children}
        </AuthProvider>
      </ApolloWrapper>
    </NhostProvider>
  );
}
