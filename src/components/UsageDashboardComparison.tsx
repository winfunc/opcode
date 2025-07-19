import React from 'react';

/**
 * Usage Dashboard 改进前后对比
 * 展示具体的改进效果
 */

export const UsageDashboardComparison = () => {
  return (
    <div className="p-8 space-y-12">
      <h1 className="text-2xl font-bold text-center">Usage Dashboard 改进对比</h1>
      
      {/* 改进总结 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-red-600">❌ 当前问题</h2>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-1">•</span>
              <span>所有指标卡片视觉权重相同，主次不分</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-1">•</span>
              <span>纯文字展示，缺乏数据可视化</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-1">•</span>
              <span>间距过小(gap-4, p-4)，显得拥挤</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-1">•</span>
              <span>缺少时间筛选、数据导出等功能</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-1">•</span>
              <span>Token数据难以直观对比</span>
            </li>
          </ul>
        </div>
        
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-green-600">✅ 改进方案</h2>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-1">•</span>
              <span>Total Cost放大1.5倍，使用渐变背景突出</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-1">•</span>
              <span>添加进度条、趋势图等可视化元素</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-1">•</span>
              <span>增大间距(gap-6/8, p-8)，提升呼吸感</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-1">•</span>
              <span>顶部添加时间选择、刷新、导出按钮</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-1">•</span>
              <span>使用进度条直观展示Token占比</span>
            </li>
          </ul>
        </div>
      </div>
      
      {/* 具体改进示例 */}
      <div className="space-y-8 max-w-4xl mx-auto">
        <div className="bg-muted/30 rounded-lg p-6">
          <h3 className="font-medium mb-4">1. 主要指标卡片改进</h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-2">改进前：</p>
              <div className="bg-background border rounded p-4">
                <p className="text-xs text-muted-foreground">Total Cost</p>
                <p className="text-lg">$1,314.4922</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">改进后：</p>
              <div className="bg-gradient-to-br from-red-50 to-orange-50 border-red-200/50 rounded-lg p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Cost</p>
                    <p className="text-3xl font-bold">$1,314.49</p>
                    <p className="text-xs text-red-600 mt-1">↑ +12.5% vs last period</p>
                  </div>
                  <div className="p-2 bg-red-100 rounded">💰</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-muted/30 rounded-lg p-6">
          <h3 className="font-medium mb-4">2. Token Breakdown 可视化</h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-2">改进前：</p>
              <div className="bg-background border rounded p-4 text-sm space-y-1">
                <p>Input Tokens: 204.1K</p>
                <p>Output Tokens: 2.30M</p>
                <p>Cache Write: 45.10M</p>
                <p>Cache Read: 891.17M</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">改进后：</p>
              <div className="bg-background border rounded p-4 space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Cache Read</span>
                    <span>94.9%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full">
                    <div className="h-full bg-green-500 rounded-full" style={{width: '94.9%'}}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Cache Write</span>
                    <span>4.8%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full">
                    <div className="h-full bg-blue-500 rounded-full" style={{width: '4.8%'}}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-muted/30 rounded-lg p-6">
          <h3 className="font-medium mb-4">3. 间距对比</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">位置</th>
                <th className="text-center">改进前</th>
                <th className="text-center">改进后</th>
                <th className="text-center">提升</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-2">页面内边距</td>
                <td className="text-center">24px (p-6)</td>
                <td className="text-center">48px (p-12)</td>
                <td className="text-center text-green-600">+100%</td>
              </tr>
              <tr className="border-b">
                <td className="py-2">卡片间距</td>
                <td className="text-center">16px (gap-4)</td>
                <td className="text-center">32px (gap-8)</td>
                <td className="text-center text-green-600">+100%</td>
              </tr>
              <tr className="border-b">
                <td className="py-2">卡片内边距</td>
                <td className="text-center">16px (p-4)</td>
                <td className="text-center">32px (p-8)</td>
                <td className="text-center text-green-600">+100%</td>
              </tr>
              <tr>
                <td className="py-2">区块间距</td>
                <td className="text-center">24px (mb-6)</td>
                <td className="text-center">48px (mb-12)</td>
                <td className="text-center text-green-600">+100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      {/* 实施建议 */}
      <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-6 max-w-4xl mx-auto">
        <h3 className="font-semibold mb-3">🚀 实施建议</h3>
        <ol className="space-y-2 text-sm">
          <li>1. 先调整间距和布局，立即改善视觉体验</li>
          <li>2. 添加顶部操作栏，提供时间筛选等功能</li>
          <li>3. 逐步引入数据可视化，从简单的进度条开始</li>
          <li>4. 最后完善交互细节，如悬停效果、加载状态等</li>
        </ol>
      </div>
    </div>
  );
};