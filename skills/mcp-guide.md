# 🛠️ MCP Bridge & Studio — AI Agent Skill & Protocol Guide

This skill guide provides external AI assistants (Arena.ai, Grok Projects, Claude, Cursor, ChatGPT) with complete instructions, security guarantees, and execution protocols for connecting to the local MCP Bridge.

---

## 🔒 Security & Trust Model (User Approval Queue)

The MCP Bridge operates with a strict, verifiable security sandboxing model:
1. **Safe Inspection**: Read operations (`list_workspaces`, `read_file`, `list_directory`, `git_status`) run in sandboxed read-only mode without prompt friction.
2. **User Approval Queue**: Any modifying action (`write_file`, `run_cmd`, file deletion, Git commit/push) generates a visual & audible notification on the user's desktop dashboard. Execution is blocked until the user reviews the exact diff/command and clicks **Approve**.
3. **No Unsanctioned Execution**: The agent cannot run background daemons or delete data without explicit real-time approval.

---

## 🌐 Dynamic Endpoint Resolution

Because public tunnels can reconnect or regenerate, **never hardcode a temporary Cloudflare or SSH domain**.

1. **Discovery Endpoint (Instant)**:
   Query your permanent URL with `/url`:
   ```bash
   curl -s https://twofa-mcp-bridge-verificaton.onrender.com/u/<USER_ID>/url
   ```
   *Response*: Plain text containing the live tunnel URL (e.g. `https://xxxx.trycloudflare.com`).

2. **Auto-Recovery**:
   If a tool call returns connection refused or HTTP error, re-fetch `<permanentUrl>/url` to retrieve the updated active endpoint.

---

## ⚡ 1-Command Python Tool Runner (`mcp_tool.py`)

To eliminate JSON-RPC syntax and shell quoting errors, use the official single-file Python helper:

### Download (1-liner):
```bash
curl -sO https://raw.githubusercontent.com/DORACAKESS/MCP-ARENA/main/skills/mcp_tool.py
```

### Usage:
```bash
# Set your tunnel URL (or pass via --url)
export MCP_URL="https://your-tunnel-url.trycloudflare.com"

# 1. List available tools
python mcp_tool.py tools/list

# 2. List workspaces
python mcp_tool.py list_workspaces

# 3. Read a workspace file
python mcp_tool.py read_file path="src/index.js"

# 4. Write or update a file (triggers approval queue)
python mcp_tool.py write_file path="README.md" content="Updated content"

# 5. Execute terminal commands (triggers approval queue)
python mcp_tool.py run_cmd command="npm test"
```

---

## 📡 Raw JSON-RPC 2.0 Protocol (Alternative via curl)

If Python is unavailable, you can invoke tools directly using standard JSON-RPC 2.0:

```bash
curl -X POST "<TUNNEL_URL>/mcp" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "'"$RANDOM"'",
    "method": "tools/call",
    "params": {
      "name": "read_file",
      "arguments": {
        "path": "package.json"
      }
    }
  }'
```

---

## 📚 Core Tools Reference

| Tool | Parameters | Description |
| :--- | :--- | :--- |
| `list_workspaces` | `{}` | Lists all active local project workspaces and directories. |
| `list_directory` | `{"path": "."}` | Lists directory tree files and folders. |
| `read_file` | `{"path": "file.txt"}` | Reads full contents of a file. |
| `write_file` | `{"path": "file.txt", "content": "..."}` | Writes or edits file (requires user approval). |
| `run_cmd` | `{"command": "..."}` | Executes a shell/terminal command (requires user approval). |
| `git_status` | `{}` | Checks git branch, modified files, and staging. |
| `git_commit` | `{"message": "..."}` | Commits staged changes to Git. |
