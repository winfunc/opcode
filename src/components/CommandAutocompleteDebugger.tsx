import React, { useEffect, useState } from 'react';
import { api, ClaudeCommand } from '../lib/api';
import { CommandAutocomplete } from './CommandAutocomplete';
import { Button } from './ui/button';
import { Card } from './ui/card';

/**
 * Debug component for testing CommandAutocomplete in isolation
 */
export const CommandAutocompleteDebugger: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCommand, setSelectedCommand] = useState<ClaudeCommand | null>(null);
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleSelect = (command: ClaudeCommand) => {
    setSelectedCommand(command);
    addLog(`Selected command: ${command.name}`);
  };

  // Initialize with some test commands
  const createTestCommands = async () => {
    addLog('Creating test commands...');
    try {
      const testCommands = [
        { name: 'deploy', content: '# Deploy script\ndeploy --production' },
        { name: 'test', content: '# Run tests\ntest --coverage' },
        { name: 'build', content: '# Build project\nbuild --optimize' },
      ];

      for (const cmd of testCommands) {
        try {
          await api.createClaudeCommand(cmd.name, cmd.content);
          addLog(`Created command: ${cmd.name}`);
        } catch (err) {
          const error = err as Error;
          if (error.message?.includes('already exists')) {
            addLog(`Command ${cmd.name} already exists`);
          } else {
            addLog(`Failed to create ${cmd.name}: ${error.message}`);
          }
        }
      }
    } catch (err) {
      const error = err as Error;
      addLog(`Error creating commands: ${error.message}`);
    }
  };

  useEffect(() => {
    createTestCommands();
  }, []);

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-4">Command Autocomplete Debugger</h2>

        <div className="space-y-4">
          {/* Controls */}
          <div className="flex gap-2 items-center">
            <Button onClick={() => setOpen(!open)} variant="outline">
              {open ? 'Close' : 'Open'} Autocomplete
            </Button>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search query..."
              className="px-3 py-2 border rounded-md flex-1"
            />
            <Button onClick={() => setLogs([])} variant="ghost">
              Clear Logs
            </Button>
          </div>

          {/* Autocomplete Component */}
          <div className="relative">
            <CommandAutocomplete
              trigger={
                <div className="border-2 border-dashed border-gray-300 rounded p-4 text-center cursor-pointer hover:border-gray-400">
                  Click here to trigger autocomplete (state: {open ? 'open' : 'closed'})
                </div>
              }
              onSelect={handleSelect}
              searchQuery={searchQuery}
              open={open}
            />
          </div>

          {/* Selected Command Display */}
          {selectedCommand && (
            <Card className="p-3 bg-blue-50">
              <h3 className="font-medium mb-2">Selected Command:</h3>
              <div className="space-y-1 text-sm">
                <div><strong>Name:</strong> {selectedCommand.name}</div>
                <div><strong>Content:</strong> <pre className="mt-1 p-2 bg-white rounded">{selectedCommand.content}</pre></div>
                <div><strong>Modified:</strong> {new Date(selectedCommand.modified_at).toLocaleString()}</div>
              </div>
            </Card>
          )}

          {/* Debug Logs */}
          <Card className="p-3">
            <h3 className="font-medium mb-2">Debug Logs:</h3>
            <div className="space-y-1 text-xs font-mono max-h-40 overflow-y-auto">
              {logs.map((log, i) => (
                <div key={i} className="text-gray-600">{log}</div>
              ))}
            </div>
          </Card>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold mb-2">Test Scenarios</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <span className="font-mono bg-gray-100 px-1">1.</span>
            <div>Click "Open Autocomplete" - should show command list</div>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-mono bg-gray-100 px-1">2.</span>
            <div>Type "dep" in search box - should filter to "deploy" command</div>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-mono bg-gray-100 px-1">3.</span>
            <div>Click a command - should select it and close autocomplete</div>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-mono bg-gray-100 px-1">4.</span>
            <div>In real usage, type "/" in FloatingPromptInput to trigger</div>
          </div>
        </div>
      </Card>
    </div>
  );
};
