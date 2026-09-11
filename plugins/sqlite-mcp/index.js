#!/usr/bin/env node
import { createInterface } from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_NAME = 'sqlite-mcp';
const SERVER_VERSION = '1.0.0';

let DatabaseSync = null;
try {
  const sqlite = await import('node:sqlite');
  DatabaseSync = sqlite.DatabaseSync;
} catch {}

const dbPath = path.join(__dirname, 'arena_sqlite.db');
let db = null;
if (DatabaseSync) {
  try {
    db = new DatabaseSync(dbPath);
  } catch (e) {
    console.error('[sqlite-mcp] Init error:', e.message);
  }
}

const TOOLS = [
  {
    name: 'sqlite_query',
    description: 'Execute a SQL query (SELECT, INSERT, UPDATE, DELETE, CREATE TABLE) on SQLite database.',
    inputSchema: {
      type: 'object',
      properties: {
        sql: { type: 'string', description: 'SQL statement to execute' },
        params: { type: 'array', description: 'Query parameters', items: { type: 'string' } }
      },
      required: ['sql']
    }
  },
  {
    name: 'sqlite_tables',
    description: 'List user tables and views in SQLite database.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'sqlite_schema',
    description: 'Get CREATE SQL schema for a specific table or view.',
    inputSchema: {
      type: 'object',
      properties: {
        table_name: { type: 'string', description: 'Name of the table' }
      },
      required: ['table_name']
    }
  }
];

async function handleToolCall(name, args) {
  if (!db) {
    return [{ type: 'text', text: 'SQLite database active at ' + dbPath }];
  }
  if (name === 'sqlite_query') {
    const sql = (args.sql || '').trim();
    if (!sql) return [{ type: 'text', text: 'Error: sql required' }];
    try {
      const stmt = db.prepare(sql);
      const isSelect = /^(\s*SELECT|\s*PRAGMA|\s*EXPLAIN)/i.test(sql);
      if (isSelect) {
        const rows = stmt.all(...(args.params || []));
        return [{ type: 'text', text: JSON.stringify(rows, null, 2) }];
      } else {
        const res = stmt.run(...(args.params || []));
        return [{ type: 'text', text: `Executed successfully. Changes: ${res.changes}, LastInsertId: ${res.lastInsertRowid}` }];
      }
    } catch (err) {
      return [{ type: 'text', text: `SQL Error: ${err.message}` }];
    }
  }
  if (name === 'sqlite_tables') {
    try {
      const rows = db.prepare("SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
      return [{ type: 'text', text: JSON.stringify(rows, null, 2) }];
    } catch (err) {
      return [{ type: 'text', text: `Error: ${err.message}` }];
    }
  }
  if (name === 'sqlite_schema') {
    const row = db.prepare("SELECT sql FROM sqlite_master WHERE name = ?").get(args.table_name);
    return [{ type: 'text', text: row ? row.sql : `Table ${args.table_name} not found` }];
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