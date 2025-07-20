import React from "react";
import { useI18n } from "@/lib/i18n";
import { LanguageSelector } from "@/components/LanguageSelector";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * I18nTest component for testing internationalization functionality
 *
 * A comprehensive test interface for verifying translation functionality,
 * language switching, RTL support, and time formatting across all supported
 * languages. Useful for development and QA testing.
 *
 * @example
 * ```tsx
 * // Add to development routes for testing
 * <Route path="/i18n-test" component={I18nTest} />
 * ```
 */
export const I18nTest: React.FC = () => {
  const { t, language, isRTL } = useI18n();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">多语言测试页面</h1>
        <LanguageSelector />
      </div>

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">当前语言信息</h2>
        <div className="space-y-2 text-sm">
          <p>
            <strong>语言代码:</strong> {language}
          </p>
          <p>
            <strong>是否RTL:</strong> {isRTL ? "是" : "否"}
          </p>
          <p>
            <strong>HTML方向:</strong> {document.documentElement.dir}
          </p>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">翻译测试</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h3 className="font-medium">通用词汇</h3>
            <div className="space-y-1 text-sm">
              <p>
                <strong>保存:</strong> {t.common.save}
              </p>
              <p>
                <strong>取消:</strong> {t.common.cancel}
              </p>
              <p>
                <strong>删除:</strong> {t.common.delete}
              </p>
              <p>
                <strong>设置:</strong> {t.common.settings}
              </p>
              <p>
                <strong>语言:</strong> {t.common.language}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium">应用相关</h3>
            <div className="space-y-1 text-sm">
              <p>
                <strong>欢迎标题:</strong> {t.app.welcomeTitle}
              </p>
              <p>
                <strong>CC智能体:</strong> {t.app.ccAgents}
              </p>
              <p>
                <strong>CC项目:</strong> {t.app.ccProjects}
              </p>
              <p>
                <strong>返回首页:</strong> {t.app.backToHome}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium">项目相关</h3>
            <div className="space-y-1 text-sm">
              <p>
                <strong>项目标题:</strong> {t.projects.title}
              </p>
              <p>
                <strong>项目副标题:</strong> {t.projects.subtitle}
              </p>
              <p>
                <strong>无项目:</strong> {t.projects.noProjects}
              </p>
              <p>
                <strong>新建会话:</strong> {t.projects.newClaudeCodeSession}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium">设置相关</h3>
            <div className="space-y-1 text-sm">
              <p>
                <strong>设置标题:</strong> {t.settings.title}
              </p>
              <p>
                <strong>保存设置:</strong> {t.settings.saveSettings}
              </p>
              <p>
                <strong>通用设置:</strong> {t.settings.generalSettings}
              </p>
              <p>
                <strong>权限规则:</strong> {t.settings.permissionRules}
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">时间格式测试</h2>
        <div className="space-y-2 text-sm">
          <p>
            <strong>刚刚:</strong> {t.time.justNow}
          </p>
          <p>
            <strong>5分钟前:</strong> {t.time.minutesAgo.replace("{count}", "5")}
          </p>
          <p>
            <strong>2小时前:</strong> {t.time.hoursAgo.replace("{count}", "2")}
          </p>
          <p>
            <strong>3天前:</strong> {t.time.daysAgo.replace("{count}", "3")}
          </p>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">按钮测试</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="default">{t.common.save}</Button>
          <Button variant="outline">{t.common.cancel}</Button>
          <Button variant="destructive">{t.common.delete}</Button>
          <Button variant="secondary">{t.common.edit}</Button>
          <Button variant="ghost">{t.common.close}</Button>
        </div>
      </Card>
    </div>
  );
};
