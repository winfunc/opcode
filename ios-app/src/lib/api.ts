import axios, { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io, Socket } from 'socket.io-client';
import SSHManager from './ssh';

// API Types
export interface Session {
  id: string;
  name: string;
  project_id: string;
  created_at: string;
  updated_at: string;
  is_running: boolean;
  last_output?: string;
}

export interface Agent {
  id: number;
  name: string;
  description: string;
  prompt: string;
  is_system: boolean;
  allow_file_create: boolean;
  allow_file_delete: boolean;
  allow_file_edit: boolean;
  allow_code_execution: boolean;
  allow_network_access: boolean;
  created_at: string;
  updated_at: string;
}

export interface MCPServer {
  id: number;
  name: string;
  command: string;
  args: string;
  env: string;
  is_default: boolean;
  is_enabled: boolean;
}

export interface SlashCommand {
  id: number;
  name: string;
  description: string;
  content: string;
  is_enabled: boolean;
}

export interface UsageStats {
  date: string;
  input_tokens: number;
  output_tokens: number;
  model: string;
  cost: number;
}

export interface Settings {
  api_key: string;
  theme: 'light' | 'dark' | 'system';
  auto_save: boolean;
  notifications: boolean;
}

export interface ProcessOutput {
  type: 'stdout' | 'stderr' | 'system' | 'exit';
  content: string;
  timestamp?: string;
}

// API Client
class ClaudiaAPIClient {
  private axiosInstance: AxiosInstance;
  private socket: Socket | null = null;
  private serverURL: string = '';
  private isSSH: boolean = false;

