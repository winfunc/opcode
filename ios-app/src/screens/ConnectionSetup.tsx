import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface ConnectionSetupProps {
  onConnect: (url: string) => Promise<void>;
}

function ConnectionSetup({ onConnect }: ConnectionSetupProps): React.JSX.Element {
  const [connectionType, setConnectionType] = useState<'http' | 'ssh'>('http');
  const [httpUrl, setHttpUrl] = useState('http://localhost:8080');
  const [sshHost, setSshHost] = useState('');
  const [sshPort, setSshPort] = useState('8080');
  const [sshUser, setSshUser] = useState('');
  const [sshPassword, setSshPassword] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    let url = '';
    
    if (connectionType === 'http') {
      if (!httpUrl) {
        Alert.alert('Error', 'Please enter a server URL');
        return;
      }
      url = httpUrl;
    } else {
      if (!sshHost || !sshPort || !sshUser) {
        Alert.alert('Error', 'Please fill in all SSH connection details');
        return;
      }
      url = `${sshUser}@${sshHost}:${sshPort}`;
    }

    setIsConnecting(true);
    try {
      await onConnect(url);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Icon name="cloud" size={64} color="#007AFF" />
          <Text style={styles.title}>Connect to Claudia Server</Text>
          <Text style={styles.subtitle}>
            Connect to your Claudia API server running on your host machine
          </Text>
        </View>

        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              connectionType === 'http' && styles.toggleButtonActive,
            ]}
            onPress={() => setConnectionType('http')}
          >
            <Text
              style={[
                styles.toggleText,
                connectionType === 'http' && styles.toggleTextActive,
              ]}
            >
              HTTP
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              connectionType === 'ssh' && styles.toggleButtonActive,
            ]}
            onPress={() => setConnectionType('ssh')}
          >
            <Text
              style={[
                styles.toggleText,
                connectionType === 'ssh' && styles.toggleTextActive,
              ]}
            >
              SSH
            </Text>
          </TouchableOpacity>
        </View>

        {connectionType === 'http' ? (
          <View style={styles.form}>
            <Text style={styles.label}>Server URL</Text>
            <TextInput
              style={styles.input}
              value={httpUrl}
              onChangeText={setHttpUrl}
              placeholder="http://192.168.1.100:8080"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <Text style={styles.helpText}>
              Enter the URL of your Claudia API server. If connecting from a physical device,
              use your computer's IP address instead of localhost.
            </Text>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.label}>SSH User</Text>
            <TextInput
              style={styles.input}
              value={sshUser}
              onChangeText={setSshUser}
              placeholder="username"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>SSH Host</Text>
            <TextInput
              style={styles.input}
              value={sshHost}
              onChangeText={setSshHost}
              placeholder="192.168.1.100"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numeric"
            />

            <Text style={styles.label}>API Port</Text>
            <TextInput
              style={styles.input}
              value={sshPort}
              onChangeText={setSshPort}
              placeholder="8080"
              keyboardType="numeric"
            />

            <Text style={styles.label}>SSH Password</Text>
            <TextInput
              style={styles.input}
              value={sshPassword}
              onChangeText={setSshPassword}
              placeholder="SSH password"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.helpText}>
              Note: SSH connections are not yet fully implemented in React Native.
              For now, please use HTTP connection with your server's IP address.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.connectButton, isConnecting && styles.connectButtonDisabled]}
          onPress={handleConnect}
          disabled={isConnecting}
        >
          <Text style={styles.connectButtonText}>
            {isConnecting ? 'Connecting...' : 'Connect'}
          </Text>
        </TouchableOpacity>

        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsTitle}>Setup Instructions:</Text>
          <Text style={styles.instructions}>
            1. Start the Claudia API server on your host machine:{'\n'}
            {'   '}cd web && node web-server-complete.js{'\n\n'}
            2. Find your computer's IP address:{'\n'}
            {'   '}• macOS: ifconfig | grep "inet "{'\n'}
            {'   '}• Linux: ip addr show{'\n'}
            {'   '}• Windows: ipconfig{'\n\n'}
            3. Enter the connection details above
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  toggleContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'white',
  },
  toggleButtonActive: {
    backgroundColor: '#007AFF',
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  toggleTextActive: {
    color: 'white',
  },
  form: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
    marginBottom: 16,
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  connectButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 30,
  },
  connectButtonDisabled: {
    opacity: 0.6,
  },
  connectButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  instructionsContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  instructions: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});

export default ConnectionSetup;