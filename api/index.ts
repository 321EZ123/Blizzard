import axios from 'axios';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { ProxyRequest, VercelHandler, ProxyConfig } from '../types';
import {
  setCorsHeaders,
  handleOptionsRequest,
  getProxyConfig,
  applyHeaders,
  decodeUrlContent,
  processJsonAssets,
  injectEruda
} from '../utils/proxy-utils';
import {
  processHtmlContent,
  processGoogleSearch,
  processGoogleHomepage
} from '../utils/content-processor';

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

      // Handle Google search specific logic
      const googleSearchResult = processGoogleSearch(data, url);
      if (googleSearchResult) {
        res.send(googleSearchResult);
        return;
      }

      // Handle Google homepage specific logic
      const googleHomepageResult = processGoogleHomepage(data, url, 'static');
      if (googleHomepageResult) {
        data = googleHomepageResult;
      }

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
