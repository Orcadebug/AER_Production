const uploadData = {
  type: 'web',
  title: payload.title || 'Untitled',
  url: payload.url || '',
  plaintext: payload.content || payload.plaintext || '',
  metadata: payload.metadata || {},
};
