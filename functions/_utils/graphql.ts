export async function graphqlClient(query: string, variables: any = {}, headers: any = {}) {
  const url = process.env.NHOST_GRAPHQL_URL || process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:1337/v1/graphql';
  const adminSecret = process.env.NHOST_ADMIN_SECRET || 'hasura-admin-secret';

  const defaultHeaders = {
    'Content-Type': 'application/json',
    'x-hasura-admin-secret': adminSecret,
    ...headers
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify({ query, variables })
  });

  const result = await response.json();
  if (result.errors) {
    console.error('GraphQL Error:', JSON.stringify(result.errors, null, 2));
    throw new Error(result.errors[0].message);
  }

  return result.data;
}
