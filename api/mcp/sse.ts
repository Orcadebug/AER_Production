export const config = { runtime: 'edge' };

function textEvent(event, data) {
  return `event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`;
}

export default async function handler(req) {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { searchParams } = new URL(req.url);
  const client = searchParams.get('client') || 'claude';

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const site = process.env.SITE_URL || 'https://www.aercarbon.com';
      const convexBase = (process.env.VITE_CONVEX_SITE_URL || 'https://brilliant-caribou-800.convex.site');
      const auth = {
        type: 'oauth',
        client_name: 'Claude',
        authorization_url: `${convexBase}/api/oauth/authorize`,
        token_url: `${convexBase}/api/oauth/token`,
        scope: 'mcp',
        callback_urls: ['https://claude.ai/api/mcp/auth_callback', 'https://claude.com/api/mcp/auth_callback'],
      };

      const serverInfo = {
        name: 'Aer MCP',
        version: '1.0.0',
        protocol: 'mcp',
        transport: 'sse',
        auth,
        tools: [
          { name: 'list_contexts', description: 'List your contexts' },
          { name: 'search_contexts', description: 'Search contexts by query' },
          { name: 'list_tags', description: 'List your tags' },
        ],
      };

      controller.enqueue(encoder.encode(textEvent('server-info', serverInfo)));
      controller.enqueue(encoder.encode(textEvent('ready', { message: 'SSE ready' })));
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
