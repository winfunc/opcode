import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ClaudiaAPIClient, { Settings } from '../lib/api';

interface SettingsScreenProps {
  apiClient: ClaudiaAPIClient;
  onDisconnect: () => void;
}

function SettingsScreen({ apiClient, onDisconnect }: SettingsScreenProps): React.JSX.Element {
  const [settings, setSettings] = useState<Settings>({
    api_key: '',
    theme: 'system',
    auto_save: true,
    notifications: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serverURL, setServerURL] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const [settingsData, savedURL] = await Promise.all([
        apiClient.getSettings(),
        AsyncStorage.getItem('serverURL'),
      ]);
      setSettings(settingsData);
      setServerURL(savedURL || '');
    } catch (error) {
      Alert.alert('Error', 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      await apiClient.updateSettings(settings);
      Alert.alert('Success', 'Settings saved successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect',
      'Are you sure you want to disconnect from the server?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('serverURL');
            apiClient.disconnect();
            onDisconnect();
          },
        },
      ]
    );
  };

  const clearData = () => {
    Alert.alert(
      'Clear App Data',
      'This will clear all local data. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.clear();
            Alert.alert('Success', 'App data cleared. Please restart the app.');
          },
        },
      ]
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
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connection</Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Server URL</Text>
          <Text style={styles.settingValue}>{serverURL}</Text>
        </View>
        <TouchableOpacity
          style={styles.disconnectButton}
          onPress={handleDisconnect}
        >
          <Icon name="logout" size={20} color="#F44336" />
          <Text style={styles.disconnectButtonText}>Disconnect</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>API Configuration</Text>
        <Text style={styles.inputLabel}>Claude API Key</Text>
        <View style={styles.apiKeyContainer}>
          <TextInput
            style={[styles.input, styles.apiKeyInput]}
            value={settings.api_key}
            onChangeText={(text) => setSettings({ ...settings, api_key: text })}
            placeholder="sk-ant-api..."
            secureTextEntry={!showApiKey}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.apiKeyToggle}
            onPress={() => setShowApiKey(!showApiKey)}
          >
            <Icon
              name={showApiKey ? 'visibility-off' : 'visibility'}
              size={20}
              color="#666"
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <Text style={styles.settingLabel}>Theme</Text>
        <View style={styles.themeSelector}>
          <TouchableOpacity
            style={[
              styles.themeOption,
              settings.theme === 'light' && styles.themeOptionActive,
            ]}
            onPress={() => setSettings({ ...settings, theme: 'light' })}
          >
            <Icon name="light-mode" size={20} color={settings.theme === 'light' ? '#007AFF' : '#666'} />
            <Text style={[
              styles.themeText,
              settings.theme === 'light' && styles.themeTextActive,
            ]}>Light</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.themeOption,
              settings.theme === 'dark' && styles.themeOptionActive,
            ]}
            onPress={() => setSettings({ ...settings, theme: 'dark' })}
          >
            <Icon name="dark-mode" size={20} color={settings.theme === 'dark' ? '#007AFF' : '#666'} />
            <Text style={[
              styles.themeText,
              settings.theme === 'dark' && styles.themeTextActive,
            ]}>Dark</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.themeOption,
              settings.theme === 'system' && styles.themeOptionActive,
            ]}
            onPress={() => setSettings({ ...settings, theme: 'system' })}
          >
            <Icon name="brightness-auto" size={20} color={settings.theme === 'system' ? '#007AFF' : '#666'} />
            <Text style={[
              styles.themeText,
              settings.theme === 'system' && styles.themeTextActive,
            ]}>System</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        
        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Text style={styles.switchLabel}>Auto-save Sessions</Text>
            <Text style={styles.switchDescription}>
              Automatically save session outputs
            </Text>
          </View>
          <Switch
            value={settings.auto_save}
            onValueChange={(value) =>
              setSettings({ ...settings, auto_save: value })
            }
            trackColor={{ false: '#DDD', true: '#4CAF50' }}
          />
        </View>

        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Text style={styles.switchLabel}>Notifications</Text>
            <Text style={styles.switchDescription}>
              Show notifications for completed tasks
            </Text>
          </View>
          <Switch
            value={settings.notifications}
            onValueChange={(value) =>
              setSettings({ ...settings, notifications: value })
            }
            trackColor={{ false: '#DDD', true: '#4CAF50' }}
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={saveSettings}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>
          {saving ? 'Saving...' : 'Save Settings'}
        </Text>
      </TouchableOpacity>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Advanced</Text>
        <TouchableOpacity
          style={styles.dangerButton}
          onPress={clearData}
        >
          <Icon name="delete-sweep" size={20} color="#F44336" />
          <Text style={styles.dangerButtonText}>Clear App Data</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.aboutSection}>
        <Text style={styles.aboutTitle}>About Claudia</Text>
        <Text style={styles.aboutText}>Version 1.0.0</Text>
        <Text style={styles.aboutText}>
          A powerful iOS client for Claude Code
        </Text>
        <Text style={styles.aboutText}>
          Built with React Native
        </Text>
      </View>
    </ScrollView>
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
  section: {
    backgroundColor: 'white',
    marginVertical: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
  },
  settingValue: {
    fontSize: 14,
    color: '#666',
  },
  disconnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  disconnectButtonText: {
    color: '#F44336',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
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
    backgroundColor: 'white',
  },
  apiKeyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  apiKeyInput: {
    flex: 1,
  },
  apiKeyToggle: {
    padding: 12,
  },
  themeSelector: {
    flexDirection: 'row',
    marginTop: 8,
  },
  themeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: 'white',
  },
  themeOptionActive: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  themeText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  themeTextActive: {
    color: '#007AFF',
    fontWeight: '500',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  switchInfo: {
    flex: 1,
    marginRight: 12,
  },
  switchLabel: {
    fontSize: 16,
    color: '#333',
  },
  switchDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
  },
  dangerButtonText: {
    color: '#F44336',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  aboutSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  aboutTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  aboutText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
});

export default SettingsScreen;