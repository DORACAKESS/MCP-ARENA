#!/usr/bin/env python3
"""
MCP Bridge Single-File Tool Runner
Lightweight, zero-dependency CLI client for external AI agents (Arena.ai, Grok, Claude, etc.).
"""
import sys
import os
import json
import uuid
import urllib.request
import urllib.error

def get_base_url():
    # 1. Check CLI flag --url
    for i, arg in enumerate(sys.argv):
        if arg == '--url' and i + 1 < len(sys.argv):
            return sys.argv[i + 1].rstrip('/')
        if arg.startswith('--url='):
            return arg.split('=', 1)[1].rstrip('/')
    # 2. Check environment variable
    if os.environ.get('MCP_URL'):
        return os.environ['MCP_URL'].rstrip('/')
    # 3. Check local cache file .mcp_url
    if os.path.exists('.mcp_url'):
        try:
            with open('.mcp_url', 'r') as f:
                u = f.read().strip()
                if u: return u.rstrip('/')
        except:
            pass
    return "http://127.0.0.1:4002"

def resolve_tunnel_url(url):
    # If given a permanent discovery url ending with /url, fetch the live tunnel endpoint
    if url.endswith('/url'):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'mcp-tool-client'})
            with urllib.request.urlopen(req, timeout=15) as res:
                resolved = res.read().decode('utf-8').strip()
                if resolved.startswith('http'):
                    return resolved.rstrip('/')
        except Exception as e:
            sys.stderr.write(f"[!] Failed to resolve discovery URL {url}: {e}\n")
    return url

def call_mcp(base_url, tool_name, arguments):
    target_endpoint = f"{base_url}/mcp" if not base_url.endswith('/mcp') else base_url
    payload = {
        "jsonrpc": "2.0",
        "id": str(uuid.uuid4())[:8],
        "method": "tools/call",
        "params": {
            "name": tool_name,
            "arguments": arguments
        }
    }
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        target_endpoint,
        data=data,
        headers={
            'Content-Type': 'application/json',
            'User-Agent': 'mcp-tool-python/1.0'
        },
        method='POST'
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = resp.read().decode('utf-8')
            res_json = json.loads(body)
            if 'result' in res_json:
                result = res_json['result']
                if isinstance(result, dict) and 'content' in result:
                    for item in result['content']:
                        if isinstance(item, dict) and 'text' in item:
                            print(item['text'])
                            return
                print(json.dumps(result, indent=2))
            elif 'error' in res_json:
                sys.stderr.write(f"MCP Error: {json.dumps(res_json['error'])}\n")
                sys.exit(1)
            else:
                print(body)
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8', errors='ignore')
        sys.stderr.write(f"HTTP {e.code} Error: {err_body}\n")
        sys.exit(1)
    except Exception as e:
        sys.stderr.write(f"Connection Error: {e}\n")
        sys.exit(1)

def list_tools(base_url):
    target_endpoint = f"{base_url}/mcp" if not base_url.endswith('/mcp') else base_url
    payload = {
        "jsonrpc": "2.0",
        "id": str(uuid.uuid4())[:8],
        "method": "tools/list",
        "params": {}
    }
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(target_endpoint, data=data, headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            res_json = json.loads(resp.read().decode('utf-8'))
            tools = res_json.get('result', {}).get('tools', [])
            print(f"Available Tools ({len(tools)}):")
            for t in tools:
                print(f" - {t.get('name')}: {t.get('description', '')}")
    except Exception as e:
        sys.stderr.write(f"Failed to list tools: {e}\n")
        sys.exit(1)

def main():
    raw_args = [a for a in sys.argv[1:] if not a.startswith('--url')]
    if not raw_args or raw_args[0] in ('-h', '--help', 'help'):
        print("Usage: python mcp_tool.py [--url <URL>] <tool_name> [param=value ...]")
        print("       python mcp_tool.py [--url <URL>] tools/list")
        sys.exit(0)

    base_url = resolve_tunnel_url(get_base_url())
    action = raw_args[0]

    if action in ('tools/list', 'list'):
        list_tools(base_url)
        return

    params = {}
    for item in raw_args[1:]:
        if '=' in item:
            k, v = item.split('=', 1)
            try:
                params[k] = json.loads(v)
            except:
                params[k] = v
        else:
            params['input'] = item

    call_mcp(base_url, action, params)

if __name__ == '__main__':
    main()
