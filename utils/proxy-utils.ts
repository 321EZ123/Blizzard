import { VercelResponse } from '@vercel/node';
import { AxiosResponseHeaders, RawAxiosResponseHeaders } from 'axios';
import { ProxyConfig, ResponseHeaders, JsonAssets } from '../types';

/**
 * Set CORS headers for all responses
 */
export function setCorsHeaders(res: VercelResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, User-Agent, Referer");
}

/**
 * Handle OPTIONS preflight requests
 */
export function handleOptionsRequest(res: VercelResponse): void {
  setCorsHeaders(res);
  res.status(204).end();
}

/**
 * Determine content type configuration based on URL
 */
export function getProxyConfig(url: string, contentType: string): ProxyConfig {
  const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(url);
  const isBinary = /\.(woff2?|ttf|eot|otf|ico)$/i.test(url);
  const isJson = /\.json$/i.test(url);
  const isJs = /\.js$/i.test(url);

  return {
    isImage,
    isBinary,
    isJson,
    isJs,
    contentType: contentType || 'application/octet-stream'
  };
}

/**
 * Clean response headers by removing security-related headers
 */
export function cleanResponseHeaders(headers: ResponseHeaders | AxiosResponseHeaders | RawAxiosResponseHeaders): ResponseHeaders {
  const cleanedHeaders = { ...headers } as ResponseHeaders;
  delete cleanedHeaders['content-security-policy'];
  delete cleanedHeaders['content-security-policy-report-only'];
  delete cleanedHeaders['x-frame-options'];
  return cleanedHeaders;
}

/**
 * Apply cleaned headers to response
 */
export function applyHeaders(res: VercelResponse, headers: AxiosResponseHeaders | RawAxiosResponseHeaders): void {
  const cleanedHeaders = cleanResponseHeaders(headers as ResponseHeaders);
  for (const [key, value] of Object.entries(cleanedHeaders)) {
    if (value !== undefined && value !== null) {
      res.setHeader(key, value);
    }
  }
}

/**
 * URL decode with comprehensive character replacement
 */
export function decodeUrlContent(data: string): string {
  return data
    .replace(/%20/g, ' ')
    .replace(/%21/g, '!')
    .replace(/%22/g, '"')
    .replace(/%23/g, '#')
    .replace(/%24/g, '$')
    .replace(/%25/g, '%')
    .replace(/%26/g, '&')
    .replace(/%27/g, "'")
    .replace(/%28/g, '(')
    .replace(/%29/g, ')')
    .replace(/%2A/g, '*')
    .replace(/%2B/g, '+')
    .replace(/%2C/g, ',')
    .replace(/%2D/g, '-')
    .replace(/%2E/g, '.')
    .replace(/%2F/g, '/')
    .replace(/%30/g, '0')
    .replace(/%31/g, '1')
    .replace(/%32/g, '2')
    .replace(/%33/g, '3')
    .replace(/%34/g, '4')
    .replace(/%35/g, '5')
    .replace(/%36/g, '6')
    .replace(/%37/g, '7')
    .replace(/%38/g, '8')
    .replace(/%39/g, '9')
    .replace(/%3A/g, ':')
    .replace(/%3B/g, ';')
    .replace(/%3C/g, '<')
    .replace(/%3D/g, '=')
    .replace(/%3E/g, '>')
    .replace(/%3F/g, '?')
    .replace(/%40/g, '@')
    .replace(/%41/g, 'A')
    .replace(/%42/g, 'B')
    .replace(/%43/g, 'C')
    .replace(/%44/g, 'D')
    .replace(/%45/g, 'E')
    .replace(/%46/g, 'F')
    .replace(/%47/g, 'G')
    .replace(/%48/g, 'H')
    .replace(/%49/g, 'I')
    .replace(/%4A/g, 'J')
    .replace(/%4B/g, 'K')
    .replace(/%4C/g, 'L')
    .replace(/%4D/g, 'M')
    .replace(/%4E/g, 'N')
    .replace(/%4F/g, 'O')
    .replace(/%50/g, 'P')
    .replace(/%51/g, 'Q')
    .replace(/%52/g, 'R')
    .replace(/%53/g, 'S')
    .replace(/%54/g, 'T')
    .replace(/%55/g, 'U')
    .replace(/%56/g, 'V')
    .replace(/%57/g, 'W')
    .replace(/%58/g, 'X')
    .replace(/%59/g, 'Y')
    .replace(/%5A/g, 'Z')
    .replace(/%5B/g, '[')
    .replace(/%5C/g, '\\')
    .replace(/%5D/g, ']')
    .replace(/%5E/g, '^')
    .replace(/%5F/g, '_')
    .replace(/%60/g, '`')
    .replace(/%61/g, 'a')
    .replace(/%62/g, 'b')
    .replace(/%63/g, 'c')
    .replace(/%64/g, 'd')
    .replace(/%65/g, 'e')
    .replace(/%66/g, 'f')
    .replace(/%67/g, 'g')
    .replace(/%68/g, 'h')
    .replace(/%69/g, 'i')
    .replace(/%6A/g, 'j')
    .replace(/%6B/g, 'k')
    .replace(/%6C/g, 'l')
    .replace(/%6D/g, 'm')
    .replace(/%6E/g, 'n')
    .replace(/%6F/g, 'o')
    .replace(/%70/g, 'p')
    .replace(/%71/g, 'q')
    .replace(/%72/g, 'r')
    .replace(/%73/g, 's')
    .replace(/%74/g, 't')
    .replace(/%75/g, 'u')
    .replace(/%76/g, 'v')
    .replace(/%77/g, 'w')
    .replace(/%78/g, 'x')
    .replace(/%79/g, 'y')
    .replace(/%7A/g, 'z')
    .replace(/%7B/g, '{')
    .replace(/%7C/g, '|')
    .replace(/%7D/g, '}')
    .replace(/%7E/g, '~');
}

/**
 * Process JSON content to update asset URLs
 */
export function processJsonAssets(data: string, baseUrl: URL): string {
  return data.replace(/content="([^"]+)"/g, (match: string, jsonContent: string): string => {
    try {
      let jsonData: JsonAssets = JSON.parse(decodeURIComponent(jsonContent));

      const updateAssetUrl = (obj: Record<string, any>): void => {
        for (let key in obj) {
          const val = obj[key];
          if (typeof val === 'string' && !val.startsWith('data:') && !val.startsWith('http')) {
            obj[key] = new URL(val, baseUrl).toString();
          }
        }
      };

      if (jsonData.assets) {
        if (jsonData.assets.video) {
          for (let size in jsonData.assets.video) {
            updateAssetUrl(jsonData.assets.video[size]);
          }
        }
        if (jsonData.assets.poster) {
          updateAssetUrl(jsonData.assets.poster);
        }
        if (jsonData.assets.image) {
          for (let size in jsonData.assets.image) {
            const img = jsonData.assets.image[size];
            if (img && img.src && !img.src.startsWith('http')) {
              jsonData.assets.image[size].src = new URL(img.src, baseUrl).toString();
            }
          }
        }
      }

      return `content="${encodeURIComponent(JSON.stringify(jsonData))}"`;
    } catch (e) {
      console.error("Error processing content:", e);
      return match;
    }
  });
}

/**
 * Inject Eruda debug tool
 */
export function injectEruda(html: string): string {
  return html.replace(/<\/body>/i, `
    <script src="https://cdn.jsdelivr.net/npm/eruda"></script>
    <script>eruda.init();</script>
  </body>`);
}
