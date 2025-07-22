import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Activity, 
  Zap, 
  BarChart3,
  Download,
  RefreshCw,
  Calendar
} from 'lucide-react';

/**
 * 改进的Usage Dashboard设计
 * 遵循以下原则：
 * 1. 清晰的视觉层次
 * 2. 适当的留白
 * 3. 数据可视化
 * 4. 响应式设计
 * 5. 交互性增强
 */

export const ImprovedUsageDashboard = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* 主容器 - 增加内边距 */}
      <div className="container mx-auto px-4 md:px-8 lg:px-12 py-6 md:py-10">
        
        {/* 顶部操作栏 */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Usage Dashboard</h1>
            <p className="text-muted-foreground mt-1">Track your Claude Code usage and costs</p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* 时间范围选择 */}
            <Button variant="outline" size="sm">
              <Calendar className="h-4 w-4 mr-2" />
              Last 30 Days
            </Button>
            
            <Button variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* 主要指标卡片 - 响应式网格 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {/* Total Cost - 主要指标，视觉权重更高 */}
          <Card className="lg:col-span-2 p-8 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 border-red-200/50">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Total Cost</p>
                <p className="text-4xl font-bold">$1,314.49</p>
                <div className="flex items-center gap-2 mt-2">
                  <TrendingUp className="h-4 w-4 text-red-600" />
                  <span className="text-sm text-red-600">+12.5% from last period</span>
                </div>
              </div>
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <DollarSign className="h-6 w-6 text-red-600" />
              </div>
            </div>
            
            {/* 迷你趋势图占位 */}
            <div className="mt-4 h-16 bg-red-100/50 dark:bg-red-900/20 rounded"></div>
          </Card>

          {/* Total Sessions */}
          <Card className="p-8">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Total Sessions</p>
                <p className="text-3xl font-bold">10,341</p>
                <p className="text-sm text-muted-foreground mt-1">2.30M tokens</p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Activity className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </Card>

          {/* Avg Cost/Session */}
          <Card className="p-8">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Avg Cost/Session</p>
                <p className="text-3xl font-bold">$0.127</p>
                <div className="flex items-center gap-2 mt-1">
                  <TrendingDown className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-600">-5.2%</span>
                </div>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Zap className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Token Breakdown - 可视化改进 */}
        <Card className="p-8 mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Token Breakdown</h2>
            <p className="text-sm text-muted-foreground">Total: 938.77M tokens</p>
          </div>
          
          {/* 使用进度条可视化 */}
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Cache Read</span>
                <span className="text-sm text-muted-foreground">891.17M (94.9%)</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{width: '94.9%'}}></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Cache Write</span>
                <span className="text-sm text-muted-foreground">45.10M (4.8%)</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{width: '4.8%'}}></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Output Tokens</span>
                <span className="text-sm text-muted-foreground">2.30M (0.2%)</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 rounded-full" style={{width: '0.2%'}}></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Input Tokens</span>
                <span className="text-sm text-muted-foreground">204.1K (0.02%)</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{width: '0.02%'}}></div>
              </div>
            </div>
          </div>
        </Card>

        {/* 下方内容区 - 响应式两栏布局 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Most Used Models */}
          <Card className="p-8">
            <h3 className="text-lg font-semibold mb-6">Most Used Models</h3>
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors cursor-pointer">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">claude-opus-4-20230514</span>
                  <span className="text-lg font-semibold">$1,053.64</span>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>4947 sessions</span>
                  <span>82.3% of total</span>
                </div>
                <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{width: '82.3%'}}></div>
                </div>
              </div>
              
              <div className="p-4 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors cursor-pointer">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">claude-sonnet-4-20230514</span>
                  <span className="text-lg font-semibold">$260.85</span>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>5394 sessions</span>
                  <span>17.7% of total</span>
                </div>
                <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary/60 rounded-full" style={{width: '17.7%'}}></div>
                </div>
              </div>
            </div>
          </Card>

          {/* Top Projects */}
          <Card className="p-8">
            <h3 className="text-lg font-semibold mb-6">Top Projects</h3>
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors cursor-pointer">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium truncate">/Users/guoshuaihao/Project/...</span>
                  <span className="text-lg font-semibold">$139.93</span>
                </div>
                <p className="text-sm text-muted-foreground">552 sessions</p>
              </div>
              
              <div className="p-4 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors cursor-pointer">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium truncate">/Users/guoshuaihao/Project/...</span>
                  <span className="text-lg font-semibold">$110.96</span>
                </div>
                <p className="text-sm text-muted-foreground">679 sessions</p>
              </div>
              
              <div className="p-4 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors cursor-pointer">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium truncate">/Users/guoshuaihao/Develo...</span>
                  <span className="text-lg font-semibold">$109.44</span>
                </div>
                <p className="text-sm text-muted-foreground">554 sessions</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};