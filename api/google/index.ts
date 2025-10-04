import axios from 'axios';
import https from 'https';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { ProxyRequest, VercelHandler, ProxyConfig } from '../../types';
import {
  setCorsHeaders,
  handleOptionsRequest,
  getProxyConfig,
  applyHeaders,
  decodeUrlContent,
  processJsonAssets,
  injectEruda
} from '../../utils/proxy-utils';
import { processHtmlContent } from '../../utils/content-processor';

const handler: VercelHandler = async (req: ProxyRequest, res: VercelResponse): Promise<void> => {
  if (req.method === 'OPTIONS') {
    handleOptionsRequest(res);
    return;
  }

  let { url } = req.query;
  if (!url || typeof url !== 'string') {
    res.status(400).send("Missing `url` query parameter.");
    return;
  }

  try {
    url = decodeURIComponent(url);
    console.log(`Proxying: ${url}`);

    const agent = new https.Agent({ rejectUnauthorized: false });

    const response = await axios.get(url, {
      httpsAgent: agent,
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': req.headers['user-agent'] || '',
        'Accept': '*/*',
      },
    });

    const contentTypeHeader = response.headers['content-type'] as string | undefined;
    const config: ProxyConfig = getProxyConfig(url, contentTypeHeader || 'application/octet-stream');

    setCorsHeaders(res);
    res.setHeader("Content-Type", config.contentType);

    // Apply cleaned headers
    applyHeaders(res, response.headers);

    // Handle binary content (images, fonts, etc.)
    if (config.isImage || config.isBinary) {
      res.status(response.status).send(Buffer.from(response.data));
      return;
    }

    // Handle JSON content
    if (config.isJson) {
      res.status(response.status).json(response.data);
      return;
    }

    let data: string = Buffer.from(response.data).toString('utf-8');

    // Process HTML content
    if (!config.isJs && config.contentType.includes('text/html')) {
      const baseUrl = new URL(url);

      // Process HTML content with URL rewriting
      data = processHtmlContent(data, baseUrl);

      // Inject Eruda debug tool
      data = injectEruda(data);

      // Google-specific modifications
      data = data.replace(/<\/body>/i, `
        <script>
          (() => {
            const form = document.getElementById('tsf');
            if (form) {
              const parent = form.parentNode;
              const children = Array.from(form.childNodes);
              children.forEach(child => parent.insertBefore(child, form));
              parent.removeChild(form);
              console.log('Form unwrapped successfully.');
            } else {
              console.warn('No form with ID "tsf" found.');
            }
          })();

          setInterval(function() {
            const searchBar = document.getElementsByClassName('SDkEP')[0];
            if (searchBar && searchBar.style.width !== '670px') {
              searchBar.style.width = '670px';
              console.log('Search bar grown to proper size');
            }
          }, 10);
        </script>
      </body>`);

      // Add search functionality
      data = data.replace(
        /<\/body>/i,
        `
          <script>
            document.addEventListener('DOMContentLoaded', function () {
              const searchInput = document.querySelector('input[name="q"], textarea[name="q"]');
              if (searchInput) {
                searchInput.addEventListener('keypress', function (event) {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    const searchTerm = searchInput.value;
                    const searchUrl = 'https://www.google.com/search?q=' + encodeURIComponent(searchTerm);
                    window.location.href = '/API/index.js?url=' + encodeURIComponent(searchUrl);
                  }
                });
              }
            });
          </script>
        </body>`
      );

      // Process JSON assets
      data = processJsonAssets(data, baseUrl);
    }

    // Apply URL decoding
    data = decodeUrlContent(data);

    res.status(response.status).send(data);

  } catch (err: any) {
    console.error(`Proxy Error: ${err.message}`);
    res.status(500).send(`<h1>Proxy Error</h1><p>${err.message}</p>`);
  }
};

export default handler;
