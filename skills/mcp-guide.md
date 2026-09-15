# 🛠️ MCP Studio & Bridge — Complete AI Agent Skill & Protocol Guide

Welcome to the **MCP Studio & Bridge AI Agent Protocol Guide**. This document equips external AI models (**Arena.ai**, **Grok Projects**, **Claude Desktop**, **Cursor**, **ChatGPT**, and autonomous agents) with complete instructions, security guarantees, dynamic discovery protocols, and a full catalog of tools to inspect, modify, and build local software projects seamlessly.

---

## 🔒 Security & Trust Model (Human-in-the-Loop)

You are an **authorized pair programmer** collaborating directly with the human user on their local workspace.

1. **Safe Inspection Reads (Instantaneous)**:
   - Reading files (`read_file`), directory listings (`list_directory`, `file_tree`), workspace status (`list_workspaces`, `get_active_workspace`), and git inspections (`git_status`, `git_diff`) run in safe sandboxed mode without friction.
2. **Modifying Actions (Interactive Desktop Approval Queue)**:
   - Modifying actions—such as writing files (`write_file`), executing shell commands (`run_cmd`), deleting files (`delete_file`), or committing code (`git_commit`)—generate an audible and visual notification on the user's desktop dashboard.
   - **Do not hesitate to call `write_file` or `run_cmd`!** The user expects you to make edits and run terminal commands. The execution simply waits a few seconds while the user reviews your diff/command and clicks **Approve**.
3. **Protected Files**:
   - `.env` read access is blocked to safeguard sensitive user secrets (API keys, passwords). If you need to set environment variables, use `write_file` or terminal commands.

---

## 🌐 Dynamic Endpoint Resolution & Credential Persistence

Tunnels can reconnect or regenerate, so **never hardcode a temporary Cloudflare or SSH domain**.

### 1. Dynamic Discovery Endpoint (`/url`)
Query your assigned permanent URL with `/url`:
```bash
curl -s https://twofa-mcp-bridge-verificaton.onrender.com/u/<USER_ID>/url
```
*Output*: Plain text containing the live tunnel URL (e.g. `https://xxxx.trycloudflare.com` or `https://xxxx.lhr.life`).

### 2. Live Dynamic Tool Discovery Directly from the URL
To discover all tools currently active on the user's bridge (including any **custom MCP servers** or plugins enabled by the user, such as SQLite, GitHub, PostgreSQL, Docker, or Filesystem):
```bash
# Query the live tools list directly:
curl -s -X POST "<TUNNEL_URL>/mcp" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": "1", "method": "tools/list", "params": {}}'
```
*Or simply open/curl the discovery endpoint:*
```bash
curl -s "<TUNNEL_URL>/mcp/list"
```

### 3. Credential & Config Persistence for AI Agents
To avoid re-typing parameters or losing context across conversation turns, save your bridge configuration into local files in your working environment:

```bash
# Method A: Use mcp_tool.py automatic initializer:
python mcp_tool.py init "<TUNNEL_OR_DISCOVERY_URL>" "<RANDOM_ID>"

# Method B: Save manually into standard cache files:
echo "<TUNNEL_URL>" > .mcp_url
echo "<RANDOM_ID>" > .randomid
cat << 'EOF' > .mcp_config.json
{
  "url": "<TUNNEL_URL>",
  "discovery_url": "<PERMANENT_DISCOVERY_URL>",
  "random_id": "<RANDOM_ID>"
}
EOF
```
Once saved, `mcp_tool.py` and curl scripts read from `.mcp_config.json`, `.mcp_url`, and `.randomid` automatically!

---

## ⚡ 1-Command Python Tool Runner (`mcp_tool.py`)

We provide an official, zero-dependency Python helper script that completely eliminates JSON-RPC syntax errors and shell quoting problems.

### 📥 1-Liner Download:
```bash
curl -sO https://raw.githubusercontent.com/DORACAKESS/MCP-ARENA/main/skills/mcp_tool.py
```

