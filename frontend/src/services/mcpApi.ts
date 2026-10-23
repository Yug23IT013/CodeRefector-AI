export interface MCPTransportInfo {
  available: boolean;
  command?: string;
  endpoint?: string;
  messages_endpoint?: string;
  client_examples: string[];
}

export interface MCPStatusResponse {
  status: string;
  service: string;
  version: string;
  protocol_version: string;
  transports: {
    stdio: MCPTransportInfo;
    sse: MCPTransportInfo;
  };
  inventory: {
    tools_count: number;
    resources_count: number;
    prompts_count: number;
  };
}

export interface MCPToolItem {
  name: string;
  description: string;
  input_schema: {
    type?: string;
    properties?: Record<string, { type?: string; description?: string; title?: string }>;
    required?: string[];
  };
}

export interface MCPResourceItem {
  type: 'static' | 'template';
  name: string;
  uri: string;
  description?: string;
}

export interface MCPPromptItem {
  name: string;
  description: string;
  arguments: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface MCPExecuteResponse {
  success: boolean;
  tool_name: string;
  arguments: Record<string, any>;
  raw_text: string;
  result: any;
}

const API_BASE = '/api/v1/mcp';

async function fetchMCP<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('AUTH_TOKEN') || localStorage.getItem('DASHBOARD_API_TOKEN');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const err = await response.json();
      errorDetail = err.detail || err.message || errorDetail;
    } catch {
      // ignore JSON parse error
    }
    throw new Error(`MCP API Error (${response.status}): ${errorDetail}`);
  }

  return response.json();
}

export const mcpApi = {
  getStatus(): Promise<MCPStatusResponse> {
    return fetchMCP<MCPStatusResponse>('/status');
  },

  getTools(): Promise<MCPToolItem[]> {
    return fetchMCP<MCPToolItem[]>('/tools');
  },

  getResources(): Promise<MCPResourceItem[]> {
    return fetchMCP<MCPResourceItem[]>('/resources');
  },

  getPrompts(): Promise<MCPPromptItem[]> {
    return fetchMCP<MCPPromptItem[]>('/prompts');
  },

  executeTool(toolName: string, args: Record<string, any>): Promise<MCPExecuteResponse> {
    return fetchMCP<MCPExecuteResponse>('/execute', {
      method: 'POST',
      body: JSON.stringify({
        tool_name: toolName,
        arguments: args,
      }),
    });
  },

  readResource(uri: string): Promise<{ uri: string; mime_type: string; data: any }> {
    return fetchMCP<{ uri: string; mime_type: string; data: any }>(
      `/read-resource?uri=${encodeURIComponent(uri)}`
    );
  },

  generatePrompt(promptName: string, args: Record<string, any>): Promise<{
    prompt_name: string;
    arguments: Record<string, any>;
    messages: Array<{ role: string; content: string }>;
  }> {
    return fetchMCP('/generate-prompt', {
      method: 'POST',
      body: JSON.stringify({
        prompt_name: promptName,
        arguments: args,
      }),
    });
  },
};
