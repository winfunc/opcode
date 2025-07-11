import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Alert,
  View,
  ActivityIndicator,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import HomeScreen from './screens/HomeScreen';
import SessionsScreen from './screens/SessionsScreen';
import AgentsScreen from './screens/AgentsScreen';
import MCPServersScreen from './screens/MCPServersScreen';
import UsageScreen from './screens/UsageScreen';
import SettingsScreen from './screens/SettingsScreen';
import ConnectionSetup from './screens/ConnectionSetup';
import ClaudiaAPIClient from './lib/api';

const Tab = createBottomTabNavigator();

function App(): React.JSX.Element {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [apiClient] = useState(() => new ClaudiaAPIClient());

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const serverURL = await AsyncStorage.getItem('serverURL');
      if (serverURL) {
        await apiClient.setServerURL(serverURL);
        await apiClient.checkHealth();
        setIsConnected(true);
      }
    } catch (error) {
      console.error('Connection check failed:', error);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async (url: string) => {
    try {
      setIsLoading(true);
      await apiClient.setServerURL(url);
      await apiClient.checkHealth();
      setIsConnected(true);
      Alert.alert('Success', 'Connected to server successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to connect to server. Please check the URL and try again.');
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!isConnected) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <ConnectionSetup onConnect={handleConnect} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ focused, color, size }) => {
              let iconName;

              switch (route.name) {
                case 'Home':
                  iconName = 'home';
                  break;
                case 'Sessions':
                  iconName = 'terminal';
                  break;
                case 'Agents':
                  iconName = 'smart-toy';
                  break;
                case 'MCP':
                  iconName = 'dns';
                  break;
                case 'Usage':
                  iconName = 'analytics';
                  break;
                case 'Settings':
                  iconName = 'settings';
                  break;
                default:
                  iconName = 'circle';
              }

              return <Icon name={iconName} size={size} color={color} />;
            },
            tabBarActiveTintColor: '#007AFF',
            tabBarInactiveTintColor: 'gray',
            headerShown: true,
          })}
        >
          <Tab.Screen name="Home">
            {(props) => <HomeScreen {...props} apiClient={apiClient} />}
          </Tab.Screen>
          <Tab.Screen name="Sessions">
            {(props) => <SessionsScreen {...props} apiClient={apiClient} />}
          </Tab.Screen>
          <Tab.Screen name="Agents">
            {(props) => <AgentsScreen {...props} apiClient={apiClient} />}
          </Tab.Screen>
          <Tab.Screen name="MCP" options={{ title: 'MCP Servers' }}>
            {(props) => <MCPServersScreen {...props} apiClient={apiClient} />}
          </Tab.Screen>
          <Tab.Screen name="Usage">
            {(props) => <UsageScreen {...props} apiClient={apiClient} />}
          </Tab.Screen>
          <Tab.Screen name="Settings">
            {(props) => <SettingsScreen {...props} apiClient={apiClient} onDisconnect={() => setIsConnected(false)} />}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaView>
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
    backgroundColor: '#F5F5F5',
  },
});

export default App;