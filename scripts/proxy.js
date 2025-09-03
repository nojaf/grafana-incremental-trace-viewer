Bun.serve({
  port: 3200,
  hostname: '0.0.0.0',
  async fetch(req) {
    const url = new URL(req.url);
    const targetPath = url.pathname;
    let targetUrl = `http://host.docker.internal:5359/tempo${targetPath}`;
    if (url.searchParams.size > 0) {
      targetUrl += `?${url.searchParams.toString()}`;
    }

    console.log(`Proxying ${req.url} to ${targetUrl}`);

    try {
      const response = await fetch(targetUrl, {
        method: req.method,
        headers: req.headers,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
      });

      // Copy response headers
      const headers = new Headers(response.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: headers,
      });
    } catch (error) {
      console.error(`Proxy error: ${error.message}`);
      return new Response(JSON.stringify({ error: 'Proxy error', message: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
});

console.log('Tempo proxy running on port 3200');
