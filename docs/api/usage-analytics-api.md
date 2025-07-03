# Usage Analytics API

The Usage Analytics API provides comprehensive tracking and analysis of Claude API usage, including token consumption, cost calculations, and performance metrics across projects, models, and time periods.

## Table of Contents
- [Overview](#overview)
- [Core Concepts](#core-concepts)
- [Usage Statistics](#usage-statistics)
- [Time-Based Analytics](#time-based-analytics)
- [Project Analytics](#project-analytics)
- [Cost Tracking](#cost-tracking)
- [Performance Metrics](#performance-metrics)
- [Examples](#examples)

## Overview

Claudia automatically tracks detailed usage metrics for all Claude Code sessions and agent executions, providing insights into:

- **Token Consumption** - Input, output, and cache tokens across all interactions
- **Cost Analysis** - Real-time cost calculations based on current Claude pricing
- **Usage Patterns** - Trends over time, by project, and by model
- **Performance Tracking** - Session duration, message counts, and efficiency metrics
- **Resource Optimization** - Identify high-usage areas for optimization

### Data Collection
```
Claude Session/Agent → Usage Tracking → SQLite Storage → Analytics API
       ↓                    ↓               ↓              ↓
   JSONL Logs        Token Parsing    Metrics DB      Reports/Charts
```

## Core Concepts

### Token Types
- **Input Tokens**: User messages and system prompts
- **Output Tokens**: Claude's responses and generated content  
- **Cache Creation Tokens**: Tokens used to create context cache
- **Cache Read Tokens**: Tokens read from existing cache

### Cost Calculation
Costs are calculated using current Claude API pricing:
- **Sonnet**: $3.00 per 1M input tokens, $15.00 per 1M output tokens
- **Haiku**: $0.25 per 1M input tokens, $1.25 per 1M output tokens  
- **Opus**: $15.00 per 1M input tokens, $75.00 per 1M output tokens

### Aggregation Levels
- **Overall**: Total usage across all sessions
- **By Model**: Usage breakdown per Claude model
- **By Project**: Usage grouped by project path
- **By Date**: Daily/weekly/monthly trends
- **By Session**: Individual session metrics

## Usage Statistics

### `getUsageStats()`

Retrieves comprehensive usage statistics across all tracked sessions.

```typescript
async getUsageStats(): Promise<UsageStats>
```

**Returns**: Complete usage statistics with breakdowns by model, date, and project

**Example**:
```typescript
const stats = await api.getUsageStats();

console.log('📊 Overall Usage Statistics');
console.log(`💰 Total Cost: $${stats.total_cost.toFixed(4)}`);
console.log(`🔢 Total Tokens: ${stats.total_tokens.toLocaleString()}`);
console.log(`📝 Total Sessions: ${stats.total_sessions}`);

console.log('\n📈 Token Breakdown:');
console.log(`  Input: ${stats.total_input_tokens.toLocaleString()}`);
console.log(`  Output: ${stats.total_output_tokens.toLocaleString()}`);
console.log(`  Cache Creation: ${stats.total_cache_creation_tokens.toLocaleString()}`);
console.log(`  Cache Read: ${stats.total_cache_read_tokens.toLocaleString()}`);

console.log('\n🤖 By Model:');
stats.by_model.forEach(model => {
  console.log(`  ${model.model}:`);
  console.log(`    Cost: $${model.total_cost.toFixed(4)}`);
  console.log(`    Tokens: ${model.total_tokens.toLocaleString()}`);
  console.log(`    Sessions: ${model.session_count}`);
});
```

### `getUsageByDateRange(startDate, endDate)`

Retrieves usage statistics filtered by a specific date range.

```typescript
async getUsageByDateRange(startDate: string, endDate: string): Promise<UsageStats>
```

**Parameters**:
- `startDate` - Start date in ISO format (e.g., '2024-01-01')
- `endDate` - End date in ISO format (e.g., '2024-01-31')

**Returns**: Usage statistics for the specified date range

**Example**:
```typescript
// Get usage for the last 30 days
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

const recentStats = await api.getUsageByDateRange(
  thirtyDaysAgo.toISOString().split('T')[0],
  new Date().toISOString().split('T')[0]
);

console.log(`📅 Last 30 Days Usage:`);
console.log(`💰 Cost: $${recentStats.total_cost.toFixed(4)}`);
console.log(`🔢 Tokens: ${recentStats.total_tokens.toLocaleString()}`);

// Show daily trend
console.log('\n📈 Daily Usage:');
recentStats.by_date.forEach(day => {
  console.log(`  ${day.date}: $${day.total_cost.toFixed(4)} (${day.total_tokens.toLocaleString()} tokens)`);
});
```

### `getUsageDetails(limit?)`

Gets detailed usage entries with optional limiting.

```typescript
async getUsageDetails(limit?: number): Promise<UsageEntry[]>
```

**Parameters**:
- `limit` - Optional maximum number of entries to return

**Returns**: Array of individual usage entries

**Example**:
```typescript
// Get the 50 most recent usage entries
const recentEntries = await api.getUsageDetails(50);

console.log(`📋 Recent Usage Entries (${recentEntries.length}):`);

recentEntries.forEach(entry => {
  console.log(`\n🕐 ${entry.timestamp}`);
  console.log(`  Project: ${entry.project}`);
  console.log(`  Model: ${entry.model}`);
  console.log(`  Input: ${entry.input_tokens} tokens`);
  console.log(`  Output: ${entry.output_tokens} tokens`);
  console.log(`  Cost: $${entry.cost.toFixed(6)}`);
  
  if (entry.cache_read_tokens > 0) {
    console.log(`  Cache Read: ${entry.cache_read_tokens} tokens`);
  }
  if (entry.cache_write_tokens > 0) {
    console.log(`  Cache Write: ${entry.cache_write_tokens} tokens`);
  }
});
```

## Time-Based Analytics

### Daily Usage Trends

```typescript
async function analyzeDailyTrends(days: number = 30): Promise<void> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const stats = await api.getUsageByDateRange(
    startDate.toISOString().split('T')[0],
    endDate.toISOString().split('T')[0]
  );

  console.log(`📈 ${days}-Day Usage Trends:`);
  
  // Calculate averages
  const avgDailyCost = stats.total_cost / days;
  const avgDailyTokens = stats.total_tokens / days;
  
  console.log(`💰 Average Daily Cost: $${avgDailyCost.toFixed(4)}`);
  console.log(`🔢 Average Daily Tokens: ${avgDailyTokens.toLocaleString()}`);
  
  // Find peak usage day
  const peakDay = stats.by_date.reduce((peak, day) => 
    day.total_cost > peak.total_cost ? day : peak
  );
  
  console.log(`🏆 Peak Usage Day: ${peakDay.date} ($${peakDay.total_cost.toFixed(4)})`);
  
  // Show model distribution
  console.log('\n🤖 Model Distribution:');
  stats.by_model.forEach(model => {
    const percentage = (model.total_cost / stats.total_cost * 100).toFixed(1);
    console.log(`  ${model.model}: ${percentage}% ($${model.total_cost.toFixed(4)})`);
  });
}
```

### Weekly/Monthly Aggregation

```typescript
async function getWeeklyUsage(): Promise<WeeklyUsage[]> {
  const stats = await api.getUsageStats();
  
  // Group daily usage by week
  const weeklyData: Record<string, DailyUsage[]> = {};
  
  stats.by_date.forEach(day => {
    const date = new Date(day.date);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
    const weekKey = weekStart.toISOString().split('T')[0];
    
    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = [];
    }
    weeklyData[weekKey].push(day);
  });
  
  // Aggregate weekly totals
  return Object.entries(weeklyData).map(([weekStart, days]) => ({
    week_start: weekStart,
    total_cost: days.reduce((sum, day) => sum + day.total_cost, 0),
    total_tokens: days.reduce((sum, day) => sum + day.total_tokens, 0),
    days_active: days.length,
    models_used: [...new Set(days.flatMap(day => day.models_used))]
  }));
}
```

## Project Analytics

### `getSessionStats(since?, until?, order?)`

Gets usage statistics grouped by session/project.

```typescript
async getSessionStats(
  since?: string,
  until?: string, 
  order?: "asc" | "desc"
): Promise<ProjectUsage[]>
```

**Parameters**:
- `since` - Optional start date (YYYYMMDD format)
- `until` - Optional end date (YYYYMMDD format)  
- `order` - Optional sort order for results

**Returns**: Array of project usage statistics

**Example**:
```typescript
// Get project usage for the last month
const lastMonth = new Date();
lastMonth.setMonth(lastMonth.getMonth() - 1);

const projectStats = await api.getSessionStats(
  lastMonth.toISOString().slice(0, 10).replace(/-/g, ''),
  new Date().toISOString().slice(0, 10).replace(/-/g, ''),
  'desc'
);

console.log('📁 Project Usage Rankings:');
projectStats.forEach((project, index) => {
  console.log(`\n${index + 1}. ${project.project_name}`);
  console.log(`   Path: ${project.project_path}`);
  console.log(`   Cost: $${project.total_cost.toFixed(4)}`);
  console.log(`   Tokens: ${project.total_tokens.toLocaleString()}`);
  console.log(`   Sessions: ${project.session_count}`);
  console.log(`   Last Used: ${project.last_used}`);
});

// Calculate project efficiency
console.log('\n📊 Project Efficiency (Cost per Session):');
projectStats.forEach(project => {
  const costPerSession = project.total_cost / project.session_count;
  console.log(`  ${project.project_name}: $${costPerSession.toFixed(4)}/session`);
});
```

### Project Comparison

```typescript
async function compareProjects(projectPaths: string[]): Promise<void> {
  const allStats = await api.getSessionStats();
  
  console.log('🔍 Project Comparison:');
  console.log('Project'.padEnd(30) + 'Cost'.padEnd(12) + 'Tokens'.padEnd(12) + 'Sessions'.padEnd(10) + 'Efficiency');
  console.log('-'.repeat(80));
  
  projectPaths.forEach(path => {
    const project = allStats.find(p => p.project_path === path);
    
    if (project) {
      const efficiency = project.total_cost / project.session_count;
      const projectName = project.project_name.slice(0, 28);
      
      console.log(
        projectName.padEnd(30) +
        `$${project.total_cost.toFixed(4)}`.padEnd(12) +
        project.total_tokens.toLocaleString().padEnd(12) +
        project.session_count.toString().padEnd(10) +
        `$${efficiency.toFixed(4)}`
      );
    } else {
      console.log(`${path.slice(0, 28).padEnd(30)} No usage data`);
    }
  });
}
```

## Cost Tracking

### Real-time Cost Monitoring

```typescript
class CostMonitor {
  private dailyBudget: number;
  private monthlyBudget: number;

  constructor(dailyBudget: number = 10, monthlyBudget: number = 200) {
    this.dailyBudget = dailyBudget;
    this.monthlyBudget = monthlyBudget;
  }

  async checkBudgetStatus(): Promise<BudgetStatus> {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date();
    monthStart.setDate(1);
    
    // Get today's usage
    const todayStats = await api.getUsageByDateRange(today, today);
    
    // Get month's usage
    const monthStats = await api.getUsageByDateRange(
      monthStart.toISOString().split('T')[0],
      today
    );

    return {
      daily: {
        spent: todayStats.total_cost,
        budget: this.dailyBudget,
        remaining: this.dailyBudget - todayStats.total_cost,
        percentage: (todayStats.total_cost / this.dailyBudget) * 100
      },
      monthly: {
        spent: monthStats.total_cost,
        budget: this.monthlyBudget,
        remaining: this.monthlyBudget - monthStats.total_cost,
        percentage: (monthStats.total_cost / this.monthlyBudget) * 100
      }
    };
  }

  async printBudgetReport(): Promise<void> {
    const status = await this.checkBudgetStatus();
    
    console.log('💰 Budget Status Report:');
    console.log(`\n📅 Daily (${new Date().toDateString()}):`);
    console.log(`  Spent: $${status.daily.spent.toFixed(4)} / $${status.daily.budget}`);
    console.log(`  Remaining: $${status.daily.remaining.toFixed(4)}`);
    console.log(`  Usage: ${status.daily.percentage.toFixed(1)}%`);
    
    if (status.daily.percentage > 80) {
      console.log('  ⚠️ Warning: Approaching daily budget limit');
    }
    
    console.log(`\n📊 Monthly:`);
    console.log(`  Spent: $${status.monthly.spent.toFixed(4)} / $${status.monthly.budget}`);
    console.log(`  Remaining: $${status.monthly.remaining.toFixed(4)}`);
    console.log(`  Usage: ${status.monthly.percentage.toFixed(1)}%`);
    
    if (status.monthly.percentage > 90) {
      console.log('  🚨 Alert: Monthly budget almost exceeded!');
    } else if (status.monthly.percentage > 75) {
      console.log('  ⚠️ Warning: Approaching monthly budget limit');
    }
  }
}
```

### Cost Optimization Analysis

```typescript
async function analyzeCostOptimization(): Promise<OptimizationSuggestions> {
  const stats = await api.getUsageStats();
  const suggestions: OptimizationSuggestions = [];

  // Analyze model usage efficiency
  const modelEfficiency = stats.by_model.map(model => ({
    model: model.model,
    costPerToken: model.total_cost / model.total_tokens,
    avgTokensPerSession: model.total_tokens / model.session_count
  }));

  // Find expensive models
  const expensiveModels = modelEfficiency.filter(m => m.costPerToken > 0.00005);
  if (expensiveModels.length > 0) {
    suggestions.push({
      type: 'model_optimization',
      message: `Consider using more cost-effective models for routine tasks. Opus costs ${(expensiveModels[0].costPerToken * 1000000).toFixed(2)}x more per token than Haiku.`,
      savings_potential: stats.total_cost * 0.3 // Estimate 30% savings
    });
  }

  // Analyze project efficiency
  const projectStats = await api.getSessionStats();
  const inefficientProjects = projectStats.filter(p => 
    p.total_cost / p.session_count > 1.0 // More than $1 per session
  );

  if (inefficientProjects.length > 0) {
    suggestions.push({
      type: 'project_optimization',
      message: `Projects with high cost per session detected. Consider breaking down complex tasks or optimizing prompts.`,
      projects: inefficientProjects.map(p => p.project_name),
      savings_potential: inefficientProjects.reduce((sum, p) => sum + p.total_cost, 0) * 0.2
    });
  }

  // Cache utilization analysis
  const cacheUsage = stats.total_cache_read_tokens / (stats.total_input_tokens + stats.total_cache_read_tokens);
  if (cacheUsage < 0.1) {
    suggestions.push({
      type: 'cache_optimization',
      message: `Low cache utilization (${(cacheUsage * 100).toFixed(1)}%). Consider using context caching for repeated content.`,
      savings_potential: stats.total_cost * 0.15
    });
  }

  return suggestions;
}
```

## Performance Metrics

### Session Performance Analysis

```typescript
async function analyzeSessionPerformance(): Promise<PerformanceMetrics> {
  const allRuns = await api.listAgentRuns();
  const completedRuns = allRuns.filter(run => run.status === 'completed' && run.metrics);

  if (completedRuns.length === 0) {
    return { message: 'No completed sessions with metrics found' };
  }

  const metrics = completedRuns.map(run => run.metrics!);
  
  return {
    total_sessions: completedRuns.length,
    avg_duration: metrics.reduce((sum, m) => sum + (m.duration_ms || 0), 0) / metrics.length,
    avg_tokens: metrics.reduce((sum, m) => sum + (m.total_tokens || 0), 0) / metrics.length,
    avg_cost: metrics.reduce((sum, m) => sum + (m.cost_usd || 0), 0) / metrics.length,
    avg_messages: metrics.reduce((sum, m) => sum + (m.message_count || 0), 0) / metrics.length,
    fastest_session: Math.min(...metrics.map(m => m.duration_ms || Infinity)),
    slowest_session: Math.max(...metrics.map(m => m.duration_ms || 0)),
    efficiency_score: calculateEfficiencyScore(metrics)
  };
}

function calculateEfficiencyScore(metrics: AgentRunMetrics[]): number {
  // Score based on tokens per minute and cost efficiency
  const scores = metrics.map(m => {
    const tokensPerMinute = (m.total_tokens || 0) / ((m.duration_ms || 1) / 60000);
    const costPerToken = (m.cost_usd || 0) / (m.total_tokens || 1);
    
    // Higher tokens per minute is better, lower cost per token is better
    return (tokensPerMinute / 100) * (1 / (costPerToken * 1000000));
  });
  
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}
```

### Model Performance Comparison

```typescript
async function compareModelPerformance(): Promise<void> {
  const stats = await api.getUsageStats();
  
  console.log('🤖 Model Performance Comparison:');
  console.log('Model'.padEnd(15) + 'Avg Cost/Session'.padEnd(18) + 'Tokens/Session'.padEnd(16) + 'Efficiency Score');
  console.log('-'.repeat(70));
  
  stats.by_model.forEach(model => {
    const avgCostPerSession = model.total_cost / model.session_count;
    const avgTokensPerSession = model.total_tokens / model.session_count;
    const efficiencyScore = avgTokensPerSession / (avgCostPerSession * 1000); // Tokens per cent
    
    console.log(
      model.model.padEnd(15) +
      `$${avgCostPerSession.toFixed(4)}`.padEnd(18) +
      Math.round(avgTokensPerSession).toLocaleString().padEnd(16) +
      efficiencyScore.toFixed(1)
    );
  });
  
  // Recommendations
  const mostEfficient = stats.by_model.reduce((best, model) => {
    const efficiency = (model.total_tokens / model.session_count) / (model.total_cost / model.session_count);
    const bestEfficiency = (best.total_tokens / best.session_count) / (best.total_cost / best.session_count);
    return efficiency > bestEfficiency ? model : best;
  });
  
  console.log(`\n💡 Most efficient model: ${mostEfficient.model}`);
}
```

## Examples

### Comprehensive Usage Dashboard

```typescript
class UsageDashboard {
  async generateReport(options: ReportOptions = {}): Promise<void> {
    console.log('📊 Claudia Usage Analytics Dashboard');
    console.log('=' .repeat(50));
    
    // Overall statistics
    await this.printOverallStats();
    
    // Recent trends
    if (options.includeTrends !== false) {
      await this.printRecentTrends();
    }
    
    // Project analysis
    if (options.includeProjects !== false) {
      await this.printProjectAnalysis();
    }
    
    // Cost optimization
    if (options.includeOptimization !== false) {
      await this.printOptimizationSuggestions();
    }
    
    // Budget status
    if (options.budgetLimits) {
      await this.printBudgetStatus(options.budgetLimits);
    }
  }

  private async printOverallStats(): Promise<void> {
    const stats = await api.getUsageStats();
    
    console.log('\n📈 Overall Statistics:');
    console.log(`💰 Total Spent: $${stats.total_cost.toFixed(4)}`);
    console.log(`🔢 Total Tokens: ${stats.total_tokens.toLocaleString()}`);
    console.log(`📝 Total Sessions: ${stats.total_sessions}`);
    console.log(`📊 Average Cost/Session: $${(stats.total_cost / stats.total_sessions).toFixed(4)}`);
    
    console.log('\n🏷️ Token Breakdown:');
    console.log(`  📤 Input: ${stats.total_input_tokens.toLocaleString()} (${((stats.total_input_tokens / stats.total_tokens) * 100).toFixed(1)}%)`);
    console.log(`  📥 Output: ${stats.total_output_tokens.toLocaleString()} (${((stats.total_output_tokens / stats.total_tokens) * 100).toFixed(1)}%)`);
    
    if (stats.total_cache_creation_tokens > 0) {
      console.log(`  💾 Cache Write: ${stats.total_cache_creation_tokens.toLocaleString()}`);
    }
    if (stats.total_cache_read_tokens > 0) {
      console.log(`  🔄 Cache Read: ${stats.total_cache_read_tokens.toLocaleString()}`);
    }
  }

  private async printRecentTrends(): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentStats = await api.getUsageByDateRange(
      thirtyDaysAgo.toISOString().split('T')[0],
      new Date().toISOString().split('T')[0]
    );
    
    console.log('\n📅 Last 30 Days:');
    console.log(`💰 Cost: $${recentStats.total_cost.toFixed(4)}`);
    console.log(`🔢 Tokens: ${recentStats.total_tokens.toLocaleString()}`);
    console.log(`📊 Daily Average: $${(recentStats.total_cost / 30).toFixed(4)}`);
    
    // Show top 5 usage days
    const topDays = recentStats.by_date
      .sort((a, b) => b.total_cost - a.total_cost)
      .slice(0, 5);
    
    console.log('\n🏆 Top Usage Days:');
    topDays.forEach((day, index) => {
      console.log(`  ${index + 1}. ${day.date}: $${day.total_cost.toFixed(4)}`);
    });
  }

  private async printProjectAnalysis(): Promise<void> {
    const projectStats = await api.getSessionStats(undefined, undefined, 'desc');
    const topProjects = projectStats.slice(0, 10);
    
    console.log('\n📁 Top 10 Projects by Cost:');
    topProjects.forEach((project, index) => {
      console.log(`  ${index + 1}. ${project.project_name}`);
      console.log(`     Cost: $${project.total_cost.toFixed(4)} | Sessions: ${project.session_count} | Avg: $${(project.total_cost / project.session_count).toFixed(4)}`);
    });
  }

  private async printOptimizationSuggestions(): Promise<void> {
    const suggestions = await analyzeCostOptimization();
    
    if (suggestions.length > 0) {
      console.log('\n💡 Optimization Suggestions:');
      suggestions.forEach((suggestion, index) => {
        console.log(`  ${index + 1}. ${suggestion.message}`);
        if (suggestion.savings_potential) {
          console.log(`     💰 Potential Savings: $${suggestion.savings_potential.toFixed(4)}`);
        }
      });
    } else {
      console.log('\n✅ No obvious optimization opportunities found');
    }
  }

  private async printBudgetStatus(limits: { daily: number; monthly: number }): Promise<void> {
    const monitor = new CostMonitor(limits.daily, limits.monthly);
    const status = await monitor.checkBudgetStatus();
    
    console.log('\n💰 Budget Status:');
    console.log(`📅 Daily: $${status.daily.spent.toFixed(4)} / $${status.daily.budget} (${status.daily.percentage.toFixed(1)}%)`);
    console.log(`📊 Monthly: $${status.monthly.spent.toFixed(4)} / $${status.monthly.budget} (${status.monthly.percentage.toFixed(1)}%)`);
    
    if (status.daily.percentage > 90 || status.monthly.percentage > 90) {
      console.log('🚨 Budget alert: High usage detected!');
    }
  }
}

// Usage
const dashboard = new UsageDashboard();
await dashboard.generateReport({
  includeTrends: true,
  includeProjects: true,
  includeOptimization: true,
  budgetLimits: { daily: 10, monthly: 200 }
});
```

### Export Usage Data

```typescript
async function exportUsageData(format: 'csv' | 'json' = 'csv'): Promise<string> {
  const details = await api.getUsageDetails();
  
  if (format === 'json') {
    return JSON.stringify(details, null, 2);
  }
  
  // CSV format
  const headers = ['timestamp', 'project', 'model', 'input_tokens', 'output_tokens', 'cache_read_tokens', 'cache_write_tokens', 'cost'];
  const csvRows = [headers.join(',')];
  
  details.forEach(entry => {
    const row = [
      entry.timestamp,
      `"${entry.project}"`,
      entry.model,
      entry.input_tokens,
      entry.output_tokens,
      entry.cache_read_tokens,
      entry.cache_write_tokens,
      entry.cost.toFixed(6)
    ];
    csvRows.push(row.join(','));
  });
  
  return csvRows.join('\n');
}

// Export to file
const csvData = await exportUsageData('csv');
await writeTextFile('claudia-usage-export.csv', csvData);
console.log('✅ Usage data exported to claudia-usage-export.csv');
```

---

**Next**: Learn about [Checkpoint System API](./checkpoint-system-api.md) for session versioning and timeline management.