// Calls Aer backend which debits credits and performs OpenAI Vision.
// Expected endpoint (configurable baseURL): POST /api/premium/analyze
// Request: { image: 'data:image/png;base64,...' }
// Headers: Authorization: Bearer aer_{userId}
// 200 -> { insights: {...} }
// 402/403 -> { error: 'CREDITS_EXHAUSTED' } (or code)

async function analyzePremium(imageBuffer, token, baseURL) {
  const b64 = imageBuffer.toString('base64');
  const url = `${baseURL.replace(/\/$/, '')}/api/premium/analyze`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ image: `data:image/png;base64,${b64}` })
  });

  let payload = null;
  try { payload = await res.json(); } catch { payload = null; }

  if (res.status === 402 || res.status === 403 || res.status === 429) {
    const code = payload?.code || payload?.error || '';
    if ((code + '').toUpperCase().includes('CREDITS_EXHAUSTED')) {
      throw new Error('Credits exhausted. Use Basic or top up in your account.');
    }
    throw new Error(payload?.message || 'Premium credits unavailable.');
  }
  if (!res.ok) throw new Error(`Premium analysis failed: ${res.status}`);

  if (payload && payload.insights) return payload.insights;
  return payload || {};
}

module.exports = { analyzePremium };
