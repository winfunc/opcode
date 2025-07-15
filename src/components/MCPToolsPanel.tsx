/**
 * MCP Tools Panel Component
 * Interface for interacting with 186 MCP Gateway tools
 */

import { useState, useEffect } from 'react';
import { mcpGateway, MCPTool, MCPResponse } from '../lib/mcp-gateway';

export function MCPToolsPanel() {
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<MCPResponse | null>(null);
  const [selectedTool, setSelectedTool] = useState<string>('');

  useEffect(() => {
    initializeMCP();
  }, []);

  const initializeMCP = async () => {
    try {
      setLoading(true);
      await mcpGateway.connect();
      const availableTools = await mcpGateway.loadTools();
      setTools(availableTools);
      setIsConnected(true);
    } catch (error) {
      console.error('Failed to initialize MCP:', error);
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const executeTool = async (toolName: string, args: any = {}) => {
    try {
      setLoading(true);
      const result = await mcpGateway.executeTool(toolName, args);
      setResults(result);
    } catch (error) {
      console.error('Tool execution failed:', error);
      setResults({
        isError: true,
        content: [{ type: 'text', text: `Error: ${(error as any).message}` }]
      });
    } finally {
      setLoading(false);
    }
  };

  const testPlaywright = async () => {
    await executeTool('playwright', {
      action: 'navigate',
      url: 'http://localhost:1420',
      options: {
        waitUntil: 'networkidle',
        timeout: 30000
      }
    });
  };

  const testDesktopCommander = async () => {
    await executeTool('desktop-commander', {
      action: 'screenshot',
      path: '/tmp/claudia-desktop-test.png'
    });
  };

  const testBraveSearch = async () => {
    await executeTool('brave', {
      query: 'Claudia Claude Code Session Browser',
      count: 3
    });
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm border">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">MCP Gateway Tools</h2>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm text-gray-600">
            {isConnected ? `Connected (${tools.length} tools)` : 'Disconnected'}
          </span>
        </div>
      </div>

      {!isConnected && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-800">
            MCP Gateway not connected. Make sure it's running on port 8080.
          </p>
          <button 
            onClick={initializeMCP}
            className="mt-2 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
            disabled={loading}
          >
            {loading ? 'Connecting...' : 'Retry Connection'}
          </button>
        </div>
      )}

      {isConnected && (
        <>
          {/* Quick Test Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <button
              onClick={testPlaywright}
              disabled={loading}
              className="p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <div className="font-medium text-blue-900">Test Playwright MCP</div>
              <div className="text-sm text-blue-600">Navigate to Claudia with Chrome</div>
            </button>

            <button
              onClick={testDesktopCommander}
              disabled={loading}
              className="p-4 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
            >
              <div className="font-medium text-green-900">Test Desktop Commander</div>
              <div className="text-sm text-green-600">Take desktop screenshot</div>
            </button>

            <button
              onClick={testBraveSearch}
              disabled={loading}
              className="p-4 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
            >
              <div className="font-medium text-purple-900">Test Brave Search</div>
              <div className="text-sm text-purple-600">Search for Claudia info</div>
            </button>
          </div>

          {/* Tools List */}
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">Available Tools ({tools.length})</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {tools.map((tool) => (
                <button
                  key={tool.name}
                  onClick={() => setSelectedTool(tool.name)}
                  className={`p-2 text-xs border rounded ${
                    selectedTool === tool.name 
                      ? 'bg-blue-100 border-blue-300' 
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {tool.name}
                </button>
              ))}
            </div>
          </div>

          {/* Results Display */}
          {results && (
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-3">Results</h3>
              <div className={`p-4 rounded-lg border ${
                results.isError ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
              }`}>
                <pre className="text-sm overflow-auto max-h-64">
                  {JSON.stringify(results, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {loading && (
            <div className="mt-6 text-center">
              <div className="inline-flex items-center px-4 py-2 text-sm text-blue-600">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Executing tool...
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}