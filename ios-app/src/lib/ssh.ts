import SSHClient from '@dylankenneally/react-native-ssh-sftp';
import { NativeEventEmitter, NativeModules } from 'react-native';

const SSHClientEmitter = new NativeEventEmitter(NativeModules.RNSSHClient);

export interface SSHConnectionConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export interface SSHTunnel {
  localPort: number;
  remoteHost: string;
  remotePort: number;
}

class SSHManager {
  private client: any = null;
  private isConnected: boolean = false;
  private tunnels: Map<string, SSHTunnel> = new Map();

  async connect(config: SSHConnectionConfig): Promise<void> {
    try {
      if (this.isConnected) {
        await this.disconnect();
      }

      if (config.password) {
        this.client = await SSHClient.connectWithPassword(
          config.host,
          config.port,
          config.username,
          config.password
        );
      } else if (config.privateKey) {
        this.client = await SSHClient.connectWithKey(
          config.host,
          config.port,
          config.username,
          config.privateKey,
          config.passphrase
        );
      } else {
        throw new Error('Either password or privateKey must be provided');
      }

      this.isConnected = true;
      console.log('SSH connection established');
    } catch (error) {
      this.isConnected = false;
      throw new Error(`SSH connection failed: ${error.message}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.disconnect();
      } catch (error) {
        console.error('Error disconnecting SSH:', error);
      }
      this.client = null;
      this.isConnected = false;
      this.tunnels.clear();
    }
  }

  async createTunnel(
    remoteHost: string,
    remotePort: number,
    localPort?: number
  ): Promise<SSHTunnel> {
    if (!this.isConnected || !this.client) {
      throw new Error('SSH client not connected');
    }

    try {
      // Generate a random local port if not specified
      const assignedLocalPort = localPort || Math.floor(Math.random() * 10000) + 50000;
      
      // Create SSH tunnel using port forwarding
      await this.client.execute(
        `ssh -L ${assignedLocalPort}:${remoteHost}:${remotePort} -N &`
      );

      const tunnel: SSHTunnel = {
        localPort: assignedLocalPort,
        remoteHost,
        remotePort,
      };

      const tunnelKey = `${remoteHost}:${remotePort}`;
      this.tunnels.set(tunnelKey, tunnel);

      return tunnel;
    } catch (error) {
      throw new Error(`Failed to create SSH tunnel: ${error.message}`);
    }
  }

  async closeTunnel(remoteHost: string, remotePort: number): Promise<void> {
    const tunnelKey = `${remoteHost}:${remotePort}`;
    const tunnel = this.tunnels.get(tunnelKey);
    
    if (tunnel && this.client) {
      try {
        // Kill the SSH tunnel process
        await this.client.execute(
          `pkill -f "ssh -L ${tunnel.localPort}:${remoteHost}:${remotePort}"`
        );
        this.tunnels.delete(tunnelKey);
      } catch (error) {
        console.error('Error closing tunnel:', error);
      }
    }
  }

  getTunnel(remoteHost: string, remotePort: number): SSHTunnel | undefined {
    return this.tunnels.get(`${remoteHost}:${remotePort}`);
  }

  getIsConnected(): boolean {
    return this.isConnected;
  }

  async executeCommand(command: string): Promise<string> {
    if (!this.isConnected || !this.client) {
      throw new Error('SSH client not connected');
    }

    try {
      const result = await this.client.execute(command);
      return result;
    } catch (error) {
      throw new Error(`SSH command failed: ${error.message}`);
    }
  }

  // Helper to parse SSH URL format: user@host:port
  static parseSSHURL(url: string): SSHConnectionConfig | null {
    const match = url.match(/^(.+)@(.+):(\d+)$/);
    if (match) {
      const [, username, host, port] = match;
      return {
        username,
        host,
        port: parseInt(port, 10),
      };
    }
    return null;
  }
}

export default new SSHManager();