import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ClaudiaAPIClient, { UsageStats } from '../lib/api';

interface UsageScreenProps {
  apiClient: ClaudiaAPIClient;
}

const { width: screenWidth } = Dimensions.get('window');

function UsageScreen({ apiClient }: UsageScreenProps): React.JSX.Element {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [usageData, setUsageData] = useState<UsageStats[]>([]);
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'all'>('week');
  const [totals, setTotals] = useState({
    totalTokens: 0,
    totalCost: 0,
    inputTokens: 0,
    outputTokens: 0,
  });

  useEffect(() => {
    loadUsageData();
  }, [dateRange]);

  const loadUsageData = async () => {
    try {
      setLoading(true);
      
      let startDate: string | undefined;
      const endDate = new Date().toISOString().split('T')[0];
      
      if (dateRange === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        startDate = weekAgo.toISOString().split('T')[0];
      } else if (dateRange === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        startDate = monthAgo.toISOString().split('T')[0];
      }

      const data = await apiClient.getUsageStats(startDate, endDate);
      setUsageData(data);

      // Calculate totals
      const totals = data.reduce(
        (acc, item) => ({
          totalTokens: acc.totalTokens + item.input_tokens + item.output_tokens,
          totalCost: acc.totalCost + item.cost,
          inputTokens: acc.inputTokens + item.input_tokens,
          outputTokens: acc.outputTokens + item.output_tokens,
        }),
        { totalTokens: 0, totalCost: 0, inputTokens: 0, outputTokens: 0 }
      );
      setTotals(totals);
    } catch (error) {
      console.error('Error loading usage data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadUsageData();
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const formatCost = (cost: number): string => {
    return `$${cost.toFixed(2)}`;
  };

  const getModelColor = (model: string): string => {
    if (model.includes('claude-3-opus')) return '#9C27B0';
    if (model.includes('claude-3-sonnet')) return '#2196F3';
    if (model.includes('claude-3-haiku')) return '#4CAF50';
    if (model.includes('gpt-4')) return '#FF5722';
    if (model.includes('gpt-3.5')) return '#FF9800';
    return '#607D8B';
  };

  const renderChart = () => {
    if (usageData.length === 0) return null;

    // Group by date and calculate daily totals
    const dailyData = usageData.reduce((acc, item) => {
      const date = item.date;
      if (!acc[date]) {
        acc[date] = { tokens: 0, cost: 0 };
      }
      acc[date].tokens += item.input_tokens + item.output_tokens;
      acc[date].cost += item.cost;
      return acc;
    }, {} as Record<string, { tokens: number; cost: number }>);

    const dates = Object.keys(dailyData).sort();
    const maxTokens = Math.max(...dates.map(d => dailyData[d].tokens));
    const chartHeight = 200;
    const barWidth = (screenWidth - 80) / Math.max(dates.length, 1);

    return (
      <View style={styles.chart}>
        <Text style={styles.chartTitle}>Daily Token Usage</Text>
        <View style={styles.chartContainer}>
          <View style={styles.chartBars}>
            {dates.map((date, index) => {
              const height = (dailyData[date].tokens / maxTokens) * chartHeight;
              return (
                <View key={date} style={[styles.bar, { width: barWidth - 4 }]}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height,
                        backgroundColor: '#007AFF',
                      },
                    ]}
                  />
                  <Text style={styles.barLabel}>
                    {new Date(date).getDate()}
                  </Text>
                </View>
              );
            })}
          </View>
          <View style={styles.chartYAxis}>
            <Text style={styles.chartYLabel}>{formatNumber(maxTokens)}</Text>
            <Text style={styles.chartYLabel}>{formatNumber(maxTokens / 2)}</Text>
            <Text style={styles.chartYLabel}>0</Text>
          </View>
        </View>
      </View>
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
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.dateRangeSelector}>
        <TouchableOpacity
          style={[
            styles.dateRangeButton,
            dateRange === 'week' && styles.dateRangeButtonActive,
          ]}
          onPress={() => setDateRange('week')}
        >
          <Text
            style={[
              styles.dateRangeText,
              dateRange === 'week' && styles.dateRangeTextActive,
            ]}
          >
            Week
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.dateRangeButton,
            dateRange === 'month' && styles.dateRangeButtonActive,
          ]}
          onPress={() => setDateRange('month')}
        >
          <Text
            style={[
              styles.dateRangeText,
              dateRange === 'month' && styles.dateRangeTextActive,
            ]}
          >
            Month
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.dateRangeButton,
            dateRange === 'all' && styles.dateRangeButtonActive,
          ]}
          onPress={() => setDateRange('all')}
        >
          <Text
            style={[
              styles.dateRangeText,
              dateRange === 'all' && styles.dateRangeTextActive,
            ]}
          >
            All Time
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryCards}>
        <View style={styles.summaryCard}>
          <Icon name="data-usage" size={24} color="#007AFF" />
          <Text style={styles.summaryValue}>{formatNumber(totals.totalTokens)}</Text>
          <Text style={styles.summaryLabel}>Total Tokens</Text>
        </View>
        
        <View style={styles.summaryCard}>
          <Icon name="attach-money" size={24} color="#4CAF50" />
          <Text style={styles.summaryValue}>{formatCost(totals.totalCost)}</Text>
          <Text style={styles.summaryLabel}>Total Cost</Text>
        </View>
        
        <View style={styles.summaryCard}>
          <Icon name="input" size={24} color="#FF9800" />
          <Text style={styles.summaryValue}>{formatNumber(totals.inputTokens)}</Text>
          <Text style={styles.summaryLabel}>Input Tokens</Text>
        </View>
        
        <View style={styles.summaryCard}>
          <Icon name="output" size={24} color="#9C27B0" />
          <Text style={styles.summaryValue}>{formatNumber(totals.outputTokens)}</Text>
          <Text style={styles.summaryLabel}>Output Tokens</Text>
        </View>
      </View>

      {renderChart()}

      <View style={styles.detailsSection}>
        <Text style={styles.sectionTitle}>Usage by Model</Text>
        {Object.entries(
          usageData.reduce((acc, item) => {
            if (!acc[item.model]) {
              acc[item.model] = { tokens: 0, cost: 0, count: 0 };
            }
            acc[item.model].tokens += item.input_tokens + item.output_tokens;
            acc[item.model].cost += item.cost;
            acc[item.model].count += 1;
            return acc;
          }, {} as Record<string, { tokens: number; cost: number; count: number }>)
        ).map(([model, data]) => (
          <View key={model} style={styles.modelRow}>
            <View style={styles.modelInfo}>
              <View style={[styles.modelDot, { backgroundColor: getModelColor(model) }]} />
              <Text style={styles.modelName}>{model}</Text>
            </View>
            <View style={styles.modelStats}>
              <Text style={styles.modelTokens}>{formatNumber(data.tokens)} tokens</Text>
              <Text style={styles.modelCost}>{formatCost(data.cost)}</Text>
            </View>
          </View>
        ))}
      </View>

      {usageData.length === 0 && (
        <View style={styles.emptyState}>
          <Icon name="analytics" size={64} color="#CCC" />
          <Text style={styles.emptyStateText}>No usage data for this period</Text>
        </View>
      )}
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
  dateRangeSelector: {
    flexDirection: 'row',
    padding: 16,
    justifyContent: 'center',
  },
  dateRangeButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'white',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  dateRangeButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  dateRangeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  dateRangeTextActive: {
    color: 'white',
  },
  summaryCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
  },
  summaryCard: {
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
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
    color: '#333',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  chart: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  chartContainer: {
    flexDirection: 'row',
    height: 250,
  },
  chartBars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 20,
  },
  bar: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginHorizontal: 2,
  },
  barFill: {
    width: '100%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
  },
  chartYAxis: {
    width: 50,
    justifyContent: 'space-between',
    paddingBottom: 20,
  },
  chartYLabel: {
    fontSize: 10,
    color: '#666',
    textAlign: 'right',
  },
  detailsSection: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  modelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modelDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  modelName: {
    fontSize: 14,
    color: '#333',
  },
  modelStats: {
    alignItems: 'flex-end',
  },
  modelTokens: {
    fontSize: 12,
    color: '#666',
  },
  modelCost: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
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
});

export default UsageScreen;