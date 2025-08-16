import React from "react";
import {
  getModelPricing,
  formatPrice,
  getModelCostEfficiency,
  MODEL_USE_CASES,
} from "@/config/pricing";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Zap, Clock, Target } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface ModelPricingInfoProps {
  model: string;
  showDetails?: boolean;
  className?: string;
}

/**
 * ModelPricingInfo component - Displays model pricing information
 *
 * Shows detailed pricing information for Claude models including input/output
 * token costs, cache pricing, cost efficiency ratings, and recommended use cases.
 * Supports both compact and detailed display modes.
 *
 * @param model - Model identifier to show pricing for
 * @param showDetails - Whether to show detailed pricing breakdown (default: false)
 * @param className - Additional CSS classes for styling
 *
 * @example
 * ```tsx
 * // Compact pricing display
 * <ModelPricingInfo model="claude-3-5-sonnet" />
 *
 * // Detailed pricing breakdown
 * <ModelPricingInfo
 *   model="claude-3-5-sonnet"
 *   showDetails={true}
 *   className="max-w-md"
 * />
 * ```
 */
export const ModelPricingInfo: React.FC<ModelPricingInfoProps> = ({
  model,
  showDetails = false,
  className,
}) => {
  const { t } = useI18n();
  const pricing = getModelPricing(model);
  const efficiency = getModelCostEfficiency(model);
  const useCases = MODEL_USE_CASES[model] || [];

  if (!pricing) {
    return (
      <div className={`text-xs text-muted-foreground ${className}`}>
        {t.agents.pricingInfo}不可用
      </div>
    );
  }

  const efficiencyColors = {
    high: "bg-green-100 text-green-800 border-green-200",
    medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
    low: "bg-red-100 text-red-800 border-red-200",
  };

  const efficiencyLabels = {
    high: t.agents.highEfficiency,
    medium: t.agents.mediumEfficiency,
    low: t.agents.lowEfficiency,
  };

  if (!showDetails) {
    return (
      <div className={`text-xs space-y-1 ${className}`}>
        <div className="flex items-center gap-2">
          <DollarSign className="w-3 h-3" />
          <span>
            {t.agents.inputTokens}: {formatPrice(pricing.inputPrice)}/M • {t.agents.outputTokens}:{" "}
            {formatPrice(pricing.outputPrice)}/M
          </span>
        </div>
        <Badge variant="outline" className={`text-xs ${efficiencyColors[efficiency]}`}>
          {efficiencyLabels[efficiency]}
        </Badge>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{t.agents.pricingDetails}</CardTitle>
          <Badge variant="outline" className={efficiencyColors[efficiency]}>
            {efficiencyLabels[efficiency]}
          </Badge>
        </div>
        <CardDescription>
          {t.agents.basedOnOfficialPricing}（{t.agents.perMillionTokens}）
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 基础定价 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clock className="w-4 h-4 text-blue-500" />
              {t.agents.inputTokens}
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {formatPrice(pricing.inputPrice)}
            </div>
            <div className="text-xs text-muted-foreground">{t.agents.perMillionTokens}</div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Zap className="w-4 h-4 text-green-500" />
              {t.agents.outputTokens}
            </div>
            <div className="text-2xl font-bold text-green-600">
              {formatPrice(pricing.outputPrice)}
            </div>
            <div className="text-xs text-muted-foreground">{t.agents.perMillionTokens}</div>
          </div>
        </div>

        {/* 缓存定价 */}
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-3">缓存功能定价</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">5m Cache Write:</span>
              <span className="ml-2 font-medium">{formatPrice(pricing.cacheWritePrice)}/M</span>
            </div>
            {pricing.cacheWrite1hPrice && (
              <div>
                <span className="text-muted-foreground">1h Cache Write:</span>
                <span className="ml-2 font-medium">{formatPrice(pricing.cacheWrite1hPrice)}/M</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">{t.agents.cacheRead}:</span>
              <span className="ml-2 font-medium">{formatPrice(pricing.cacheReadPrice)}/M</span>
            </div>
          </div>
        </div>

        {/* 推荐用途 */}
        {useCases.length > 0 && (
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 text-sm font-medium mb-3">
              <Target className="w-4 h-4 text-purple-500" />
              {t.agents.recommendedUseCases}
            </div>
            <div className="flex flex-wrap gap-2">
              {useCases.map((useCase, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {useCase}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* 成本估算示例 */}
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-3">{t.agents.costEstimate}示例</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">1万输入 + 1万输出 tokens:</span>
              <span className="font-medium">
                {formatPrice((pricing.inputPrice + pricing.outputPrice) / 100)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">10万输入 + 10万输出 tokens:</span>
              <span className="font-medium">
                {formatPrice((pricing.inputPrice + pricing.outputPrice) / 10)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * 简化的定价显示组件，用于列表或卡片中
 */
export const ModelPricingBadge: React.FC<{ model: string; className?: string }> = ({
  model,
  className,
}) => {
  const pricing = getModelPricing(model);
  const efficiency = getModelCostEfficiency(model);

  if (!pricing) return null;

  const efficiencyColors = {
    high: "bg-green-50 text-green-700 border-green-200",
    medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
    low: "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <div
      className={`inline-flex items-center gap-2 px-2 py-1 rounded-md border text-xs ${efficiencyColors[efficiency]} ${className}`}
    >
      <DollarSign className="w-3 h-3" />
      <span>
        {formatPrice(pricing.inputPrice)}/{formatPrice(pricing.outputPrice)}
      </span>
    </div>
  );
};
