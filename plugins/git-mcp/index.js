#!/usr/bin/env node
import { createInterface } from 'node:readline';
import { execSync } from 'node:child_process';

const SERVER_NAME = 'git-mcp';
const SERVER_VERSION = '1.0.0';

const TOOLS = [
  {
    name: 'git_status_quick',
    description: 'Get git status in short format for the active project.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'git_recent_commits',
    description: 'Get list of recent commits with hash, author, date, and message.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max commits to return (default: 10)' }
      }
    }
  },
  {
    name: 'git_diff_summary',
    description: 'Get summary of uncommitted changes and diff stat.',
    inputSchema: { type: 'object', properties: {} }
  }
];

function runGit(cmd) {
  try {
    return execSync('git ' + cmd, { encoding: 'utf8', timeout: 15000, windowsHide: true });
  } catch (e) {
    return 'Git command note: ' + (e.stdout || e.message);
  }
}

async function handleToolCall(name, args) {
  if (name === 'git_status_quick') {
    return [{ type: 'text', text: runGit('status --short --branch') || '(clean working tree)' }];
  }
  if (name === 'git_recent_commits') {
    const limit = args.limit || 10;
    return [{ type: 'text', text: runGit(`log -${limit} --pretty=format:"%h - %an (%ar): %s"`) }];
  }
  if (name === 'git_diff_summary') {
    return [{ type: 'text', text: runGit('diff --stat') || '(no uncommitted file modifications)' }];
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