/**
 * MCP Gateway Client for Claudia
 * Connects to the Docker MCP Gateway (186 tools) via SSE
 */

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: unknown; // TODO: 실제 스키마 구조 파악 시 구체 타입 지정
}

export interface MCPRequest {
  method: string;
  params: {
    name: string;
    arguments?: unknown; // TODO: 실제 파라미터 구조 파악 시 구체 타입 지정
  };
}

export interface MCPResponse {
  content?: unknown[]; // TODO: 실제 응답 구조 파악 시 구체 타입 지정
  isError?: boolean;
  _meta?: unknown;
}

export class MCPGatewayClient {
  private baseUrl: string;
  private eventSource: EventSource | null = null;
  private tools: MCPTool[] = [];

  constructor(baseUrl = 'http://localhost:8080') {
    this.baseUrl = baseUrl;
  }

  /**
   * Initialize connection to MCP Gateway
   */
  async connect(): Promise<void> {
    try {
      // Test basic connectivity first
      const healthResponse = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (!healthResponse.ok) {
        console.warn('Health check failed, trying tools endpoint...');
        // If health fails, try tools endpoint
        const toolsResponse = await fetch(`${this.baseUrl}/tools`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(5000)
        });
        
        if (!toolsResponse.ok) {
          throw new Error(`MCP Gateway not accessible: ${toolsResponse.status}`);
        }
      }

      // Initialize SSE connection with retry logic
      this.initializeSSE();
      
      // Load available tools
      await this.loadTools();
      
      console.log('✅ Connected to MCP Gateway');
    } catch (error) {
      console.error('Failed to initialize MCP Gateway:', error);
      // Don't throw - allow graceful degradation
      console.warn('⚠️ MCP Gateway connection failed, some features may be limited');
    }
  }

  /**
   * Initialize SSE connection with error handling
   */
  private initializeSSE(): void {
    try {
      this.eventSource = new EventSource(`${this.baseUrl}/sse`);
      
      this.eventSource.onopen = () => {
        console.log('✅ SSE Connected to MCP Gateway');
      };

      this.eventSource.onerror = (error) => {
        console.error('❌ MCP Gateway SSE error:', error);
        // Auto-reconnect after delay
        setTimeout(() => {
          if (this.eventSource?.readyState === EventSource.CLOSED) {
            console.log('🔄 Attempting SSE reconnection...');
            this.initializeSSE();
          }
        }, 5000);
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 MCP Gateway message:', data);
        } catch (e) {
          console.warn('Invalid SSE message format');
        }
      };
    } catch (error) {
      console.error('SSE initialization failed:', error);
    }
  }

  /**
   * Load available tools from MCP Gateway
   */
  async loadTools(): Promise<MCPTool[]> {
    try {
      const request: MCPRequest = {
        method: 'tools/list',
        params: { name: 'list_tools' }
      };

      const response = await this.sendRequest(request);
      // 타입 안전성: unknown[] → MCPTool[] 변환
      if (Array.isArray(response.content)) {
        this.tools = response.content as MCPTool[];
      } else {
        this.tools = [];
      }
      return this.tools;
    } catch (error) {
      console.error('Failed to load MCP tools:', error);
      return [];
    }
  }

  /**
   * Get list of available tools
   */
  getTools(): MCPTool[] {
    return this.tools;
  }

  /**
   * Execute a tool with parameters
   */
  async executeTool(toolName: string, args: unknown = {}): Promise<MCPResponse> {
    try {
      const request: MCPRequest = {
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      };

      return await this.sendRequest(request);
    } catch (error) {
      console.error(`Failed to execute tool ${toolName}:`, error);
      return {
        isError: true,
        content: [{ type: 'text', text: `Error executing ${toolName}: ${(error as unknown as { message?: string }).message}` }]
      };
    }
  }

  /**
   * Send request to MCP Gateway
   */
  private async sendRequest(request: MCPRequest): Promise<MCPResponse> {
    const response = await fetch(`${this.baseUrl}/api/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`MCP request failed: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Disconnect from MCP Gateway
   */
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  /**
   * Test specific tools
   */
  async testPlaywrightMCP(): Promise<MCPResponse> {
    return await this.executeTool('playwright', {
      action: 'goto',
      url: 'http://localhost:1420',
      waitUntil: 'load'
    });
  }

  async testDesktopCommander(): Promise<MCPResponse> {
    return await this.executeTool('desktop-commander', {
      action: 'screenshot',
      path: '/tmp/desktop-test.png'
    });
  }

  async testBraveSearch(query: string): Promise<MCPResponse> {
    return await this.executeTool('brave', {
      query: query,
      count: 5
    });
  }
}

// Singleton instance
export const mcpGateway = new MCPGatewayClient();