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
import ClaudiaAPIClient, { Agent } from '../lib/api';

interface AgentsScreenProps {
  apiClient: ClaudiaAPIClient;
}

function AgentsScreen({ apiClient }: AgentsScreenProps): React.JSX.Element {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    prompt: '',
    allow_file_create: true,
    allow_file_delete: false,
    allow_file_edit: true,
    allow_code_execution: true,
    allow_network_access: true,
  });
  const [runPrompt, setRunPrompt] = useState('');
  const [showRunModal, setShowRunModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getAgents();
      setAgents(data.filter(a => !a.is_system));
    } catch (error) {
      Alert.alert('Error', 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  const openAgentModal = (agent?: Agent) => {
    if (agent) {
      setEditingAgent(agent);
      setFormData({
        name: agent.name,
        description: agent.description,
        prompt: agent.prompt,
        allow_file_create: agent.allow_file_create,
        allow_file_delete: agent.allow_file_delete,
        allow_file_edit: agent.allow_file_edit,
        allow_code_execution: agent.allow_code_execution,
        allow_network_access: agent.allow_network_access,
      });
    } else {
      setEditingAgent(null);
      setFormData({
        name: '',
        description: '',
        prompt: '',
        allow_file_create: true,
        allow_file_delete: false,
        allow_file_edit: true,
        allow_code_execution: true,
        allow_network_access: true,
      });
    }
    setShowAgentModal(true);
  };

  const saveAgent = async () => {
    if (!formData.name || !formData.description || !formData.prompt) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      if (editingAgent) {
        await apiClient.updateAgent(editingAgent.id, formData);
      } else {
        await apiClient.createAgent({
          ...formData,
          is_system: false,
        });
      }
      setShowAgentModal(false);
      await loadAgents();
    } catch (error) {
      Alert.alert('Error', 'Failed to save agent');
    }
  };

  const deleteAgent = async (agent: Agent) => {
    Alert.alert(
      'Delete Agent',
      `Are you sure you want to delete "${agent.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.deleteAgent(agent.id);
              await loadAgents();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete agent');
            }
          },
        },
      ]
    );
  };

  const runAgent = async () => {
    if (!selectedAgent || !runPrompt.trim()) {
      Alert.alert('Error', 'Please enter a prompt');
      return;
    }

    try {
      const { execution_id } = await apiClient.runAgent(selectedAgent.id, runPrompt);
      setShowRunModal(false);
      setRunPrompt('');
      Alert.alert('Success', `Agent execution started (ID: ${execution_id})`);
    } catch (error) {
      Alert.alert('Error', 'Failed to run agent');
    }
  };

  const renderAgent = ({ item }: { item: Agent }) => (
    <View style={styles.agentCard}>
      <View style={styles.agentHeader}>
        <View style={styles.agentInfo}>
          <Text style={styles.agentName}>{item.name}</Text>
          <Text style={styles.agentDescription}>{item.description}</Text>
        </View>
        <View style={styles.agentActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              setSelectedAgent(item);
              setShowRunModal(true);
            }}
          >
            <Icon name="play-arrow" size={20} color="#4CAF50" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => openAgentModal(item)}
          >
            <Icon name="edit" size={20} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => deleteAgent(item)}
          >
            <Icon name="delete" size={20} color="#F44336" />
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.permissionsList}>
        <View style={styles.permission}>
          <Icon
            name={item.allow_file_create ? 'check-circle' : 'cancel'}
            size={16}
            color={item.allow_file_create ? '#4CAF50' : '#F44336'}
          />
          <Text style={styles.permissionText}>Create Files</Text>
        </View>
        <View style={styles.permission}>
          <Icon
            name={item.allow_file_edit ? 'check-circle' : 'cancel'}
            size={16}
            color={item.allow_file_edit ? '#4CAF50' : '#F44336'}
          />
          <Text style={styles.permissionText}>Edit Files</Text>
        </View>
        <View style={styles.permission}>
          <Icon
            name={item.allow_file_delete ? 'check-circle' : 'cancel'}
            size={16}
            color={item.allow_file_delete ? '#4CAF50' : '#F44336'}
          />
          <Text style={styles.permissionText}>Delete Files</Text>
        </View>
        <View style={styles.permission}>
          <Icon
            name={item.allow_code_execution ? 'check-circle' : 'cancel'}
            size={16}
            color={item.allow_code_execution ? '#4CAF50' : '#F44336'}
          />
          <Text style={styles.permissionText}>Execute Code</Text>
        </View>
        <View style={styles.permission}>
          <Icon
            name={item.allow_network_access ? 'check-circle' : 'cancel'}
            size={16}
            color={item.allow_network_access ? '#4CAF50' : '#F44336'}
          />
          <Text style={styles.permissionText}>Network Access</Text>
        </View>
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
        onPress={() => openAgentModal()}
      >
        <Icon name="add" size={20} color="white" />
        <Text style={styles.addButtonText}>New Agent</Text>
      </TouchableOpacity>

      <FlatList
        data={agents}
        renderItem={renderAgent}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="smart-toy" size={64} color="#CCC" />
            <Text style={styles.emptyStateText}>No custom agents yet</Text>
          </View>
        }
      />

      <Modal
        visible={showAgentModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAgentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>
                {editingAgent ? 'Edit Agent' : 'New Agent'}
              </Text>

              <Text style={styles.inputLabel}>Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="My Custom Agent"
              />

              <Text style={styles.inputLabel}>Description *</Text>
              <TextInput
                style={styles.input}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="What this agent does"
                multiline
              />

              <Text style={styles.inputLabel}>System Prompt *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.prompt}
                onChangeText={(text) => setFormData({ ...formData, prompt: text })}
                placeholder="You are a helpful assistant that..."
                multiline
                numberOfLines={5}
              />

              <Text style={styles.sectionTitle}>Permissions</Text>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Create Files</Text>
                <Switch
                  value={formData.allow_file_create}
                  onValueChange={(value) =>
                    setFormData({ ...formData, allow_file_create: value })
                  }
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Edit Files</Text>
                <Switch
                  value={formData.allow_file_edit}
                  onValueChange={(value) =>
                    setFormData({ ...formData, allow_file_edit: value })
                  }
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Delete Files</Text>
                <Switch
                  value={formData.allow_file_delete}
                  onValueChange={(value) =>
                    setFormData({ ...formData, allow_file_delete: value })
                  }
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Execute Code</Text>
                <Switch
                  value={formData.allow_code_execution}
                  onValueChange={(value) =>
                    setFormData({ ...formData, allow_code_execution: value })
                  }
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Network Access</Text>
                <Switch
                  value={formData.allow_network_access}
                  onValueChange={(value) =>
                    setFormData({ ...formData, allow_network_access: value })
                  }
                />
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => setShowAgentModal(false)}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonPrimary]}
                  onPress={saveAgent}
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

      <Modal
        visible={showRunModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRunModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Run Agent: {selectedAgent?.name}</Text>
            <Text style={styles.inputLabel}>Prompt</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={runPrompt}
              onChangeText={setRunPrompt}
              placeholder="Enter your prompt for the agent..."
              multiline
              numberOfLines={5}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowRunModal(false);
                  setRunPrompt('');
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={runAgent}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                  Run
                </Text>
              </TouchableOpacity>
            </View>
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
  agentCard: {
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
  agentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  agentInfo: {
    flex: 1,
  },
  agentName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  agentDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  agentActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  permissionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  permission: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  permissionText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
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
    height: 120,
    textAlignVertical: 'top',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 16,
    color: '#333',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  switchLabel: {
    fontSize: 14,
    color: '#333',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 24,
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

export default AgentsScreen;