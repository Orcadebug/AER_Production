async function uploadEncrypted({ sealed, analysisType, token, baseURL, previewPlaintext }) {
  const res = await fetch(`${baseURL}/api/context/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      analysis_type: analysisType,
      encryptedContent: {
        ciphertext: sealed.ciphertext,
        nonce: sealed.nonce
      },
      plaintext: typeof previewPlaintext === 'string' && previewPlaintext.trim() ? previewPlaintext.trim().slice(0, 1200) : undefined
    })
  });
  if (!res.ok) {
    let hint = '';
    if (res.status === 401) hint = ' (auth invalid or missing)';
    if (res.status === 404) hint = ' (endpoint not found; check Base URL)';
    if (res.status === 502 || res.status === 503) hint = ' (server unavailable)';
    const text = await res.text().catch(() => '');
    throw new Error(`Upload failed: ${res.status}${hint}${text ? ` - ${text}` : ''}`);
  }
  try {
    const j = await res.json();
    // If server returns a view URL or id
    if (j && j.url) return j.url;
  } catch {}
  return `${baseURL}/dashboard`;
}

module.exports = { uploadEncrypted };
