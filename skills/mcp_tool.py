#!/usr/bin/env python3
"""
MCP Studio & Bridge CLI Client (mcp_tool.py)
------------------------------------------------------------
Lightweight, zero-dependency CLI tool runner for external AI agents
(Arena.ai, Grok Projects, Claude, Cursor, ChatGPT, etc.).

Features:
  - Zero external dependencies (uses standard library only)
  - Automatic configuration & credential persistence (.mcp_config.json, .mcp_url, .randomid)
  - Dynamic discovery URL resolution (/url endpoint auto-resolution & recovery)
  - Full tools catalog inspection (tools/list)
  - Seamless parameter parsing (key=value, JSON, files, stdin pipes)
  - Windows codepage safe (UTF-8 safe everywhere)
  - Clean stdout for AI agents and unix pipes
"""

import sys
import os
import json
import uuid
import time
import urllib.request
import urllib.error

# Ensure UTF-8 output on Windows consoles
if sys.platform == "win32":
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

CONFIG_FILE = ".mcp_config.json"
URL_CACHE_FILE = ".mcp_url"
ID_CACHE_FILE = ".randomid"

def load_stored_config():
    cfg = {
        "url": "",
        "discovery_url": "",
        "random_id": "",
        "user_id": ""
    }
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                saved = json.load(f)
                if isinstance(saved, dict):
                    cfg.update(saved)
        except Exception:
            pass

    if not cfg["url"] and os.path.exists(URL_CACHE_FILE):
        try:
            with open(URL_CACHE_FILE, "r", encoding="utf-8") as f:
                u = f.read().strip()
                if u:
                    cfg["url"] = u
        except Exception:
            pass

    if not cfg["random_id"] and os.path.exists(ID_CACHE_FILE):
        try:
            with open(ID_CACHE_FILE, "r", encoding="utf-8") as f:
                rid = f.read().strip()
                if rid:
                    cfg["random_id"] = rid
        except Exception:
            pass

    # Environment variables override
    if os.environ.get("MCP_URL"):
        cfg["url"] = os.environ["MCP_URL"].strip()
    if os.environ.get("MCP_RANDOM_ID") or os.environ.get("MCP_ID"):
        cfg["random_id"] = (os.environ.get("MCP_RANDOM_ID") or os.environ.get("MCP_ID")).strip()

    return cfg

def save_stored_config(url, random_id=None, discovery_url=None):
    cfg = load_stored_config()
    if url:
        cfg["url"] = url.rstrip('/')
    if discovery_url:
        cfg["discovery_url"] = discovery_url.rstrip('/')
    if random_id:
        cfg["random_id"] = str(random_id).strip()

    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2)
    except Exception as e:
        sys.stderr.write(f"[!] Warning saving {CONFIG_FILE}: {e}\n")

    try:
        with open(URL_CACHE_FILE, "w", encoding="utf-8") as f:
            f.write(cfg["url"] + "\n")
    except Exception:
        pass

    if cfg.get("random_id"):
        try:
            with open(ID_CACHE_FILE, "w", encoding="utf-8") as f:
                f.write(cfg["random_id"] + "\n")
        except Exception:
            pass

def resolve_discovery_endpoint(discovery_url):
    """Fetches the live active tunnel endpoint from a permanent discovery URL ending in /url."""
    clean_url = discovery_url.strip()
    if not clean_url.endswith('/url'):
        clean_url = clean_url.rstrip('/') + '/url'

    try:
        req = urllib.request.Request(
            clean_url,
            headers={"User-Agent": "mcp-tool-python/2.0"}
        )
        with urllib.request.urlopen(req, timeout=20) as res:
            body = res.read().decode("utf-8").strip()
            if body.startswith("http://") or body.startswith("https://"):
                return body.rstrip('/')
            try:
                j = json.loads(body)
                if isinstance(j, dict) and j.get("tunnelUrl"):
                    return j["tunnelUrl"].rstrip('/')
            except Exception:
                pass
    except Exception as e:
        sys.stderr.write(f"[!] Discovery resolution warning for {clean_url}: {e}\n")

    return None

