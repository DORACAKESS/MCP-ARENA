#!/usr/bin/env node
import { createInterface } from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_NAME = 'memory-mcp';
const SERVER_VERSION = '1.0.0';
const MEMORY_FILE = path.join(__dirname, 'knowledge_graph.json');

function loadGraph() {
  try {
    if (fs.existsSync(MEMORY_FILE)) return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
  } catch {}
  return { entities: [], relations: [] };
}

function saveGraph(graph) {
  try {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(graph, null, 2), 'utf8');
  } catch {}
}

const TOOLS = [
  {
    name: 'create_entities',
    description: 'Create multiple new entities in the knowledge graph.',
    inputSchema: {
      type: 'object',
      properties: {
        entities: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Name of the entity' },
              entityType: { type: 'string', description: 'Category/type' },
              observations: { type: 'array', items: { type: 'string' }, description: 'Facts or observations' }
            },
            required: ['name', 'entityType', 'observations']
          }
        }
      },
      required: ['entities']
    }
  },
  {
    name: 'create_relations',
    description: 'Create relationships between existing entities in the graph.',
    inputSchema: {
      type: 'object',
      properties: {
        relations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              from: { type: 'string', description: 'Source entity name' },
              to: { type: 'string', description: 'Target entity name' },
              relationType: { type: 'string', description: 'Relationship type' }
            },
            required: ['from', 'to', 'relationType']
          }
        }
      },
      required: ['relations']
    }
  },
  {
    name: 'read_graph',
    description: 'Read the full knowledge graph.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'search_nodes',
    description: 'Search for entities in the graph by query substring.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keyword or entity name to search' }
      },
      required: ['query']
    }
  }
];

async function handleToolCall(name, args) {
  const graph = loadGraph();
  if (name === 'create_entities') {
    const list = args.entities || [];
    for (const e of list) {
      const existing = graph.entities.find(i => i.name.toLowerCase() === e.name.toLowerCase());
      if (existing) {
        existing.observations = Array.from(new Set([...existing.observations, ...(e.observations || [])]));
      } else {
        graph.entities.push({ name: e.name, entityType: e.entityType, observations: e.observations || [] });
      }
    }
    saveGraph(graph);
    return [{ type: 'text', text: `Saved ${list.length} entities to knowledge graph.` }];
  }
  if (name === 'create_relations') {
    const list = args.relations || [];
    for (const r of list) {
      graph.relations.push({ from: r.from, to: r.to, relationType: r.relationType });
    }
    saveGraph(graph);
    return [{ type: 'text', text: `Saved ${list.length} relations to knowledge graph.` }];
  }
  if (name === 'read_graph') {
    return [{ type: 'text', text: JSON.stringify(graph, null, 2) }];
  }
  if (name === 'search_nodes') {
    const q = (args.query || '').toLowerCase();
    const matches = graph.entities.filter(e => e.name.toLowerCase().includes(q) || e.entityType.toLowerCase().includes(q) || (e.observations || []).some(o => o.toLowerCase().includes(q)));
    return [{ type: 'text', text: JSON.stringify(matches, null, 2) }];
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