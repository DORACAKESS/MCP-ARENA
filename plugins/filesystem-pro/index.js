#!/usr/bin/env node
import { createInterface } from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const SERVER_NAME = 'filesystem-pro';
const SERVER_VERSION = '1.0.0';

const TOOLS = [
  {
    name: 'compute_sha256',
    description: 'Calculate cryptographic SHA256 hash of a file.',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Path to file' }
      },
      required: ['file_path']
    }
  },
  {
    name: 'inspect_directory_tree',
    description: 'Get clean formatted tree of directory up to specified depth.',
    inputSchema: {
      type: 'object',
      properties: {
        dir_path: { type: 'string', description: 'Directory to inspect (default: current directory)' },
        max_depth: { type: 'number', description: 'Maximum depth (default: 3)' }
      }
    }
  }
];

function buildTree(dir, depth, maxDepth) {
  if (depth > maxDepth) return '';
  let out = '';
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      if (item.name === 'node_modules' || item.name === '.git' || item.name === 'dist') continue;
      const indent = '  '.repeat(depth);
      out += `${indent}${item.isDirectory() ? '📁 ' : '📄 '}${item.name}\n`;
      if (item.isDirectory() && depth < maxDepth) {
        out += buildTree(path.join(dir, item.name), depth + 1, maxDepth);
      }
    }
  } catch {}
  return out;
}

async function handleToolCall(name, args) {
  if (name === 'compute_sha256') {
    const p = path.resolve(args.file_path);
    if (!fs.existsSync(p)) return [{ type: 'text', text: `Error: File ${p} does not exist` }];
    const buf = fs.readFileSync(p);
    const hash = crypto.createHash('sha256').update(buf).digest('hex');
    return [{ type: 'text', text: JSON.stringify({ file: p, sha256: hash, sizeBytes: buf.length }, null, 2) }];
  }
  if (name === 'inspect_directory_tree') {
    const target = path.resolve(args.dir_path || '.');
    const depth = args.max_depth || 3;
    const tree = buildTree(target, 0, depth);
    return [{ type: 'text', text: `Directory Tree: ${target}\n\n${tree || '(empty)'}` }];
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