def get_effective_urls():
    """Returns (active_mcp_url, discovery_url, random_id) using CLI flags, env, and config files."""
    cfg = load_stored_config()
    cli_url = None
    cli_id = None

    for i, arg in enumerate(sys.argv):
        if arg == '--url' and i + 1 < len(sys.argv):
            cli_url = sys.argv[i + 1].strip()
        elif arg.startswith('--url='):
            cli_url = arg.split('=', 1)[1].strip()
        elif arg in ('--id', '--random-id') and i + 1 < len(sys.argv):
            cli_id = sys.argv[i + 1].strip()
        elif arg.startswith('--id=') or arg.startswith('--random-id='):
            cli_id = arg.split('=', 1)[1].strip()

    target_url = cli_url or cfg.get("url") or "http://127.0.0.1:4002"
    random_id = cli_id or cfg.get("random_id") or ""
    discovery_url = cfg.get("discovery_url") or ""

    # If the user passed a permanent URL with /url or /u/...
    if target_url.endswith('/url') or ('/u/' in target_url and not target_url.endswith('/mcp')):
        discovery_url = target_url
        resolved = resolve_discovery_endpoint(target_url)
        if resolved:
            target_url = resolved
            save_stored_config(target_url, random_id=random_id, discovery_url=discovery_url)

    return target_url.rstrip('/'), discovery_url, random_id

def send_rpc_request(base_url, method, params, random_id=None, retry_discovery=None):
    target_endpoint = f"{base_url}/mcp" if not base_url.endswith('/mcp') else base_url
    rpc_id = f"cli_{uuid.uuid4().hex[:8]}"
    payload = {
        "jsonrpc": "2.0",
        "id": rpc_id,
        "method": method,
        "params": params or {}
    }
    if random_id and "randomId" not in payload["params"]:
        payload["params"]["randomId"] = random_id

    headers = {
        "Content-Type": "application/json",
        "User-Agent": "mcp-cli-client/2.0"
    }
    if random_id:
        headers["x-random-id"] = str(random_id)

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(target_endpoint, data=data, headers=headers, method="POST")

    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body)
    except (urllib.error.URLError, urllib.error.HTTPError, ConnectionError) as e:
        # Auto-recovery if discovery URL is available
        if retry_discovery:
            sys.stderr.write(f"[!] Connection failed ({e}). Attempting auto-recovery via discovery URL...\n")
            new_url = resolve_discovery_endpoint(retry_discovery)
            if new_url and new_url != base_url:
                sys.stderr.write(f"[+] Re-connected to updated tunnel endpoint: {new_url}\n")
                save_stored_config(new_url, random_id=random_id, discovery_url=retry_discovery)
                return send_rpc_request(new_url, method, params, random_id=random_id, retry_discovery=None)
        raise e

def list_tools(base_url, random_id=None, discovery_url=None):
    try:
        res = send_rpc_request(base_url, "tools/list", {}, random_id=random_id, retry_discovery=discovery_url)
    except Exception as e:
        sys.stderr.write(f"Failed to list tools from {base_url}: {e}\n")
        sys.exit(1)

    tools = res.get("result", {}).get("tools", [])
    if not tools and "result" in res and isinstance(res["result"], list):
        tools = res["result"]

    print(f"\nMCP Bridge Active Tools Catalog ({len(tools)} tools available)")
    print(f"Target Endpoint: {base_url}/mcp\n" + "=" * 70)

    modifying_tools = {"write_file", "run_cmd", "run_command", "delete_file", "git_commit", "git_push", "create_workspace"}

    for t in tools:
        name = t.get("name", "unknown")
        desc = t.get("description", "No description provided.")
        schema = t.get("inputSchema", {})
        props = schema.get("properties", {})
        required = schema.get("required", [])

        is_modifying = name in modifying_tools or "write" in name or "run" in name or "exec" in name or "delete" in name
        badge = " [Requires Desktop Approval]" if is_modifying else " [Sandboxed Safe Read]"

        print(f"\n> {name}{badge}")
        print(f"  {desc}")
        if props:
            arg_list = []
            for k, v in props.items():
                req_marker = "*" if k in required else ""
                arg_list.append(f"{k}{req_marker} ({v.get('type', 'any')})")
            print(f"  Args: {', '.join(arg_list)}")

    print("\n" + "=" * 70)
    print("Tip: Run any tool with: python mcp_tool.py <tool_name> param1=value param2=value")
    print("Example: python mcp_tool.py run_cmd command=\"npm test\"\n")

