import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Switch,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ClaudiaAPIClient, { MCPServer } from '../lib/api';

interface MCPServersScreenProps {
  apiClient: ClaudiaAPIClient;
}

function MCPServersScreen({ apiClient }: MCPServersScreenProps): React.JSX.Element {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showServerModal, setShowServerModal] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    command: '',
    args: '',
    env: '',
    is_enabled: true,
  });

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getMCPServers();
      setServers(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load MCP servers');
    } finally {
      setLoading(false);
    }
  };

  const openServerModal = (server?: MCPServer) => {
    if (server) {
      setEditingServer(server);
      setFormData({
        name: server.name,
        command: server.command,
        args: server.args,
        env: server.env,
        is_enabled: server.is_enabled,
      });
    } else {
      setEditingServer(null);
      setFormData({
        name: '',
        command: '',
        args: '',
        env: '',
        is_enabled: true,
      });
    }
    setShowServerModal(true);
  };

  const saveServer = async () => {
    if (!formData.name || !formData.command) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      if (editingServer) {
        await apiClient.updateMCPServer(editingServer.id, formData);
      } else {
        await apiClient.createMCPServer({
          ...formData,
          is_default: false,
        });
      }
      setShowServerModal(false);
      await loadServers();
    } catch (error) {
      Alert.alert('Error', 'Failed to save MCP server');
    }
  };

  const deleteServer = async (server: MCPServer) => {
    if (server.is_default) {
      Alert.alert('Error', 'Cannot delete default MCP servers');
      return;
    }

    Alert.alert(
      'Delete MCP Server',
      `Are you sure you want to delete "${server.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.deleteMCPServer(server.id);
              await loadServers();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete MCP server');
            }
          },
        },
      ]
    );
  };

  const toggleServer = async (server: MCPServer) => {
    try {
      await apiClient.updateMCPServer(server.id, {
        is_enabled: !server.is_enabled,
      });
      await loadServers();
    } catch (error) {
      Alert.alert('Error', 'Failed to update MCP server');
    }
  };

  const renderServer = ({ item }: { item: MCPServer }) => (
    <View style={styles.serverCard}>
      <View style={styles.serverHeader}>
        <View style={styles.serverInfo}>
          <View style={styles.serverTitleRow}>
            <Text style={styles.serverName}>{item.name}</Text>
            {item.is_default && (
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultBadgeText}>DEFAULT</Text>
              </View>
            )}
          </View>
          <Text style={styles.serverCommand}>{item.command}</Text>
          {item.args && (
            <Text style={styles.serverArgs}>Args: {item.args}</Text>
          )}
        </View>
        <Switch
          value={item.is_enabled}
          onValueChange={() => toggleServer(item)}
          trackColor={{ false: '#DDD', true: '#4CAF50' }}
        />
      </View>
      
      <View style={styles.serverActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => openServerModal(item)}
          disabled={item.is_default}
        >
          <Icon 
            name="edit" 
            size={20} 
            color={item.is_default ? '#CCC' : '#007AFF'} 
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => deleteServer(item)}
          disabled={item.is_default}
        >
          <Icon 
            name="delete" 
            size={20} 
            color={item.is_default ? '#CCC' : '#F44336'} 
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => openServerModal()}
      >
        <Icon name="add" size={20} color="white" />
        <Text style={styles.addButtonText}>New MCP Server</Text>
      </TouchableOpacity>

      <FlatList
        data={servers}
        renderItem={renderServer}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="dns" size={64} color="#CCC" />
            <Text style={styles.emptyStateText}>No MCP servers configured</Text>
          </View>
        }
      />

      <Modal
        visible={showServerModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowServerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>
                {editingServer ? 'Edit MCP Server' : 'New MCP Server'}
              </Text>

              <Text style={styles.inputLabel}>Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="My MCP Server"
              />

              <Text style={styles.inputLabel}>Command *</Text>
              <TextInput
                style={styles.input}
                value={formData.command}
                onChangeText={(text) => setFormData({ ...formData, command: text })}
                placeholder="npx @modelcontextprotocol/server-name"
              />

              <Text style={styles.inputLabel}>Arguments</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.args}
                onChangeText={(text) => setFormData({ ...formData, args: text })}
                placeholder='["--option", "value"]'
                multiline
                numberOfLines={3}
              />

              <Text style={styles.inputLabel}>Environment Variables</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.env}
                onChangeText={(text) => setFormData({ ...formData, env: text })}
                placeholder='{"API_KEY": "your-key"}'
                multiline
                numberOfLines={3}
              />

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Enabled</Text>
                <Switch
                  value={formData.is_enabled}
                  onValueChange={(value) =>
                    setFormData({ ...formData, is_enabled: value })
                  }
                />
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => setShowServerModal(false)}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonPrimary]}
                  onPress={saveServer}
                >
                  <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                    Save
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    padding: 12,
    margin: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  list: {
    padding: 16,
    paddingTop: 0,
  },
  serverCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  serverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  serverInfo: {
    flex: 1,
    marginRight: 12,
  },
  serverTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serverName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  defaultBadge: {
    backgroundColor: '#E0E0E0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#666',
  },
  serverCommand: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  serverArgs: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  serverActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
    color: '#333',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    color: '#666',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  switchLabel: {
    fontSize: 14,
    color: '#333',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 12,
  },
  modalButtonCancel: {
    backgroundColor: '#F0F0F0',
  },
  modalButtonPrimary: {
    backgroundColor: '#007AFF',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  modalButtonTextPrimary: {
    color: 'white',
  },
});

export default MCPServersScreen;