    // Prepare upload data with correct field mapping for backend
    const uploadData = {
      type: 'web',
      title: payload.title || 'Untitled',
      url: payload.url || '',
      plaintext: payload.content || payload.plaintext || '',
      metadata: payload.metadata || {},
    };

    // Debug logging to verify data structure
    console.log('[Upload] Sending data:', {
      hasTitle: !!uploadData.title,
      hasPlaintext: !!uploadData.plaintext,
      plaintextLength: uploadData.plaintext?.length || 0,
      url: uploadData.url
    });

    const res = await fetch(`${apiUrl}/api/context/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // token format must be aer_{userId}
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(uploadData),
    });