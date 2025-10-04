import { VercelRequest, VercelResponse } from '@vercel/node';
import { AxiosResponse } from 'axios';

// Vercel handler function type
export type VercelHandler = (req: VercelRequest, res: VercelResponse) => Promise<void>;

// Extended request interface with typed query parameters
export interface ProxyRequest extends VercelRequest {
  query: {
    url?: string;
    [key: string]: string | string[] | undefined;
  } & VercelRequest['query'];
}

// Response configuration for different content types
export interface ProxyConfig {
  isImage: boolean;
  isBinary: boolean;
  isJson: boolean;
  isJs: boolean;
  contentType: string;
}

// Asset processing interfaces
export interface AssetConfig {
  video?: Record<string, any>;
  poster?: Record<string, any>;
  image?: Record<string, { src?: string; [key: string]: any }>;
}

export interface JsonAssets {
  assets?: AssetConfig;
  [key: string]: any;
}

// URL rewriting patterns
export interface RedirectPattern {
  pattern: RegExp;
  replacement: (...args: string[]) => string;
}

// Headers type for response modification
export type ResponseHeaders = Record<string, string | string[] | undefined>;

// Error response interface
export interface ErrorResponse {
  error: string;
  message?: string;
}

// Utility type for URL decoding
export type URLDecoder = (url: string) => string;

// Content processors
export type ContentProcessor = (content: string, baseUrl: URL) => string;

// Express handler type for YouTube embed endpoint
export interface ExpressHandler {
  (req: any, res: any): Promise<void>;
}
