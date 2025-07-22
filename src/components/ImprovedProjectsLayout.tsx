/**
 * 行业标准布局改进方案
 * 
 * 设计原则：
 * 1. 使用8px网格系统（所有间距都是8的倍数）
 * 2. 明确的视觉层次结构
 * 3. 充足的留白空间
 * 4. 响应式断点设计
 * 5. 符合Material Design和Apple HIG的间距标准
 */

import React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const ImprovedProjectsLayout = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* 
        主容器：使用更大的内边距
        - 桌面端：px-12 py-12 (48px)
        - 平板端：px-8 py-10 (32px/40px)
        - 手机端：px-4 py-6 (16px/24px)
      */}
      <div className="container mx-auto px-4 md:px-8 lg:px-12 py-6 md:py-10 lg:py-12">
        
        {/* 
          页面标题区域
          - 使用mb-16 (64px) 创建明显的区域分隔
          - 标题使用更大的字号和行高
        */}
        <header className="mb-16">
          <div className="mb-8">
            <Button variant="ghost" size="sm" className="mb-6">
              ← Back to Home
            </Button>
          </div>
          
          <div className="space-y-3">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              CC Projects
            </h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-2xl">
              Browse and manage your Claude Code sessions
            </p>
          </div>
        </header>

        {/* 
          内容区域：使用更大的section间距
          space-y-16 (64px) 在主要区块之间
        */}
        <div className="space-y-16">
          
          {/* 操作区域 */}
          <section>
            <Button size="lg" className="w-full md:w-auto min-w-[280px]">
              <Plus className="mr-2 h-5 w-5" />
              New Claude Code session
            </Button>
          </section>

          {/* 
            活跃会话区域
            - 使用卡片容器增加视觉分组
            - 内部padding使用p-8 (32px)
          */}
          <section>
            <Card className="p-8 border-2 border-green-200/50 bg-green-50/30 dark:bg-green-950/20">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <h2 className="text-xl font-semibold">Active Claude Sessions</h2>
                </div>
                <span className="text-sm text-muted-foreground">(2 running)</span>
              </div>
              
              {/* 会话卡片列表 */}
              <div className="space-y-4">
                {/* 示例会话卡片 */}
                <Card className="p-6 hover:shadow-lg transition-all">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-sm">Session #12345...</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        ~/projects/my-app
                      </p>
                    </div>
                    <Button size="sm" variant="ghost">
                      Resume →
                    </Button>
                  </div>
                </Card>
              </div>
            </Card>
          </section>

          {/* 
            项目列表区域
            - 标题使用更大的字号 text-2xl
            - 标题与内容间距 mb-8 (32px)
          */}
          <section>
            <h2 className="text-2xl font-semibold mb-8">All Projects</h2>
            
            {/* 
              项目网格
              - 使用gap-8 (32px) 增加卡片间距
              - 卡片内部使用p-8 (32px) 增加内部空间
            */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card 
                  key={i} 
                  className="p-8 hover:shadow-xl transition-all cursor-pointer"
                >
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <span className="text-lg">📁</span>
                      </div>
                      <h3 className="text-lg font-semibold">Project {i}</h3>
                    </div>
                    
                    <p className="text-sm text-muted-foreground">
                      ~/projects/example-{i}
                    </p>
                    
                    <div className="pt-4 border-t">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Updated 2 hours ago</span>
                        <span>3 sessions</span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            
            {/* 分页区域：与内容保持适当距离 */}
            <div className="mt-12 flex justify-center">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">Previous</Button>
                <span className="px-4 text-sm">Page 1 of 3</span>
                <Button variant="outline" size="sm">Next</Button>
              </div>
            </div>
          </section>
        </div>
        
        {/* 页脚留白：确保底部有足够空间 */}
        <div className="h-16" />
      </div>
    </div>
  );
};

/**
 * 间距规范总结：
 * 
 * 1. 页面级内边距：
 *    - 桌面: 48px (px-12)
 *    - 平板: 32px (px-8)
 *    - 手机: 16px (px-4)
 * 
 * 2. 主要区块间距：
 *    - 页面标题到内容: 64px (mb-16)
 *    - 区块之间: 64px (space-y-16)
 *    - 子标题到内容: 32px (mb-8)
 * 
 * 3. 组件内部间距：
 *    - 卡片内边距: 32px (p-8)
 *    - 卡片间距: 32px (gap-8)
 *    - 列表项间距: 16px (space-y-4)
 * 
 * 4. 响应式考虑：
 *    - 使用响应式类名适配不同屏幕
 *    - 小屏幕适当减少间距
 *    - 保持视觉层次的一致性
 */