### 🚀 Setup & Initialization:
```bash
# Initialize your connection (resolves permanent discovery URL and saves config):
python mcp_tool.py init "https://twofa-mcp-bridge-verificaton.onrender.com/u/<USER_ID>/url"
```

### 🛠️ Common Operations:
```bash
# 1. View all available tools (including custom user-enabled servers):
python mcp_tool.py tools

# 2. Workspace Management:
python mcp_tool.py list_workspaces
python mcp_tool.py get_active_workspace
python mcp_tool.py switch_workspace name="my-project"

# 3. Read Files & Directories (Sandboxed, Instant):
python mcp_tool.py read_file path="package.json"
python mcp_tool.py list_directory path="src"
python mcp_tool.py file_search query="*.ts"

# 4. Write Files (Requires User Desktop Approval):
python mcp_tool.py write_file path="README.md" content="Project Documentation"
# Writing large code files directly from a file:
python mcp_tool.py write_file path="src/server.js" --content-file=local_script.js
# Or pipe from stdin:
cat script.py | python mcp_tool.py write_file path="script.py"

# 5. Shell & Terminal Command Execution (Requires User Desktop Approval):
python mcp_tool.py run_cmd command="npm install"
python mcp_tool.py run_cmd command="npm test"
python mcp_tool.py run_cmd command="python -m unittest"

# 6. Git Operations:
python mcp_tool.py git_status
python mcp_tool.py git_diff
python mcp_tool.py git_commit message="feat: implemented core logic"
python mcp_tool.py git_push
```

---

## 📚 Complete Tools Catalog & Specification

Below is the complete reference of tools available in the MCP Bridge. Any custom MCP servers added by the user in the manager dashboard will also appear in `tools/list`.

### 1. Workspace Operations
| Tool Name | Parameters | Approval | Description |
| :--- | :--- | :--- | :--- |
| `list_workspaces` | `{}` | ⚡ Instant | Lists all configured project directories, active workspace, and folder paths. |
| `get_active_workspace` | `{}` | ⚡ Instant | Returns the current active workspace directory path. |
| `switch_workspace` | `{"name": "folder_or_name"}` | ⚡ Instant | Switches the active context to another workspace directory. |
| `create_workspace` | `{"name": "name", "path": "path"}` | ⚠️ Approval | Registers a new workspace folder into the manager. |

### 2. File System Operations
| Tool Name | Parameters | Approval | Description |
| :--- | :--- | :--- | :--- |
| `read_file` | `{"path": "rel/path.js"}` | ⚡ Instant | Reads and returns the complete text content of a file. |
| `write_file` | `{"path": "rel/path.js", "content": "..."}` | ⚠️ Approval | Creates or overwrites a file in the workspace. |
| `list_directory` | `{"path": "."}` | ⚡ Instant | Lists files, directories, sizes, and timestamps within a directory. |
| `create_directory` | `{"path": "src/components"}` | ⚠️ Approval | Creates a directory (including parent directories if needed). |
| `delete_file` | `{"path": "temp.log"}` | ⚠️ Approval | Deletes a file within the workspace. |
| `move_file` | `{"source": "a.txt", "destination": "b.txt"}` | ⚠️ Approval | Moves or renames a file or folder. |
| `file_search` | `{"query": "*.py"}` | ⚡ Instant | Fast glob search for files matching a filename pattern. |
| `search_in_files` | `{"query": "pattern", "path": "."}` | ⚡ Instant | Ripgrep-powered content search across all workspace files. |
| `file_tree` | `{"path": ".", "depth": 3}` | ⚡ Instant | Generates an indented ASCII tree view of the workspace hierarchy. |

### 3. Shell & Terminal Command Execution
| Tool Name | Parameters | Approval | Description |
| :--- | :--- | :--- | :--- |
| `run_cmd` / `run_command` | `{"command": "..."}` | ⚠️ Approval | Executes a terminal command in the active workspace. Returns stdout, stderr, and exit code. |

