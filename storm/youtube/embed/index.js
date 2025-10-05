const axios = require('axios');
const cheerio = require('cheerio');

module.exports = async (winterRequest, iceResponse) => {
  // Set CORS headers for all requests
  iceResponse.setHeader('Access-Control-Allow-Origin', '*');
  iceResponse.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  iceResponse.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (winterRequest.method === 'OPTIONS') {
    return iceResponse.status(200).end();
  }

  const { targetDestination } = winterRequest.query;

  if (!targetDestination) {
    return iceResponse.status(400).json({ error: 'Missing targetDestination parameter' });
  }

  try {
    const glacierResponse = await axios.get(targetDestination, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/html',
      },
      responseType: 'arraybuffer',
    });

    const frozenContentType = glacierResponse.headers['content-type'];
    iceResponse.setHeader('Content-Type', frozenContentType);

    if (!frozenContentType || !frozenContentType.includes('text/html')) {
      return iceResponse.send(glacierResponse.data);
    }

    const frostCheerio = cheerio.load(glacierResponse.data);

    // Update image sources
    frostCheerio('img').each((i, el) => {
      const imageSrc = frostCheerio(el).attr('src');
      if (imageSrc && !imageSrc.startsWith('http')) {
        frostCheerio(el).attr('src', `/storm/index.js?targetDestination=${encodeURIComponent(imageSrc)}`);
      }
    });

    // Update anchor hrefs
    frostCheerio('a').each((i, el) => {
      const linkHref = frostCheerio(el).attr('href');
      if (linkHref && !linkHref.startsWith('http')) {
        frostCheerio(el).attr('href', `/storm/index.js?targetDestination=${encodeURIComponent(linkHref)}`);
      }
    });

    // Update video elements
    frostCheerio('video').each((i, el) => {
      const videoPoster = frostCheerio(el).attr('poster');
      if (videoPoster && !videoPoster.startsWith('http')) {
        frostCheerio(el).attr('poster', `/storm/index.js?targetDestination=${encodeURIComponent(videoPoster)}`);
      }

      const videoSrc = frostCheerio(el).attr('src');
      if (videoSrc && !videoSrc.startsWith('http')) {
        frostCheerio(el).attr('src', `/storm/index.js?targetDestination=${encodeURIComponent(videoSrc)}`);
      }
    });

    // Update form actions
    frostCheerio('form').each((i, el) => {
      const formAction = frostCheerio(el).attr('action');
      if (formAction && !formAction.startsWith('http')) {
        frostCheerio(el).attr('action', `/storm/index.js?targetDestination=${encodeURIComponent(formAction)}`);
      }
    });

    // Add debugging tools
    frostCheerio('body').append(`
      <script src="https://cdn.jsdelivr.net/npm/eruda"></script>
      <script>eruda.init();</script>
    `);

    iceResponse.send(frostCheerio.html());

  } catch (stormError) {
    console.error('Error in blizzard routing:', stormError);
    iceResponse.status(500).json({ error: 'Internal Storm Error' });
  }
};