def call_tool(base_url, tool_name, arguments, random_id=None, discovery_url=None):
    target_tool = tool_name
    if tool_name == "run_command":
        target_tool = "run_cmd"

    payload_params = {
        "name": target_tool,
        "arguments": arguments
    }

    try:
        res = send_rpc_request(base_url, "tools/call", payload_params, random_id=random_id, retry_discovery=discovery_url)
    except urllib.error.HTTPError as e:
        err_text = e.read().decode("utf-8", errors="ignore")
        sys.stderr.write(f"HTTP {e.code} Error: {err_text}\n")
        sys.exit(1)
    except Exception as e:
        sys.stderr.write(f"Execution Error: {e}\n")
        sys.exit(1)

    if "error" in res:
        err_msg = res["error"]
        sys.stderr.write(f"MCP RPC Error: {json.dumps(err_msg, indent=2)}\n")
        sys.exit(1)

    result = res.get("result", {})
    if isinstance(result, dict) and "content" in result:
        for item in result["content"]:
            if isinstance(item, dict) and "text" in item:
                print(item["text"])
                return
    if isinstance(result, str):
        print(result)
    else:
        print(json.dumps(result, indent=2))

def parse_cli_arguments(args_list):
    parsed = {}
    for item in args_list:
        if item.startswith("--file=") or item.startswith("--content-file="):
            filepath = item.split("=", 1)[1]
            if os.path.exists(filepath):
                with open(filepath, "r", encoding="utf-8") as f:
                    parsed["content"] = f.read()
            else:
                sys.stderr.write(f"[!] Warning: File {filepath} not found.\n")
        elif item.startswith("-d=") or item.startswith("--args="):
            json_blob = item.split("=", 1)[1]
            try:
                parsed.update(json.loads(json_blob))
            except Exception as e:
                sys.stderr.write(f"[!] Invalid JSON in --args: {e}\n")
        elif "=" in item:
            k, v = item.split("=", 1)
            if v.lower() == "true":
                parsed[k] = True
            elif v.lower() == "false":
                parsed[k] = False
            elif v.isdigit():
                parsed[k] = int(v)
            elif (v.startswith("{") and v.endswith("}")) or (v.startswith("[") and v.endswith("]")):
                try:
                    parsed[k] = json.loads(v)
                except Exception:
                    parsed[k] = v
            else:
                parsed[k] = v
        else:
            if "command" not in parsed and "path" not in parsed:
                parsed["input"] = item

    if not sys.stdin.isatty():
        piped_input = sys.stdin.read()
        if piped_input:
            if "content" not in parsed and ("path" in parsed or len(args_list) > 0 and args_list[0] == "write_file"):
                parsed["content"] = piped_input
            elif "command" not in parsed and len(args_list) > 0 and args_list[0] in ("run_cmd", "run_command"):
                parsed["command"] = piped_input

    return parsed

