#!/usr/bin/env node
import { createInterface } from 'node:readline';

const SERVER_NAME = 'fetch-mcp';
const SERVER_VERSION = '1.0.0';

const TOOLS = [
  {
    name: 'fetch_markdown',
    description: 'Fetch web page content and convert HTML to readable Markdown text.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch' }
      },
      required: ['url']
    }
  },
  {
    name: 'fetch_json',
    description: 'Make a GET or POST JSON API request.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'API endpoint URL' },
        method: { type: 'string', enum: ['GET', 'POST'], description: 'HTTP method' },
        headers: { type: 'object', description: 'Optional request headers' },
        body: { type: 'string', description: 'Optional JSON body string' }
      },
      required: ['url']
    }
  }
];

function htmlToMarkdown(html) {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\r?\n\s*\r?\n/g, '\n\n')
    .trim();
  return text.slice(0, 50000);
}

async function handleToolCall(name, args) {
  if (name === 'fetch_markdown') {
    const res = await fetch(args.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await res.text();
    return [{ type: 'text', text: htmlToMarkdown(html) }];
  }
  if (name === 'fetch_json') {
    const opt = {
      method: args.method || 'GET',
      headers: { 'User-Agent': 'MCP-Fetch', ...(args.headers || {}) }
    };
    if (args.body && opt.method === 'POST') opt.body = args.body;
    const res = await fetch(args.url, opt);
    const data = await res.text();
    return [{ type: 'text', text: data }];
  }
  throw new Error(`Unknown tool: ${name}`);
}

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false });
function send(msg) { process.stdout.write(JSON.stringify(msg) + '\n'); }
rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const req = JSON.parse(trimmed);
    const { id, method, params } = req;
    if (method === 'initialize') {
      send({ jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: SERVER_NAME, version: SERVER_VERSION } } });
    } else if (method === 'notifications/initialized') {
    } else if (method === 'tools/list') {
      send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    } else if (method === 'tools/call') {
      try {
        const content = await handleToolCall(params?.name, params?.arguments || {});
        send({ jsonrpc: '2.0', id, result: { content } });
      } catch (err) {
        send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true } });
      }
    } else if (id !== undefined) {
      send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
    }
  } catch {}
});