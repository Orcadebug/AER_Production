export const config = { runtime: 'edge' };

export default async function handler() {
  const convexBase = (process.env.VITE_CONVEX_SITE_URL || 'https://brilliant-caribou-800.convex.site');
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
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
