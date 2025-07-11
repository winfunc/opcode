import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ClaudiaAPIClient, { Session, Agent } from '../lib/api';

interface HomeScreenProps {
  apiClient: ClaudiaAPIClient;
  navigation: any;
}

function HomeScreen({ apiClient, navigation }: HomeScreenProps): React.JSX.Element {
  const [refreshing, setRefreshing] = useState(false);
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [activeAgents, setActiveAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState({
    totalSessions: 0,
    activeSessions: 0,
    totalAgents: 0,
    totalUsageToday: 0,
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [sessions, agents, usage] = await Promise.all([
        apiClient.getSessions(),
        apiClient.getAgents(),
        apiClient.getUsageStats(new Date().toISOString().split('T')[0]),
      ]);

      setRecentSessions(sessions.slice(0, 5));
      setActiveAgents(agents.filter(a => !a.is_system).slice(0, 3));
      
      setStats({
        totalSessions: sessions.length,
        activeSessions: sessions.filter(s => s.is_running).length,
        totalAgents: agents.filter(a => !a.is_system).length,
        totalUsageToday: usage.reduce((sum, u) => sum + u.input_tokens + u.output_tokens, 0),
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      Alert.alert('Error', 'Failed to load dashboard data');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const createNewSession = () => {
    navigation.navigate('Sessions', { createNew: true });
  };

  const formatTokenCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.welcomeCard}>
        <Text style={styles.welcomeTitle}>Welcome to Claudia</Text>
        <Text style={styles.welcomeSubtitle}>
          Your AI-powered coding assistant
        </Text>
        <TouchableOpacity style={styles.newSessionButton} onPress={createNewSession}>
          <Icon name="add" size={20} color="white" />
          <Text style={styles.newSessionButtonText}>New Session</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Icon name="folder" size={24} color="#007AFF" />
          <Text style={styles.statValue}>{stats.totalSessions}</Text>
          <Text style={styles.statLabel}>Total Sessions</Text>
        </View>
        
        <View style={styles.statCard}>
          <Icon name="play-circle" size={24} color="#4CAF50" />
          <Text style={styles.statValue}>{stats.activeSessions}</Text>
          <Text style={styles.statLabel}>Active Sessions</Text>
        </View>
        
        <View style={styles.statCard}>
          <Icon name="smart-toy" size={24} color="#FF9800" />
          <Text style={styles.statValue}>{stats.totalAgents}</Text>
          <Text style={styles.statLabel}>Custom Agents</Text>
        </View>
        
        <View style={styles.statCard}>
          <Icon name="data-usage" size={24} color="#9C27B0" />
          <Text style={styles.statValue}>{formatTokenCount(stats.totalUsageToday)}</Text>
          <Text style={styles.statLabel}>Tokens Today</Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Sessions</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Sessions')}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>
        
        {recentSessions.length > 0 ? (
          recentSessions.map((session) => (
            <TouchableOpacity
              key={session.id}
              style={styles.sessionCard}
              onPress={() => navigation.navigate('Sessions', { sessionId: session.id })}
            >
              <View style={styles.sessionInfo}>
                <Text style={styles.sessionName}>{session.name}</Text>
                <Text style={styles.sessionProject}>
                  {session.project_id || 'No project'}
                </Text>
              </View>
              <View style={styles.sessionStatus}>
                {session.is_running && (
                  <View style={styles.runningIndicator} />
                )}
                <Icon name="chevron-right" size={24} color="#999" />
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.emptyText}>No sessions yet</Text>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>
        
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Agents')}
          >
            <Icon name="smart-toy" size={32} color="#007AFF" />
            <Text style={styles.actionText}>Manage Agents</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('MCP')}
          >
            <Icon name="dns" size={32} color="#007AFF" />
            <Text style={styles.actionText}>MCP Servers</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Usage')}
          >
            <Icon name="analytics" size={32} color="#007AFF" />
            <Text style={styles.actionText}>View Usage</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Settings')}
          >
            <Icon name="settings" size={32} color="#007AFF" />
            <Text style={styles.actionText}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  welcomeCard: {
    backgroundColor: '#007AFF',
    padding: 24,
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 20,
  },
  newSessionButton: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
  },
  newSessionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
    marginTop: -30,
  },
  statCard: {
    width: '48%',
    backgroundColor: 'white',
    padding: 16,
    margin: '1%',
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
    color: '#333',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  viewAllText: {
    fontSize: 14,
    color: '#007AFF',
  },
  sessionCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  sessionProject: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  sessionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  runningIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 20,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  actionCard: {
    width: '48%',
    backgroundColor: 'white',
    padding: 20,
    margin: '1%',
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  actionText: {
    fontSize: 14,
    color: '#333',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default HomeScreen;