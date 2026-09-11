#!/usr/bin/env node
import { createInterface } from 'node:readline';
import os from 'node:os';

const SERVER_NAME = 'time-mcp';
const SERVER_VERSION = '1.0.0';

const TOOLS = [
  {
    name: 'get_current_time',
    description: 'Get current system time in ISO 8601, UTC, and local timezone formats.',
    inputSchema: {
      type: 'object',
      properties: {
        timezone: { type: 'string', description: 'Optional IANA timezone (e.g. America/New_York, UTC, Asia/Kolkata)' }
      }
    }
  },
  {
    name: 'get_system_info',
    description: 'Get operating system, CPU architecture, platform, and uptime diagnostics.',
    inputSchema: { type: 'object', properties: {} }
  }
];

async function handleToolCall(name, args) {
  if (name === 'get_current_time') {
    const d = new Date();
    const tz = args.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      dateStyle: 'full',
      timeStyle: 'long'
    }).format(d);
    return [{
      type: 'text',
      text: JSON.stringify({
        iso: d.toISOString(),
        timestamp: d.getTime(),
        timezone: tz,
        formatted: formatted
      }, null, 2)
    }];
  }
  if (name === 'get_system_info') {
    return [{
      type: 'text',
      text: JSON.stringify({
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        uptimeSeconds: Math.floor(os.uptime()),
        cpus: os.cpus().length,
        freeMemoryMB: Math.floor(os.freemem() / (1024 * 1024)),
        totalMemoryMB: Math.floor(os.totalmem() / (1024 * 1024))
      }, null, 2)
    }];
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