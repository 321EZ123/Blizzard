import axios from 'axios';
import { load } from 'cheerio';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { ProxyRequest, VercelHandler, ErrorResponse } from '../../../types';

interface YouTubeEmbedRequest extends ProxyRequest {
  query: {
    url?: string;
    action?: 'search' | 'proxy';
  };
}

const handler: VercelHandler = async (req: YouTubeEmbedRequest, res: VercelResponse): Promise<void> => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { url: targetUrl, action } = req.query;

  if (!targetUrl || typeof targetUrl !== 'string') {
    const errorResponse: ErrorResponse = { error: 'Missing URL parameter' };
    res.status(400).json(errorResponse);
    return;
  }

  try {
    // Handle search endpoint functionality
    if (action === 'search' || req.url?.includes('/search')) {
      await handleSearchRequest(targetUrl, res);
      return;
    }

    // Handle proxy endpoint functionality (default)
    await handleProxyRequest(targetUrl, res);

  } catch (error: any) {
    console.error('Error proxying request:', error);
    const errorResponse: ErrorResponse = { error: 'Internal Server Error' };
    res.status(500).json(errorResponse);
  }
};

/**
 * Handle search request with HTML processing
 */
async function handleSearchRequest(targetUrl: string, res: VercelResponse): Promise<void> {
  const response = await axios.get(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'text/html',
    },
    responseType: 'arraybuffer',
  });

  const contentType = response.headers['content-type'] as string;
  res.setHeader('Content-Type', contentType);

  const $ = load(response.data);

  // Process images
  $('img').each((i, el) => {
    const src = $(el).attr('src');
    if (src && !src.startsWith('http')) {
      $(el).attr('src', `/proxy?url=${encodeURIComponent(src)}`);
    }
  });

  // Process links
  $('a').each((i, el) => {
    const href = $(el).attr('href');
    if (href && !href.startsWith('http')) {
      $(el).attr('href', `/proxy?url=${encodeURIComponent(href)}`);
    }
  });

  // Process videos
  $('video').each((i, el) => {
    const poster = $(el).attr('poster');
    if (poster && !poster.startsWith('http')) {
      $(el).attr('poster', `/proxy?url=${encodeURIComponent(poster)}`);
    }

    const src = $(el).attr('src');
    if (src && !src.startsWith('http')) {
      $(el).attr('src', `/proxy?url=${encodeURIComponent(src)}`);
    }
  });

  // Process forms
  $('form').each((i, el) => {
    const action = $(el).attr('action');
    if (action && !action.startsWith('http')) {
      $(el).attr('action', `/proxy?url=${encodeURIComponent(action)}`);
    }
  });

  // Inject Eruda debug tool
  $('body').append(`
    <script src="https://cdn.jsdelivr.net/npm/eruda"></script>
    <script>eruda.init();</script>
  `);

  res.send($.html());
}

/**
 * Handle proxy request for resources
 */
async function handleProxyRequest(targetUrl: string, res: VercelResponse): Promise<void> {
  const response = await axios.get(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'text/html',
    },
    responseType: 'arraybuffer',
  });

  const contentType = response.headers['content-type'] as string;
  res.setHeader('Content-Type', contentType);

  res.send(response.data);
}

export default handler;
