export const config = { runtime: 'edge' };

function textEvent(event, data) {
  return `event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`;
}

export default async function handler(req) {
  const enabled = process.env.MCP_ENABLED === 'true';

  if (!enabled) {
    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
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
        client_name: client,
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
        http: {
          invoke_url: `${site}/api/mcp/invoke`,
        },
        tools: [
          { name: 'list_contexts', description: 'List your contexts', schema: { type: 'object', properties: { limit: { type: 'number', description: 'Max items to return' } } } },
          { name: 'search_contexts', description: 'Search contexts by query', schema: { type: 'object', required: ['query'], properties: { query: { type: 'string' } } } },
          { name: 'list_tags', description: 'List your tags', schema: { type: 'object', properties: {} } },
          { name: 'get_contexts_by_tags', description: 'Get contexts matching tags', schema: { type: 'object', required: ['tags'], properties: { tags: { type: 'array', items: { type: 'string' } } } } },
          { name: 'get_user_stats', description: 'Summary statistics for your account', schema: { type: 'object', properties: {} } },
          { name: 'generate_tags', description: 'Generate tags for provided content', schema: { type: 'object', required: ['content','totalContexts'], properties: { content: { type: 'string' }, title: { type: 'string' }, totalContexts: { type: 'number' } } } },
          { name: 'chat_with_context', description: 'Chat with your knowledge base', schema: { type: 'object', required: ['model','query'], properties: { model: { type: 'string', enum: ['openai-gpt4','openai-gpt3.5','perplexity-sonar','perplexity-sonar-pro'] }, query: { type: 'string' }, includeRelevantContexts: { type: 'boolean' } } } },
          { name: 'generate_with_model', description: 'Call a specific model with optional context', schema: { type: 'object', required: ['model','prompt'], properties: { model: { type: 'string', enum: ['openai-gpt4','openai-gpt3.5','perplexity-sonar','perplexity-sonar-pro'] }, prompt: { type: 'string' }, systemPrompt: { type: 'string' }, contextData: { type: 'array', items: { type: 'object', required: ['title','content','tags'], properties: { title: { type: 'string' }, content: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } } } } } } },
        ],
      };

      // Recommend client retry interval
      controller.enqueue(encoder.encode(`retry: 10000\n\n`));
      controller.enqueue(encoder.encode(textEvent('server-info', serverInfo)));
      controller.enqueue(encoder.encode(textEvent('ready', { message: 'SSE ready' })));

      // Heartbeat to keep connection alive through proxies
      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(`: keep-alive ${Date.now()}\n\n`));
      }, 15000);

      // Cleanup on disconnect
      // @ts-ignore - cancel is supported by ReadableStream underlying source
      this.cancel = () => {
        clearInterval(keepAlive);
      };
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
