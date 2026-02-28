const CANONICAL_ORIGIN = 'https://gokkan-keeper.yetimates.com';
const API_ORIGIN = 'https://gokkan-keeper-api-production.amansman77.workers.dev';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.hostname.endsWith('.pages.dev')) {
      return Response.redirect(`${CANONICAL_ORIGIN}${url.pathname}${url.search}`, 301);
    }

    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      const upstreamPath = url.pathname === '/api' ? '' : url.pathname.slice(4);
      const upstreamUrl = `${API_ORIGIN}${upstreamPath}${url.search}`;
      const proxyRequest = new Request(upstreamUrl, request);
      return fetch(proxyRequest);
    }

    return env.ASSETS.fetch(request);
  },
};
