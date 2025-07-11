import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ClaudiaAPIClient, { Session, ProcessOutput } from '../lib/api';

interface SessionsScreenProps {
  apiClient: ClaudiaAPIClient;
  navigation: any;
  route: any;
}

function SessionsScreen({ apiClient, navigation, route }: SessionsScreenProps): React.JSX.Element {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [sessionOutput, setSessionOutput] = useState<ProcessOutput[]>([]);
  const [inputText, setInputText] = useState('');
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [newSessionArgs, setNewSessionArgs] = useState('');
  const outputScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadSessions();
    
    if (route.params?.createNew) {
      setShowNewSessionModal(true);
    }
    
    if (route.params?.sessionId) {
      selectSession(route.params.sessionId);
    }
  }, [route.params]);

  useEffect(() => {
    const socket = apiClient.getSocket();
    if (!socket) {
      apiClient.connect();
      return;
    }

    const handleOutput = (data: ProcessOutput & { sessionId: string }) => {
      if (activeSession && data.sessionId === activeSession.id) {
        setSessionOutput(prev => [...prev, data]);
        setTimeout(() => {
          outputScrollRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    };

    const handleSessionUpdate = (data: { sessionId: string; status: string }) => {
      setSessions(prev => prev.map(s => 
        s.id === data.sessionId ? { ...s, is_running: data.status === 'running' } : s
      ));
      if (activeSession?.id === data.sessionId) {
        setActiveSession(prev => prev ? { ...prev, is_running: data.status === 'running' } : null);
      }
    };

    socket.on('process-output', handleOutput);
    socket.on('session-status', handleSessionUpdate);

    return () => {
      socket.off('process-output', handleOutput);
      socket.off('session-status', handleSessionUpdate);
    };
  }, [activeSession, apiClient]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getSessions();
      setSessions(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const selectSession = async (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setActiveSession(session);
      setSessionOutput([]);
      
      // Join session room for real-time updates
      const socket = apiClient.getSocket();
      if (socket) {
        socket.emit('join-session', sessionId);
      }
    }
  };

  const createSession = async () => {
    if (!newSessionArgs.trim()) {
      Alert.alert('Error', 'Please enter session arguments');
      return;
    }

    try {
      const args = newSessionArgs.split(' ').filter(arg => arg.length > 0);
      const { id } = await apiClient.createSession(args);
      setShowNewSessionModal(false);
      setNewSessionArgs('');
      await loadSessions();
      selectSession(id);
    } catch (error) {
      Alert.alert('Error', 'Failed to create session');
    }
  };

  const resumeSession = async () => {
    if (!activeSession) return;

    try {
      await apiClient.resumeSession(activeSession.id);
      setActiveSession({ ...activeSession, is_running: true });
    } catch (error) {
      Alert.alert('Error', 'Failed to resume session');
    }
  };

  const stopSession = async () => {
    if (!activeSession) return;

    try {
      await apiClient.stopSession(activeSession.id);
      setActiveSession({ ...activeSession, is_running: false });
    } catch (error) {
      Alert.alert('Error', 'Failed to stop session');
    }
  };

  const sendInput = async () => {
    if (!activeSession || !inputText.trim()) return;

    try {
      await apiClient.sendInput(activeSession.id, inputText);
      setInputText('');
    } catch (error) {
      Alert.alert('Error', 'Failed to send input');
    }
  };

  const renderSessionItem = ({ item }: { item: Session }) => (
    <TouchableOpacity
      style={[
        styles.sessionItem,
        activeSession?.id === item.id && styles.sessionItemActive,
      ]}
      onPress={() => selectSession(item.id)}
    >
      <View style={styles.sessionInfo}>
        <Text style={styles.sessionName}>{item.name}</Text>
        <Text style={styles.sessionDetails}>
          {item.project_id || 'No project'} • {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
      {item.is_running && (
        <View style={styles.runningIndicator} />
      )}
    </TouchableOpacity>
  );

  const renderOutput = (output: ProcessOutput, index: number) => {
    const getOutputStyle = () => {
      switch (output.type) {
        case 'stderr':
          return styles.outputError;
        case 'system':
          return styles.outputSystem;
        case 'exit':
          return styles.outputExit;
        default:
          return styles.outputNormal;
      }
    };

    return (
      <Text key={index} style={[styles.outputText, getOutputStyle()]}>
        {output.content}
      </Text>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.sidebar}>
        <TouchableOpacity
          style={styles.newSessionButton}
          onPress={() => setShowNewSessionModal(true)}
        >
          <Icon name="add" size={20} color="white" />
          <Text style={styles.newSessionButtonText}>New Session</Text>
        </TouchableOpacity>
        
        <FlatList
          data={sessions}
          renderItem={renderSessionItem}
          keyExtractor={item => item.id}
          style={styles.sessionsList}
        />
      </View>

      <View style={styles.mainContent}>
        {activeSession ? (
          <KeyboardAvoidingView
            style={styles.sessionView}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.sessionHeader}>
              <Text style={styles.sessionTitle}>{activeSession.name}</Text>
              <View style={styles.sessionControls}>
                {activeSession.is_running ? (
                  <TouchableOpacity
                    style={styles.controlButton}
                    onPress={stopSession}
                  >
                    <Icon name="stop" size={20} color="#F44336" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.controlButton}
                    onPress={resumeSession}
                  >
                    <Icon name="play-arrow" size={20} color="#4CAF50" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <ScrollView
              ref={outputScrollRef}
              style={styles.outputContainer}
              contentContainerStyle={styles.outputContent}
            >
              {sessionOutput.map((output, index) => renderOutput(output, index))}
            </ScrollView>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Type a message..."
                multiline
                editable={activeSession.is_running}
                onSubmitEditing={sendInput}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!activeSession.is_running || !inputText.trim()) && styles.sendButtonDisabled,
                ]}
                onPress={sendInput}
                disabled={!activeSession.is_running || !inputText.trim()}
              >
                <Icon name="send" size={20} color="white" />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        ) : (
          <View style={styles.emptyState}>
            <Icon name="terminal" size={64} color="#CCC" />
            <Text style={styles.emptyStateText}>Select a session to view</Text>
          </View>
        )}
      </View>

      <Modal
        visible={showNewSessionModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNewSessionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Session</Text>
            <Text style={styles.modalLabel}>Session Arguments</Text>
            <TextInput
              style={styles.modalInput}
              value={newSessionArgs}
              onChangeText={setNewSessionArgs}
              placeholder="e.g., --help or project-name"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowNewSessionModal(false);
                  setNewSessionArgs('');
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={createSession}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                  Create
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
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sidebar: {
    width: '35%',
    backgroundColor: 'white',
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
  },
  newSessionButton: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    padding: 12,
    margin: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newSessionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  sessionsList: {
    flex: 1,
  },
  sessionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  sessionItemActive: {
    backgroundColor: '#E3F2FD',
  },
  sessionInfo: {
    flex: 1,
  },
  sessionName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  sessionDetails: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  runningIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
  mainContent: {
    flex: 1,
  },
  sessionView: {
    flex: 1,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sessionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  sessionControls: {
    flexDirection: 'row',
  },
  controlButton: {
    padding: 8,
    marginLeft: 8,
  },
  outputContainer: {
    flex: 1,
    backgroundColor: '#1E1E1E',
  },
  outputContent: {
    padding: 16,
  },
  outputText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
  outputNormal: {
    color: '#D4D4D4',
  },
  outputError: {
    color: '#F48771',
  },
  outputSystem: {
    color: '#3794FF',
  },
  outputExit: {
    color: '#FFCC00',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 10,
    marginLeft: 8,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    color: '#666',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
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

export default SessionsScreen;