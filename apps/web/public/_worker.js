export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.hostname.endsWith('.pages.dev')) {
      return Response.redirect(`https://gokkan-keeper.yetimates.com${url.pathname}${url.search}`, 301);
    }

    return env.ASSETS.fetch(request);
  },
};
