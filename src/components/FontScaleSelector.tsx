import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Type, Minus, Plus } from 'lucide-react';
import { FONT_SCALE_OPTIONS, useFontScale, type FontScale } from '@/lib/fontScale';
import { useI18n } from '@/lib/i18n';

interface FontScaleSelectorProps {
  className?: string;
  showLabel?: boolean;
  variant?: 'select' | 'buttons' | 'compact';
}

/**
 * Font Scale Selector Component
 * 
 * Provides a UI for users to adjust the application's font scale.
 * Supports multiple display variants for different use cases.
 */
export const FontScaleSelector: React.FC<FontScaleSelectorProps> = ({
  className = '',
  showLabel = true,
  variant = 'select'
}) => {
  const { t } = useI18n();
  const { scale, setScale, increase, decrease, customMultiplier } = useFontScale();

  const scaleOptions = Object.entries(FONT_SCALE_OPTIONS).map(([key, config]) => ({
    value: key as FontScale,
    label: t.settings[`fontScale${key.charAt(0).toUpperCase() + key.slice(1).replace('-', '')}` as keyof typeof t.settings] as string,
    multiplier: key === 'custom' ? customMultiplier : config.multiplier
  }));

  if (variant === 'compact') {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <Button
          variant="outline"
          size="sm"
          onClick={decrease}
          disabled={scale === 'small'}
          className="h-8 w-8 p-0"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium min-w-[60px] text-center">
          {scale === 'custom' ? `${customMultiplier}x` : `${FONT_SCALE_OPTIONS[scale].multiplier}x`}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={increase}
          disabled={scale === 'extra-large'}
          className="h-8 w-8 p-0"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (variant === 'buttons') {
    return (
      <div className={`space-y-2 ${className}`}>
        {showLabel && (
          <div className="flex items-center space-x-2">
            <Type className="h-4 w-4" />
            <span className="text-sm font-medium">{t.settings.fontScale}</span>
          </div>
        )}
        <div className="flex space-x-2">
          {scaleOptions.map((option) => (
            <Button
              key={option.value}
              variant={scale === option.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setScale(option.value)}
              className="text-xs"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  // Default select variant
  return (
    <div className={`space-y-2 ${className}`}>
      {showLabel && (
        <div className="flex items-center space-x-2">
          <Type className="h-4 w-4" />
          <span className="text-sm font-medium">{t.settings.fontScale}</span>
        </div>
      )}
      <Select value={scale} onValueChange={(value: FontScale) => setScale(value)}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t.settings.fontScale} />
        </SelectTrigger>
        <SelectContent>
          {scaleOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label} ({option.multiplier}x)
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};