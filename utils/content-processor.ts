import { ContentProcessor } from '../types';

/**
 * Replace relative URLs in HTML attributes with proxied URLs
 */
export function processHtmlAttributes(data: string, baseUrl: URL): string {
  return data.replace(/(src|href|srcset|poster)=["']([^"']+)["']/gi, (match: string, attr: string, link: string): string => {
    try {
      if (link.startsWith('data:') || link.startsWith('mailto:') || link.startsWith('javascript:')) {
        return match;
      }
      const absoluteUrl = new URL(link, baseUrl).toString();
      const proxied = `/API/index.js?url=${encodeURIComponent(absoluteUrl)}`;
      return `${attr}="${proxied}"`;
    } catch (e) {
      return match;
    }
  });
}

/**
 * Process lazy loading attributes
 */
export function processLazyLoading(data: string): string {
  return data.replace('loading="lazy"', 'loading="eager"');
}

/**
 * Process JavaScript redirects and window.open calls
 */
export function processJavaScriptRedirects(data: string, baseUrl: URL): string {
  const redirectPatterns: RegExp[] = [
    /(?:window\.|top\.|document\.)?location(?:\.href)?\s*=\s*["'`](.*?)["'`]/gi,
    /window\.open\s*\(\s*["'`](.*?)["'`]\s*(,.*?)?\)/gi,
  ];

  let processedData = data;

  for (const pattern of redirectPatterns) {
    processedData = processedData.replace(pattern, (...args: string[]): string => {
      let link = args[1];
      let extra = args[2] || '';
      try {
        const target = new URL(link || '.', baseUrl).toString();
        const proxied = `/API/index.js?url=${encodeURIComponent(target)}`;
        if (pattern.source.startsWith("window.open")) {
          return `window.open('${proxied}'${extra})`;
        } else {
          return `window.location = '${proxied}'`;
        }
      } catch (e) {
        return args[0];
      }
    });
  }

  return processedData;
}

/**
 * Process CSS background images
 */
export function processCssBackgroundImages(data: string, baseUrl: URL): string {
  // Process CSS custom properties
  data = data.replace(/(--background-image\s*:\s*url\(["']?)([^"')]+)(["']?\))/g, (match: string, prefix: string, url: string, suffix: string): string => {
    if (url.startsWith('http')) return match;
    const proxiedUrl = `/API/index.js?url=${encodeURIComponent(url)}`;
    return `${prefix}${proxiedUrl}${suffix}`;
  });

  // Process regular CSS url() calls
  data = data.replace(/url\(["']?(?!data:|http|\/\/)([^"')]+)["']?\)/gi, (match: string, relativePath: string): string => {
    const absolute = new URL(relativePath, baseUrl).toString();
    const proxied = `/API/index.js?url=${encodeURIComponent(absolute)}`;
    return `url('${proxied}')`;
  });

  return data;
}

/**
 * Process iframe sources
 */
export function processIframeSources(data: string, baseUrl: URL): string {
  return data.replace(/<iframe\s+[^>]*src=["'](.*?)["'][^>]*>/gi, (match: string, link: string): string => {
    try {
      const target = new URL(link || '.', baseUrl).toString();
      const proxied = `/API/index.js?url=${encodeURIComponent(target)}`;
      return match.replace(link, proxied);
    } catch (e) {
      return match;
    }
  });
}

/**
 * Process absolute HTTP links
 */
export function processAbsoluteLinks(data: string): string {
  return data.replace(/href=["'](https?:\/\/[^"']+)["']/gi, (match: string, link: string): string => {
    try {
      const proxied = `/API/index.js?url=${encodeURIComponent(link)}`;
      return `href="${proxied}"`;
    } catch (e) {
      return match;
    }
  });
}

/**
 * Process Google search specific content
 */
export function processGoogleSearch(data: string, url: string): string | null {
  if (url.includes('google.com/search')) {
    const formRegex = /<form\s+class="tsf"[^>]*role="search"[^>]*>[\s\S]*?<\/form>/i;

    data = data.replace(formRegex, '');

    return `
      <body>
        <script>
          alert('Google will attempt to load from 3–30 or more times before it succeeds.');
          window.location.href = '/API/google/index.js?url=' + encodeURIComponent(${JSON.stringify(url)});
        </script>
      </body>
    `;
  }
  return null;
}

/**
 * Process Google homepage specific content
 */
export function processGoogleHomepage(data: string, url: string, staticPath: string): string | null {
  if (url.includes('https://google.com')) {
    try {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(process.cwd(), 'static', 'google', 'index.html');
      data = fs.readFileSync(filePath, 'utf8');

      return data.replace(
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
    } catch (e) {
      console.error('Error reading static file:', e);
      return null;
    }
  }
  return null;
}

/**
 * Main HTML content processor
 */
export const processHtmlContent: ContentProcessor = (data: string, baseUrl: URL): string => {
  // Process HTML attributes
  data = processHtmlAttributes(data, baseUrl);

  // Process lazy loading
  data = processLazyLoading(data);

  // Process JavaScript redirects
  data = processJavaScriptRedirects(data, baseUrl);

  // Process CSS background images
  data = processCssBackgroundImages(data, baseUrl);

  // Process iframe sources
  data = processIframeSources(data, baseUrl);

  // Process absolute links
  data = processAbsoluteLinks(data);

  return data;
};
