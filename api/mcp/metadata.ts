export const config = { runtime: 'edge' };

export default async function handler() {
  const enabled = process.env.MCP_ENABLED === 'true';
  if (!enabled) {
    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
  const convexBase = (process.env.VITE_CONVEX_SITE_URL || 'https://honorable-porpoise-222.convex.site');
  return new Response(
    JSON.stringify({
      name: 'Aer MCP',
      sse_url: `${process.env.SITE_URL || 'https://www.aercarbon.com'}/api/mcp/sse`,
      auth: {
        type: 'oauth',
        client_name: 'Claude',
        authorization_url: `${convexBase}/api/oauth/authorize`,
        token_url: `${convexBase}/api/oauth/token`,
        scope: 'mcp',
        callback_urls: ['https://claude.ai/api/mcp/auth_callback', 'https://claude.com/api/mcp/auth_callback'],
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
  );
}
