const axios = require('axios');

module.exports = async (winterRequest, iceResponse) => {
  try {
    const { targetDestination } = winterRequest.query;

    if (!targetDestination) {
      return iceResponse.status(400).json({ error: 'Missing targetDestination parameter' });
    }

    const decodedDestination = decodeURIComponent(targetDestination.trim());
    console.log("Glacier routing to:", decodedDestination);

    const glacierResponse = await axios.get(decodedDestination, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/html',
      },
      responseType: 'arraybuffer',
    });

    const frozenContentType = glacierResponse.headers['content-type'] || 'text/html';
    iceResponse.setHeader('Content-Type', frozenContentType);

    if (!frozenContentType.includes('text/html')) {
      return iceResponse.send(glacierResponse.data);
    }

    let frozenHtml = Buffer.from(glacierResponse.data).toString('utf-8');

    const injectBlizzardEruda = (html) => {
      const erudaScript = `
        <script src="https://cdn.jsdelivr.net/npm/eruda"></script>
        <script>eruda.init();</script>
      `;
      return html.replace('</body>', `${erudaScript}</body>`);
    };

    const injectStormIframeReplacement = (html, videoId) => {
      const stormScript = `
        <script>
          (function () {
            const frozenVideoId = "${videoId}";
            const stormIframe = document.createElement('iframe');
            stormIframe.src = '/storm/youtube/embed/index.js?targetDestination=https://www.youtube.com/embed/' + frozenVideoId;
            stormIframe.style = 'width:100%; height:100%; border:none; position:absolute; top:0; left:0; z-index:1;';
            stormIframe.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture';
            stormIframe.allowFullscreen = true;

            const blizzardObserver = new MutationObserver((mutations, obs) => {
              const errorTarget = document.querySelector('yt-player-error-message-renderer');
              if (errorTarget) {
                errorTarget.replaceWith(stormIframe);
                console.log("Replaced error renderer with storm iframe.");
                obs.disconnect();
              }
            });

            blizzardObserver.observe(document.body, { childList: true, subtree: true });
          })();
        </script>
      `;
      return html.replace('</body>', `${stormScript}</body>`);
    };

    const frozenVideoId = new URL(decodedDestination).searchParams.get('v') || decodedDestination.split('/shorts/')[1];

    if (frozenVideoId) {
      frozenHtml = injectStormIframeReplacement(frozenHtml, frozenVideoId);
    }

    frozenHtml = injectBlizzardEruda(frozenHtml);

    iceResponse.send(frozenHtml);

  } catch (stormError) {
    console.error("Blizzard error occurred:", stormError.message);
    iceResponse.status(500).json({ error: 'Internal Storm Error' });
  }
};