  constructor() {
    this.axiosInstance = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async initialize() {
    const savedURL = await AsyncStorage.getItem('serverURL');
    if (savedURL) {
      await this.setServerURL(savedURL);
    }
  }

  async setServerURL(url: string) {
    this.serverURL = url;
    this.isSSH = url.includes('@') && url.includes(':');
    
    if (this.isSSH) {
      // Parse SSH connection and create tunnel
      const sshConfig = SSHManager.parseSSHURL(url);
      if (!sshConfig) {
        throw new Error('Invalid SSH URL format');
      }
      
      // For SSH connections, we need to handle this differently
      // Store the config for later connection
      await AsyncStorage.setItem('sshConfig', JSON.stringify(sshConfig));
      
      // For now, we'll use a placeholder URL
      // The actual connection will be established when needed
      this.axiosInstance.defaults.baseURL = 'http://localhost:8080';
    } else {
      this.axiosInstance.defaults.baseURL = url;
    }
    
    await AsyncStorage.setItem('serverURL', url);
    
    // Reconnect WebSocket if needed
    if (this.socket) {
      this.disconnect();
      this.connect();
    }
  }

  connect() {
    if (!this.serverURL) {
      throw new Error('Server URL not set');
    }

    const socketURL = this.isSSH ? 'http://localhost:8080' : this.serverURL;
    
    this.socket = io(socketURL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  // Session Management
  async getSessions(): Promise<Session[]> {
    const response = await this.axiosInstance.get('/api/sessions');
    return response.data;
  }

  async createSession(args: string[]): Promise<{ id: string }> {
    const response = await this.axiosInstance.post('/api/sessions', { args });
    return response.data;
  }

  async resumeSession(sessionId: string): Promise<{ success: boolean }> {
    const response = await this.axiosInstance.post(`/api/sessions/${sessionId}/resume`);
    return response.data;
  }

  async stopSession(sessionId: string): Promise<{ success: boolean }> {
    const response = await this.axiosInstance.post(`/api/sessions/${sessionId}/stop`);
    return response.data;
  }

  async sendInput(sessionId: string, input: string): Promise<{ success: boolean }> {
    const response = await this.axiosInstance.post(`/api/sessions/${sessionId}/input`, { input });
    return response.data;
  }

  // Agent Management
  async getAgents(): Promise<Agent[]> {
    const response = await this.axiosInstance.get('/api/agents');
    return response.data;
  }

  async createAgent(agent: Omit<Agent, 'id' | 'created_at' | 'updated_at'>): Promise<Agent> {
    const response = await this.axiosInstance.post('/api/agents', agent);
    return response.data;
  }

  async updateAgent(id: number, agent: Partial<Agent>): Promise<Agent> {
    const response = await this.axiosInstance.put(`/api/agents/${id}`, agent);
    return response.data;
  }

  async deleteAgent(id: number): Promise<{ success: boolean }> {
    const response = await this.axiosInstance.delete(`/api/agents/${id}`);
    return response.data;
  }

  async runAgent(id: number, prompt: string): Promise<{ execution_id: number }> {
    const response = await this.axiosInstance.post(`/api/agents/${id}/run`, { prompt });
    return response.data;
  }

  // MCP Server Management
  async getMCPServers(): Promise<MCPServer[]> {
    const response = await this.axiosInstance.get('/api/mcp-servers');
    return response.data;
  }

  async createMCPServer(server: Omit<MCPServer, 'id'>): Promise<MCPServer> {
    const response = await this.axiosInstance.post('/api/mcp-servers', server);
    return response.data;
  }

  async updateMCPServer(id: number, server: Partial<MCPServer>): Promise<MCPServer> {
    const response = await this.axiosInstance.put(`/api/mcp-servers/${id}`, server);
    return response.data;
  }

  async deleteMCPServer(id: number): Promise<{ success: boolean }> {
    const response = await this.axiosInstance.delete(`/api/mcp-servers/${id}`);
    return response.data;
  }

  // Slash Commands
  async getSlashCommands(): Promise<SlashCommand[]> {
    const response = await this.axiosInstance.get('/api/slash-commands');
    return response.data;
  }

  async createSlashCommand(command: Omit<SlashCommand, 'id'>): Promise<SlashCommand> {
    const response = await this.axiosInstance.post('/api/slash-commands', command);
    return response.data;
  }

  async updateSlashCommand(id: number, command: Partial<SlashCommand>): Promise<SlashCommand> {
    const response = await this.axiosInstance.put(`/api/slash-commands/${id}`, command);
    return response.data;
  }

  async deleteSlashCommand(id: number): Promise<{ success: boolean }> {
    const response = await this.axiosInstance.delete(`/api/slash-commands/${id}`);
    return response.data;
  }

  // Usage Analytics
  async getUsageStats(startDate?: string, endDate?: string): Promise<UsageStats[]> {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    const response = await this.axiosInstance.get(`/api/usage?${params.toString()}`);
    return response.data;
  }

  // Settings
  async getSettings(): Promise<Settings> {
    try {
      const settings = await AsyncStorage.getItem('settings');
      return settings ? JSON.parse(settings) : {
        api_key: '',
        theme: 'system',
        auto_save: true,
        notifications: true,
      };
    } catch (error) {
      return {
        api_key: '',
        theme: 'system',
        auto_save: true,
        notifications: true,
      };
    }
  }

  async updateSettings(settings: Partial<Settings>): Promise<Settings> {
    const current = await this.getSettings();
    const updated = { ...current, ...settings };
    await AsyncStorage.setItem('settings', JSON.stringify(updated));
    return updated;
  }

  // Health Check
  async checkHealth(): Promise<{ status: string; timestamp: string }> {
    try {
      const response = await this.axiosInstance.get('/api/health');
      return response.data;
    } catch (error) {
      throw new Error('Server is not reachable');
    }
  }

  // File Operations
  async readFile(path: string): Promise<string> {
    const response = await this.axiosInstance.post('/api/filesystem/read', { path });
    return response.data.content;
  }

  async writeFile(path: string, content: string): Promise<{ success: boolean }> {
    const response = await this.axiosInstance.post('/api/filesystem/write', { path, content });
    return response.data;
  }

  async listDirectory(path: string): Promise<{ name: string; type: 'file' | 'directory' }[]> {
    const response = await this.axiosInstance.post('/api/filesystem/list', { path });
    return response.data.files;
  }
}

export default ClaudiaAPIClient;