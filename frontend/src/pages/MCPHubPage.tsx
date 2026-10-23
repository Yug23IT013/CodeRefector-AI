import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Terminal,
  Server,
  Play,
  Copy,
  Check,
  Code2,
  Database,
  Sparkles,
  ChevronRight,
  RefreshCw,
  Sliders,
  AlertTriangle,
} from 'lucide-react';
import {
  mcpApi,
  MCPStatusResponse,
  MCPToolItem,
  MCPResourceItem,
  MCPPromptItem,
  MCPExecuteResponse,
} from '../services/mcpApi';

export const MCPHubPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'config' | 'playground' | 'resources'>('config');
  const [configClient, setConfigClient] = useState<'claude' | 'cursor' | 'antigravity' | 'sse'>('claude');
  const [copied, setCopied] = useState(false);

  // Status & Data
  const [status, setStatus] = useState<MCPStatusResponse | null>(null);
  const [tools, setTools] = useState<MCPToolItem[]>([]);
  const [resources, setResources] = useState<MCPResourceItem[]>([]);
  const [prompts, setPrompts] = useState<MCPPromptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Playground state
  const [selectedTool, setSelectedTool] = useState<string>('analyze_code_snippet');
  const [toolInputs, setToolInputs] = useState<Record<string, any>>({
    file_path: 'app/utils.py',
    code: 'def execute_command(user_input):\n    return eval(user_input)\n',
  });
  const [executing, setExecuting] = useState(false);
  const [execResponse, setExecResponse] = useState<MCPExecuteResponse | null>(null);
  const [execDuration, setExecDuration] = useState<number | null>(null);
  const [activeResultView, setActiveResultView] = useState<'visual' | 'raw'>('visual');

  // Resource viewer modal state
  const [readingResource, setReadingResource] = useState<string | null>(null);
  const [resourceContent, setResourceContent] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [statusRes, toolsRes, resourcesRes, promptsRes] = await Promise.all([
        mcpApi.getStatus(),
        mcpApi.getTools(),
        mcpApi.getResources(),
        mcpApi.getPrompts(),
      ]);
      setStatus(statusRes);
      setTools(toolsRes);
      setResources(resourcesRes);
      setPrompts(promptsRes);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to MCP server endpoints.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const applyPreset = (presetName: string) => {
    if (presetName === 'sec001_eval') {
      setSelectedTool('analyze_code_snippet');
      setToolInputs({
        file_path: 'services/calculator.py',
        code: 'def compute(expr):\n    # Dangerous dynamic code execution\n    return eval(expr)\n',
      });
    } else if (presetName === 'js_xss') {
      setSelectedTool('analyze_code_snippet');
      setToolInputs({
        file_path: 'frontend/src/renderer.js',
        code: 'function renderUserContent(data) {\n    document.write("<div>" + data.bio + "</div>");\n}\n',
      });
    } else if (presetName === 'bug002_mutable') {
      setSelectedTool('analyze_code_snippet');
      setToolInputs({
        file_path: 'core/session.py',
        code: 'def create_user_session(user_id, permissions=[]):\n    permissions.append("read")\n    return {"id": user_id, "perms": permissions}\n',
      });
    } else if (presetName === 'rag_sql') {
      setSelectedTool('query_rag_knowledge');
      setToolInputs({
        query: 'SQL injection string formatting parameterized queries',
        top_k: 2,
        collection: 'rules',
      });
    } else if (presetName === 'explain_rule') {
      setSelectedTool('explain_rule');
      setToolInputs({
        rule_id: 'SEC001',
      });
    } else if (presetName === 'repo_health') {
      setSelectedTool('get_repo_health');
      setToolInputs({});
    }
  };

  const handleExecuteTool = async () => {
    try {
      setExecuting(true);
      const start = performance.now();
      const res = await mcpApi.executeTool(selectedTool, toolInputs);
      const elapsed = Math.round(performance.now() - start);
      setExecResponse(res);
      setExecDuration(elapsed);
    } catch (err: any) {
      setExecResponse({
        success: false,
        tool_name: selectedTool,
        arguments: toolInputs,
        raw_text: err.message,
        result: { error: err.message },
      });
    } finally {
      setExecuting(false);
    }
  };

  const handleReadResource = async (uri: string) => {
    try {
      setReadingResource(uri);
      const data = await mcpApi.readResource(uri);
      setResourceContent(data.data);
    } catch (err: any) {
      setResourceContent({ error: err.message });
    }
  };

  // Client configuration snippets
  const getClientConfig = () => {
    const cwd = 'E:\\CodeRefector-AI\\backend';
    const pythonExe = 'E:\\CodeRefector-AI\\backend\\.venv\\Scripts\\python.exe';

    switch (configClient) {
      case 'claude':
        return JSON.stringify(
          {
            mcpServers: {
              coderefactor: {
                command: pythonExe,
                args: ['-m', 'app.mcp.server', '--transport', 'stdio'],
                cwd: cwd,
              },
            },
          },
          null,
          2
        );
      case 'cursor':
        return JSON.stringify(
          {
            mcpServers: {
              'coderefactor-ai': {
                command: pythonExe,
                args: ['-m', 'app.mcp.server', '--transport', 'stdio'],
                cwd: cwd,
              },
            },
          },
          null,
          2
        );
      case 'antigravity':
        return JSON.stringify(
          {
            servers: {
              coderefactor: {
                command: pythonExe,
                args: ['-m', 'app.mcp.server', '--transport', 'stdio'],
                cwd: cwd,
              },
            },
          },
          null,
          2
        );
      case 'sse':
        return JSON.stringify(
          {
            mcpServers: {
              coderefactor_remote: {
                transport: 'sse',
                url: 'http://localhost:8000/mcp/sse',
              },
            },
          },
          null,
          2
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !status && (
        <div className="py-12 flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="w-6 h-6 text-brand-400 animate-spin" />
          <p className="text-xs text-slate-400">Loading MCP server inventory...</p>
        </div>
      )}
      {/* Top Banner / Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/70 to-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-6 -mr-6 w-56 h-56 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-brand-500/25">
                <Cpu className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Model Context Protocol (MCP) Hub
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Protocol v2024-11-05</span>
              </span>
            </div>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Expose CodeRefactor AI's AST static analysis engine, RAG knowledge vector store, and PR metrics to external AI agents in <strong>Claude Desktop</strong>, <strong>Cursor IDE</strong>, <strong>Antigravity IDE</strong>, and web agents.
            </p>
          </div>

          {/* Quick Metrics Badge Group */}
          <div className="flex items-center space-x-3 bg-slate-950/80 border border-slate-800 rounded-xl p-3 backdrop-blur-sm">
            <div className="text-center px-3 border-r border-slate-800">
              <div className="text-lg font-bold text-white">{status?.inventory.tools_count || 7}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Tools</div>
            </div>
            <div className="text-center px-3 border-r border-slate-800">
              <div className="text-lg font-bold text-purple-400">{status?.inventory.resources_count || 5}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Resources</div>
            </div>
            <div className="text-center px-3">
              <div className="text-lg font-bold text-sky-400">{status?.inventory.prompts_count || 3}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Prompts</div>
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-800 mt-6 -mb-2 space-x-2">
          <button
            onClick={() => setActiveTab('config')}
            className={`px-4 py-2.5 text-xs font-medium rounded-t-lg transition-all flex items-center space-x-2 border-b-2 ${
              activeTab === 'config'
                ? 'border-brand-400 text-white bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/20'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-brand-400" />
            <span>Client Setup & Config</span>
          </button>
          <button
            onClick={() => setActiveTab('playground')}
            className={`px-4 py-2.5 text-xs font-medium rounded-t-lg transition-all flex items-center space-x-2 border-b-2 ${
              activeTab === 'playground'
                ? 'border-brand-400 text-white bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/20'
            }`}
          >
            <Play className="w-3.5 h-3.5 text-emerald-400" />
            <span>Interactive Playground</span>
          </button>
          <button
            onClick={() => setActiveTab('resources')}
            className={`px-4 py-2.5 text-xs font-medium rounded-t-lg transition-all flex items-center space-x-2 border-b-2 ${
              activeTab === 'resources'
                ? 'border-brand-400 text-white bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/20'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-purple-400" />
            <span>Resources & Prompts</span>
          </button>
        </div>
      </div>

      {/* TAB 1: CLIENT SETUP & CONFIG */}
      {activeTab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-brand-400" />
                <span>Select Target Client</span>
              </h3>
              <p className="text-xs text-slate-400">
                Choose your AI assistant to generate configuration for local stdio or remote SSE connection.
              </p>

              <div className="space-y-2 pt-2">
                {[
                  { id: 'claude', name: 'Claude Desktop', desc: 'macOS & Windows Anthropic App', icon: '🧠' },
                  { id: 'cursor', name: 'Cursor IDE', desc: 'Editor integration via .cursor/mcp.json', icon: '⚡' },
                  { id: 'antigravity', name: 'Antigravity IDE', desc: 'Customization mcp_config.json', icon: '🚀' },
                  { id: 'sse', name: 'Remote / SSE Client', desc: 'Direct streamable HTTP endpoint', icon: '🌐' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setConfigClient(item.id as any)}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                      configClient === item.id
                        ? 'bg-slate-800/90 border-brand-500/50 shadow-sm'
                        : 'bg-slate-950/50 border-slate-800/70 hover:bg-slate-800/30'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">{item.icon}</span>
                      <div>
                        <div className="text-xs font-semibold text-white">{item.name}</div>
                        <div className="text-[11px] text-slate-400">{item.desc}</div>
                      </div>
                    </div>
                    {configClient === item.id && <ChevronRight className="w-4 h-4 text-brand-400" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3 text-xs text-slate-300">
              <h4 className="font-semibold text-white flex items-center space-x-2">
                <Server className="w-4 h-4 text-emerald-400" />
                <span>Active Server Endpoints</span>
              </h4>
              <div className="space-y-2 font-mono text-[11px]">
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                  <span className="text-slate-500 block text-[10px] uppercase">SSE Stream:</span>
                  <span className="text-emerald-400 select-all">http://localhost:8000/mcp/sse</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                  <span className="text-slate-500 block text-[10px] uppercase">Stdio Command:</span>
                  <span className="text-sky-300 select-all">python -m app.mcp.server --transport stdio</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
                    <Code2 className="w-4 h-4 text-purple-400" />
                    <span>
                      {configClient === 'claude' && 'claude_desktop_config.json'}
                      {configClient === 'cursor' && '.cursor/mcp.json'}
                      {configClient === 'antigravity' && 'mcp_config.json'}
                      {configClient === 'sse' && 'remote_sse_config.json'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Paste this into your client configuration file to activate CodeRefactor tools.
                  </p>
                </div>
                <button
                  onClick={() => handleCopy(getClientConfig())}
                  className="px-3 py-1.5 rounded-lg bg-brand-500/20 hover:bg-brand-500/30 text-brand-300 border border-brand-500/30 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy Config'}</span>
                </button>
              </div>

              <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
                <pre className="p-4 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed">
                  {getClientConfig()}
                </pre>
              </div>

              {/* Instructions steps */}
              <div className="border-t border-slate-800/80 pt-4 space-y-2">
                <h4 className="text-xs font-semibold text-slate-200">Installation Steps:</h4>
                <ol className="text-xs text-slate-400 space-y-1.5 list-decimal list-inside">
                  {configClient === 'claude' && (
                    <>
                      <li>Open Claude Desktop Settings → Developer → Edit Config.</li>
                      <li>Paste the JSON block into your <code className="text-brand-300">claude_desktop_config.json</code> file.</li>
                      <li>Restart Claude Desktop. The hammer icon will appear in the input box!</li>
                    </>
                  )}
                  {configClient === 'cursor' && (
                    <>
                      <li>Open Cursor Settings → Features → MCP Servers.</li>
                      <li>Add new server with command <code className="text-brand-300">python -m app.mcp.server</code> in backend directory.</li>
                      <li>In Cursor Composer or Chat, mention tools to analyze code directly.</li>
                    </>
                  )}
                  {configClient === 'antigravity' && (
                    <>
                      <li>Open <code className="text-brand-300">mcp_config.json</code> in your customization root.</li>
                      <li>Add the server block and save.</li>
                      <li>Antigravity AI will automatically discover all 7 tools and 5 resources.</li>
                    </>
                  )}
                  {configClient === 'sse' && (
                    <>
                      <li>Ensure FastAPI backend is running on port 8000.</li>
                      <li>Connect your remote client to <code className="text-emerald-300">http://localhost:8000/mcp/sse</code>.</li>
                      <li>Messages can be posted to <code className="text-emerald-300">http://localhost:8000/mcp/messages</code>.</li>
                    </>
                  )}
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INTERACTIVE PLAYGROUND */}
      {activeTab === 'playground' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls & Inputs */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-white uppercase tracking-wider">
                  Select Tool to Execute
                </label>
                <span className="text-[10px] text-slate-400">{tools.length} Tools Available</span>
              </div>

              <select
                value={selectedTool}
                onChange={(e) => {
                  setSelectedTool(e.target.value);
                  setExecResponse(null);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              >
                {tools.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>

              {/* Quick Presets */}
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-medium text-slate-400">Quick Test Presets:</div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => applyPreset('sec001_eval')}
                    className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700/80 text-[11px] text-slate-200 border border-slate-700/60 transition-colors"
                  >
                    ⚡ SEC001 (eval)
                  </button>
                  <button
                    onClick={() => applyPreset('js_xss')}
                    className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700/80 text-[11px] text-slate-200 border border-slate-700/60 transition-colors"
                  >
                    🛡️ JS XSS
                  </button>
                  <button
                    onClick={() => applyPreset('bug002_mutable')}
                    className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700/80 text-[11px] text-slate-200 border border-slate-700/60 transition-colors"
                  >
                    🐛 BUG002 (Default [])
                  </button>
                  <button
                    onClick={() => applyPreset('rag_sql')}
                    className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700/80 text-[11px] text-purple-300 border border-purple-500/30 transition-colors"
                  >
                    🧠 RAG: SQL Injection
                  </button>
                  <button
                    onClick={() => applyPreset('explain_rule')}
                    className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700/80 text-[11px] text-sky-300 border border-sky-500/30 transition-colors"
                  >
                    📖 Explain Rule
                  </button>
                  <button
                    onClick={() => applyPreset('repo_health')}
                    className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700/80 text-[11px] text-emerald-300 border border-emerald-500/30 transition-colors"
                  >
                    📊 Repo Health
                  </button>
                </div>
              </div>

              {/* Dynamic Form Inputs */}
              <div className="space-y-3 pt-2 border-t border-slate-800/80">
                {selectedTool === 'analyze_code_snippet' && (
                  <>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">File Path (with extension):</label>
                      <input
                        type="text"
                        value={toolInputs.file_path || ''}
                        onChange={(e) => setToolInputs({ ...toolInputs, file_path: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500"
                        placeholder="e.g. app/auth.py"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Code Snippet to Analyze:</label>
                      <textarea
                        rows={6}
                        value={toolInputs.code || ''}
                        onChange={(e) => setToolInputs({ ...toolInputs, code: e.target.value })}
                        className="w-full font-mono bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                        placeholder="Paste Python or JavaScript code here..."
                      />
                    </div>
                  </>
                )}

                {selectedTool === 'query_rag_knowledge' && (
                  <>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Natural Language Query:</label>
                      <input
                        type="text"
                        value={toolInputs.query || ''}
                        onChange={(e) => setToolInputs({ ...toolInputs, query: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500"
                        placeholder="e.g. dynamic code execution prevention"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Top K Results:</label>
                        <input
                          type="number"
                          value={toolInputs.top_k || 3}
                          onChange={(e) => setToolInputs({ ...toolInputs, top_k: parseInt(e.target.value) || 3 })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Collection:</label>
                        <select
                          value={toolInputs.collection || 'all'}
                          onChange={(e) => setToolInputs({ ...toolInputs, collection: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500"
                        >
                          <option value="all">All (Rules + History)</option>
                          <option value="rules">Rules Standards Only</option>
                          <option value="history">Historical Fixes Only</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}

                {selectedTool === 'explain_rule' && (
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Rule ID:</label>
                    <input
                      type="text"
                      value={toolInputs.rule_id || 'SEC001'}
                      onChange={(e) => setToolInputs({ ...toolInputs, rule_id: e.target.value.toUpperCase() })}
                      className="w-full uppercase font-mono bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500"
                      placeholder="e.g. SEC001, BUG002, PERF001"
                    />
                  </div>
                )}

                {selectedTool === 'get_repo_health' && (
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Repo ID (optional, leave empty for first repo):</label>
                    <input
                      type="number"
                      value={toolInputs.repo_id || ''}
                      onChange={(e) => setToolInputs({ ...toolInputs, repo_id: e.target.value ? parseInt(e.target.value) : undefined })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500"
                      placeholder="e.g. 1"
                    />
                  </div>
                )}

                {selectedTool === 'get_pr_findings' && (
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Pull Request ID:</label>
                    <input
                      type="number"
                      value={toolInputs.pr_id || 1}
                      onChange={(e) => setToolInputs({ ...toolInputs, pr_id: parseInt(e.target.value) || 1 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>
                )}

                {selectedTool === 'get_benchmark_metrics' && (
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Pull Request ID:</label>
                    <input
                      type="number"
                      value={toolInputs.pr_id || 1}
                      onChange={(e) => setToolInputs({ ...toolInputs, pr_id: parseInt(e.target.value) || 1 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>
                )}

                {selectedTool === 'run_review_on_diff' && (
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Git Diff Content:</label>
                    <textarea
                      rows={6}
                      value={toolInputs.diff || '+++ b/app/main.py\n@@ -1,2 +1,3 @@\n def run():\n+    eval(user_data)\n     return True\n'}
                      onChange={(e) => setToolInputs({ ...toolInputs, diff: e.target.value })}
                      className="w-full font-mono bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                )}

                {/* Execute Button */}
                <button
                  onClick={handleExecuteTool}
                  disabled={executing}
                  className="w-full mt-4 py-2.5 px-4 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 hover:from-brand-600 hover:to-indigo-700 text-white font-semibold text-xs shadow-lg shadow-brand-500/20 disabled:opacity-50 flex items-center justify-center space-x-2 transition-all"
                >
                  {executing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Executing via MCP...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      <span>Run Tool via MCP</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Results Viewer */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 min-h-[460px] flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-3">
                  <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                    MCP Execution Response
                  </h3>
                  {execDuration !== null && (
                    <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-emerald-400 font-mono">
                      {execDuration}ms
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-1.5 bg-slate-950 rounded-lg p-1 border border-slate-800">
                  <button
                    onClick={() => setActiveResultView('visual')}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                      activeResultView === 'visual'
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Visual
                  </button>
                  <button
                    onClick={() => setActiveResultView('raw')}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                      activeResultView === 'raw'
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Raw JSON
                  </button>
                </div>
              </div>

              {/* Response Body */}
              <div className="flex-1 pt-4">
                {!execResponse && !executing && (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
                    <Play className="w-8 h-8 mb-2 stroke-1 text-slate-600" />
                    <p className="text-xs">Select parameters and click "Run Tool via MCP" to view real-time output.</p>
                  </div>
                )}

                {executing && (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                    <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-slate-400">Processing MCP JSON-RPC call...</p>
                  </div>
                )}

                {execResponse && activeResultView === 'raw' && (
                  <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 h-full">
                    <pre className="p-4 text-xs font-mono text-emerald-300 overflow-auto max-h-[400px]">
                      {JSON.stringify(execResponse.result, null, 2)}
                    </pre>
                  </div>
                )}

                {execResponse && activeResultView === 'visual' && (
                  <div className="space-y-4">
                    {/* Findings List View */}
                    {Array.isArray(execResponse.result) && execResponse.result.length > 0 && (
                      <div className="space-y-3">
                        <div className="text-xs text-slate-300 font-semibold flex items-center justify-between">
                          <span>Flagged Findings ({execResponse.result.length})</span>
                          <span className="text-[11px] text-rose-400">Security / Quality Issues Detected</span>
                        </div>
                        {execResponse.result.map((item: any, i: number) => (
                          <div
                            key={i}
                            className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2 border-l-4 border-l-rose-500"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                  {item.rule_id}
                                </span>
                                <span className="text-xs text-white font-medium">
                                  {item.file_path}:{item.line_number}
                                </span>
                              </div>
                              <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider">
                                {item.severity}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300">{item.message}</p>
                            {item.code_snippet && (
                              <div className="bg-slate-900 rounded p-2 text-xs font-mono text-rose-200">
                                {item.code_snippet}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Single Object View (e.g. explain_rule, repo_health) */}
                    {!Array.isArray(execResponse.result) && execResponse.result && (
                      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
                        {execResponse.result.rule_id && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-bold text-white">
                                [{execResponse.result.rule_id}] {execResponse.result.title}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500/20 text-rose-300">
                                {execResponse.result.severity}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300">{execResponse.result.description}</p>
                            <div className="border-t border-slate-800/80 pt-2 space-y-2 text-xs">
                              <div>
                                <span className="text-emerald-400 font-semibold block mb-1">Recommended Fix:</span>
                                <p className="text-slate-300">{execResponse.result.remediation}</p>
                              </div>
                              {execResponse.result.example_bad && (
                                <div>
                                  <span className="text-rose-400 font-semibold block mb-0.5">Bad Example:</span>
                                  <pre className="bg-rose-950/20 border border-rose-900/40 p-2 rounded text-[11px] font-mono text-rose-200">
                                    {execResponse.result.example_bad}
                                  </pre>
                                </div>
                              )}
                              {execResponse.result.example_good && (
                                <div>
                                  <span className="text-emerald-400 font-semibold block mb-0.5">Good Example:</span>
                                  <pre className="bg-emerald-950/20 border border-emerald-900/40 p-2 rounded text-[11px] font-mono text-emerald-200">
                                    {execResponse.result.example_good}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {execResponse.result.health_score !== undefined && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-bold text-white">
                                {execResponse.result.repo_name}
                              </span>
                              <div className="flex items-center space-x-2">
                                <span className="text-2xl font-black text-emerald-400">
                                  {execResponse.result.health_score}
                                </span>
                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-300">
                                  Grade {execResponse.result.rating}
                                </span>
                              </div>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-center text-xs">
                              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                                <div className="text-rose-400 font-bold">{execResponse.result.open_findings_by_severity?.critical || 0}</div>
                                <div className="text-[10px] text-slate-400">Critical</div>
                              </div>
                              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                                <div className="text-amber-400 font-bold">{execResponse.result.open_findings_by_severity?.high || 0}</div>
                                <div className="text-[10px] text-slate-400">High</div>
                              </div>
                              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                                <div className="text-sky-400 font-bold">{execResponse.result.open_findings_by_severity?.medium || 0}</div>
                                <div className="text-[10px] text-slate-400">Medium</div>
                              </div>
                              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                                <div className="text-slate-300 font-bold">{execResponse.result.open_findings_by_severity?.low || 0}</div>
                                <div className="text-[10px] text-slate-400">Low</div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* RAG Results View */}
                        {execResponse.result.rules && (
                          <div className="space-y-3">
                            <span className="text-xs font-semibold text-purple-400">
                              Retrieved Vector Standards ({execResponse.result.rules.length})
                            </span>
                            {execResponse.result.rules.map((r: any, idx: number) => (
                              <div key={idx} className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs space-y-1">
                                <span className="font-semibold text-white">{r.id}</span>
                                <pre className="text-[11px] text-slate-300 whitespace-pre-wrap font-sans">
                                  {r.document}
                                </pre>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: RESOURCES & PROMPTS */}
      {activeTab === 'resources' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Resources */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
              <Database className="w-4 h-4 text-purple-400" />
              <span>Registered MCP Resources ({resources.length})</span>
            </h3>
            <p className="text-xs text-slate-400">
              URIs that external AI agents can read as persistent context without running executable code.
            </p>

            <div className="space-y-2.5">
              {resources.map((res, i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-mono font-semibold text-purple-300 select-all">
                      {res.uri}
                    </span>
                    <span className="block text-[11px] text-slate-400">
                      {res.type === 'static' ? 'Static Resource' : 'Parameterized Template'}
                    </span>
                  </div>
                  {res.type === 'static' && (
                    <button
                      onClick={() => handleReadResource(res.uri)}
                      className="px-2.5 py-1 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-xs font-medium border border-purple-500/30 transition-colors"
                    >
                      Read
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Inline Resource Viewer */}
            {readingResource && (
              <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">Preview: {readingResource}</span>
                  <button
                    onClick={() => {
                      setReadingResource(null);
                      setResourceContent(null);
                    }}
                    className="text-[11px] text-slate-500 hover:text-slate-300"
                  >
                    Close
                  </button>
                </div>
                <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono text-slate-200 max-h-48 overflow-auto">
                  {JSON.stringify(resourceContent, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Prompts */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-sky-400" />
              <span>MCP Prompt Templates ({prompts.length})</span>
            </h3>
            <p className="text-xs text-slate-400">
              Pre-engineered workflows that AI agents can trigger to invoke specialized reviews and audits.
            </p>

            <div className="space-y-3">
              {prompts.map((p, i) => (
                <div key={i} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-300 font-mono">{p.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                      {p.arguments.length} Arguments
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{p.description}</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {p.arguments.map((arg, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800 font-mono"
                      >
                        {arg.name} {arg.required ? '*' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
