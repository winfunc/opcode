import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { logger, LogLevel } from "@/lib/logger";

/**
 * Props interface for the LoggerSettings component
 */
interface LoggerSettingsProps {
  className?: string;
}

/**
 * LoggerSettings component for configuring application logging
 *
 * A comprehensive settings interface for managing application logging behavior
 * including log levels, console output, and testing capabilities. Features
 * real-time configuration updates and detailed level descriptions.
 *
 * @param className - Optional className for styling
 *
 * @example
 * ```tsx
 * <LoggerSettings className="max-w-md" />
 * ```
 */
export const LoggerSettings: React.FC<LoggerSettingsProps> = ({ className }) => {
  const [config, setConfig] = useState(logger.getConfig());

  useEffect(() => {
    setConfig(logger.getConfig());
  }, []);

  /**
   * Handle log level change
   *
   * @param level - New log level string
   */
  const handleLevelChange = (level: string) => {
    const logLevel = LogLevel[level as keyof typeof LogLevel];
    logger.setLevel(logLevel);
    setConfig(logger.getConfig());
  };

  /**
   * Handle console output toggle
   *
   * @param enabled - Whether console output should be enabled
   */
  const handleConsoleToggle = (enabled: boolean) => {
    logger.setConsoleEnabled(enabled);
    setConfig(logger.getConfig());
  };

  const getLevelName = (level: LogLevel): string => {
    return (
      Object.keys(LogLevel).find((key) => LogLevel[key as keyof typeof LogLevel] === level) ||
      "INFO"
    );
  };

  return (
    <Card className={`p-6 ${className}`}>
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">日志设置</h3>
          <p className="text-sm text-gray-600 mb-4">
            配置应用程序的日志级别和输出选项。生产环境建议使用 WARN 或 ERROR 级别。
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="log-level">日志级别</Label>
            <Select value={getLevelName(config.level)} onValueChange={handleLevelChange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DEBUG">DEBUG</SelectItem>
                <SelectItem value="INFO">INFO</SelectItem>
                <SelectItem value="WARN">WARN</SelectItem>
                <SelectItem value="ERROR">ERROR</SelectItem>
                <SelectItem value="NONE">NONE</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="console-enabled">启用控制台输出</Label>
            <Switch
              id="console-enabled"
              checked={config.enableConsole}
              onCheckedChange={handleConsoleToggle}
            />
          </div>

          <div className="text-sm text-gray-500">
            <p>
              <strong>DEBUG:</strong> 显示所有日志信息，包括调试信息
            </p>
            <p>
              <strong>INFO:</strong> 显示一般信息和更高级别的日志
            </p>
            <p>
              <strong>WARN:</strong> 仅显示警告和错误信息
            </p>
            <p>
              <strong>ERROR:</strong> 仅显示错误信息
            </p>
            <p>
              <strong>NONE:</strong> 不显示任何日志
            </p>
          </div>
        </div>

        <div className="pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              logger.debug("测试调试日志");
              logger.info("测试信息日志");
              logger.warn("测试警告日志");
              logger.error("测试错误日志");
            }}
          >
            测试日志输出
          </Button>
        </div>
      </div>
    </Card>
  );
};