def print_help():
    print("""
MCP Bridge CLI Tool Runner (mcp_tool.py)
========================================================================
Usage:
  python mcp_tool.py init <TUNNEL_OR_PERMANENT_URL> [RANDOM_ID]
  python mcp_tool.py tools                           (List all available tools)
  python mcp_tool.py <TOOL_NAME> [KEY=VALUE ...]    (Execute any MCP tool)

Commands & Examples:
  # 1. Initialize & Save Connection (saved in .mcp_config.json & .mcp_url):
  python mcp_tool.py init https://xxx.trycloudflare.com
  python mcp_tool.py init https://twofa-mcp-bridge-verificaton.onrender.com/u/usr_12345/url

  # 2. View All Available Tools & Schemas:
  python mcp_tool.py tools

  # 3. Workspace Operations:
  python mcp_tool.py list_workspaces
  python mcp_tool.py switch_workspace name="my-project"

  # 4. File Reading & Inspection (Sandboxed, Instant):
  python mcp_tool.py read_file path="package.json"
  python mcp_tool.py list_directory path="src"

  # 5. File Writing (Triggers User Approval Queue on Desktop):
  python mcp_tool.py write_file path="README.md" content="Project documentation"
  python mcp_tool.py write_file path="server.js" --content-file=local_script.js
  cat build.log | python mcp_tool.py write_file path="build.log"

  # 6. Shell & Command Execution (Triggers User Approval Queue on Desktop):
  python mcp_tool.py run_cmd command="npm test"
  python mcp_tool.py run_cmd command="git status"

  # 7. Git Operations:
  python mcp_tool.py git_status
  python mcp_tool.py git_commit message="feat: add user authentication"

Options:
  --url=<URL>        Override target tunnel URL for this command
  --id=<ID>          Override random identifier for this command
  --file=<PATH>      Load file content directly into parameters
========================================================================
""")

def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help", "help"):
        print_help()
        sys.exit(0)

    raw_args = [a for a in sys.argv[1:] if not a.startswith("--url") and not a.startswith("--id")]
    if not raw_args:
        print_help()
        sys.exit(0)

    action = raw_args[0]

    # Command: init / setup / config
    if action in ("init", "setup", "config"):
        if len(raw_args) < 2:
            sys.stderr.write("Usage: python mcp_tool.py init <TUNNEL_OR_PERMANENT_URL> [RANDOM_ID]\n")
            sys.exit(1)
        input_url = raw_args[1].strip()
        input_id = raw_args[2].strip() if len(raw_args) > 2 else ""

        discovery_url = ""
        resolved_url = input_url
        if input_url.endswith("/url") or ("/u/" in input_url and not input_url.endswith("/mcp")):
            discovery_url = input_url
            print(f"[*] Resolving permanent discovery URL: {input_url}...")
            res = resolve_discovery_endpoint(input_url)
            if res:
                resolved_url = res
                print(f"[+] Resolved live endpoint: {resolved_url}")
            else:
                print(f"[!] Warning: Could not resolve live endpoint immediately. Saving discovery endpoint.")

        save_stored_config(resolved_url, random_id=input_id, discovery_url=discovery_url)
        print(f"[+] Configuration successfully saved to {CONFIG_FILE}, {URL_CACHE_FILE}, and {ID_CACHE_FILE}!")
        print(f"    Target MCP URL: {resolved_url}")
        if input_id:
            print(f"    Random ID:      {input_id}")
        print("\nTest your connection now with:\n  python mcp_tool.py tools")
        sys.exit(0)

    base_url, discovery_url, random_id = get_effective_urls()

    # Command: tools / list / tools/list
    if action in ("tools", "list", "tools/list"):
        list_tools(base_url, random_id=random_id, discovery_url=discovery_url)
        sys.exit(0)

    # Command: call <tool_name> [args] OR direct <tool_name> [args]
    if action == "call":
        if len(raw_args) < 2:
            sys.stderr.write("Usage: python mcp_tool.py call <TOOL_NAME> [KEY=VALUE ...]\n")
            sys.exit(1)
        tool_name = raw_args[1]
        tool_args = parse_cli_arguments(raw_args[2:])
    else:
        tool_name = action
        tool_args = parse_cli_arguments(raw_args[1:])

    call_tool(base_url, tool_name, tool_args, random_id=random_id, discovery_url=discovery_url)

if __name__ == "__main__":
    main()