#### Advanced `run_cmd` Options:
- **Custom Shell**: `{"command": "Get-Process", "shell": "powershell"}` (supports `cmd`, `powershell`, `bash`, `python`).
- **Batch Execution**: Pass an array of commands to execute multiple steps sequentially:
  ```json
  {"command": [
    {"cmd": "npm run build", "shell": "cmd"},
    {"cmd": "npm test", "shell": "cmd"}
  ]}
  ```

### 4. Git Version Control Operations
| Tool Name | Parameters | Approval | Description |
| :--- | :--- | :--- | :--- |
| `git_status` | `{}` | ⚡ Instant | Returns current branch, untracked files, modified files, and staging status. |
| `git_diff` | `{"staged": false}` | ⚡ Instant | Returns git diff of working directory changes or staged changes. |
| `git_commit` | `{"message": "..."}` | ⚠️ Approval | Stages modified files and commits changes with the provided commit message. |
| `git_push` | `{}` | ⚠️ Approval | Pushes committed changes to the configured upstream git repository. |
| `git_log` | `{"count": 5}` | ⚡ Instant | Returns recent commit history (hash, author, date, message). |
| `git_branch` | `{}` | ⚡ Instant | Lists all local and remote branches. |
| `git_checkout` | `{"branch": "main"}` | ⚠️ Approval | Checks out or switches to the specified git branch. |

### 5. Live Preview & Telemetry
| Tool Name | Parameters | Approval | Description |
| :--- | :--- | :--- | :--- |
| `set_preview` | `{"url": "http://localhost:3000"}` or `{"filepath": "index.html"}` | ⚡ Instant | Updates the user's live dashboard preview tab with the current site or HTML file. |
| `get_preview_status` | `{}` | ⚡ Instant | Returns the current URL or file being rendered in the live preview tab. |

### 6. Dynamic & Custom MCP Plugins
When the human user enables additional MCP servers in their manager (e.g. SQLite, PostgreSQL, Brave Search, GitHub MCP, Memory MCP, Docker MCP), their tools are **automatically mounted and exposed via the exact same endpoint**.
- Always call `python mcp_tool.py tools` or query `tools/list` to discover all dynamic tools available!

---

## 📡 Raw JSON-RPC 2.0 Protocol (Alternative via curl)

If Python is not installed in your agent runtime, invoke tools directly using standard JSON-RPC 2.0 via `curl`:

```bash
# Example: Read a file
curl -s -X POST "<TUNNEL_URL>/mcp" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "req_001",
    "method": "tools/call",
    "params": {
      "name": "read_file",
      "arguments": { "path": "package.json" }
    }
  }'

# Example: Execute a shell command
curl -s -X POST "<TUNNEL_URL>/mcp" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "req_002",
    "method": "tools/call",
    "params": {
      "name": "run_cmd",
      "arguments": { "command": "git status" }
    }
  }'
```

---

## ❓ Frequently Asked Questions & Troubleshooting

### Q1: Why did my `run_cmd` or `write_file` take 5 to 10 seconds to finish?
**A**: Modifying tools trigger an **interactive security approval request** on the user's desktop dashboard. The human user receives an audio chime and visually approves the command or diff before execution proceeds. This is normal and ensures security.

### Q2: My tool call returned connection refused or 502/530. What should I do?
**A**: Public tunnels (Cloudflare / SSH) occasionally reconnect or failover to a backup provider.
Re-fetch the live URL from your permanent discovery endpoint:
```bash
curl -s https://twofa-mcp-bridge-verificaton.onrender.com/u/<USER_ID>/url
```
Update your `.mcp_url` and re-run your command. If using `mcp_tool.py`, it auto-recovers automatically!

### Q3: How do I know which directory my shell commands run in?
**A**: All commands execute in the root directory of the **currently active workspace**. You can check the active workspace at any time with `python mcp_tool.py get_active_workspace` or `python mcp_tool.py list_workspaces`.
