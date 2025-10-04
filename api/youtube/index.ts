import axios from 'axios';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { ProxyRequest, VercelHandler, ErrorResponse } from '../../types';

interface YouTubeProxyRequest extends ProxyRequest {
  query: {
    url?: string;
  };
}

const handler: VercelHandler = async (req: YouTubeProxyRequest, res: VercelResponse): Promise<void> => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      const errorResponse: ErrorResponse = { error: 'Missing URL parameter' };
      res.status(400).json(errorResponse);
      return;
    }

    const decodedUrl: string = decodeURIComponent(url.trim());
    console.log("Fetching URL:", decodedUrl);

    const response = await axios.get(decodedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/html',
      },
      responseType: 'arraybuffer',
    });

    const contentType: string = response.headers['content-type'] as string || 'text/html';
    res.setHeader('Content-Type', contentType);

    if (!contentType.includes('text/html')) {
      res.send(response.data);
      return;
    }

    let html: string = Buffer.from(response.data).toString('utf-8');

    /**
     * Inject Eruda debug tool
     */
    const injectEruda = (html: string): string => {
      const erudaScript = `
        <script src="https://cdn.jsdelivr.net/npm/eruda"></script>
        <script>eruda.init();</script>
      `;
      return html.replace('</body>', `${erudaScript}</body>`);
    };

    /**
     * Inject iframe replacement script for YouTube videos
     */
    const injectIframeReplacementScript = (html: string, videoId: string): string => {
      const script = `
        <script>
          (function () {
            const videoId = "${videoId}";
            const iframe = document.createElement('iframe');
            iframe.src = '/API/youtube/embed/index.js?url=https://www.youtube.com/embed/' + videoId;
            iframe.style = 'width:100%; height:100%; border:none; position:absolute; top:0; left:0; z-index:1;';
            iframe.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture';
            iframe.allowFullscreen = true;

            const observer = new MutationObserver((mutations, obs) => {
              const target = document.querySelector('yt-player-error-message-renderer');
              if (target) {
                target.replaceWith(iframe);
                console.log("Replaced yt-player-error-message-renderer with iframe.");
                obs.disconnect();
              }
            });

            observer.observe(document.body, { childList: true, subtree: true });
          })();
        </script>
      `;
      return html.replace('</body>', `${script}</body>`);
    };

    // Extract video ID from URL
    const urlObj = new URL(decodedUrl);
    const videoId: string | null = urlObj.searchParams.get('v') || decodedUrl.split('/shorts/')[1] || null;

    if (videoId) {
      html = injectIframeReplacementScript(html, videoId);
    }

    html = injectEruda(html);

    res.send(html);

  } catch (err: any) {
    console.error("Error occurred:", err.message);
    const errorResponse: ErrorResponse = { error: 'Internal Server Error' };
    res.status(500).json(errorResponse);
  }
};

export default handler;
