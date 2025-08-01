import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { getLanguageIcon, getLanguageColor } from '@/lib/languageIcons';
import { cn } from '@/lib/utils';

interface LanguageStats {
  name: string;
  percentage: number;
  bytes: number;
  color: string;
}

interface ProjectAnalysis {
  languages: LanguageStats[];
  total_files: number;
  total_bytes: number;
  analyzed_at: number;
}

interface ProjectLanguagesProps {
  projectPath: string;
  projectId: string;
  maxLanguages?: number;
  className?: string;
}

// Memoize loading skeleton to prevent re-renders
const LoadingSkeleton = React.memo(() => (
  <div className="flex gap-1 mt-2">
    <div className="h-5 flex items-center gap-2">
      <div className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1 h-3 bg-muted-foreground/20 rounded-full animate-pulse"
            style={{
              animationDelay: `${i * 150}ms`,
              animationDuration: '1s'
            }}
          />
        ))}
      </div>
      <span className="text-[9px] text-muted-foreground/50">Analyzing...</span>
    </div>
  </div>
));

LoadingSkeleton.displayName = 'LoadingSkeleton';

// Memoize empty state to prevent re-renders
const EmptyState = React.memo(() => (
  <div className="flex gap-1 mt-2">
    <Badge 
      variant="outline" 
      className="text-[9px] px-1.5 py-0 h-5 opacity-50 cursor-not-allowed"
    >
      <svg 
        className="w-2 h-2 mr-0.5" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" 
        />
      </svg>
      <span className="font-medium">Empty codebase</span>
    </Badge>
  </div>
));

EmptyState.displayName = 'EmptyState';

// Language badge component
const LanguageBadge = React.memo<{
  lang: LanguageStats;
  color: string;
  IconComponent: any;
  context: string | null;
  isBlackLogo: boolean;
}>(({ lang, color, IconComponent, context, isBlackLogo }) => (
  <Badge
    variant="secondary"
    className="text-[9px] pl-1.5 pr-1 py-0 h-5 flex items-center gap-0.5 transition-colors border"
    style={{
      backgroundColor: `${color}18`,
      borderColor: `${color}30`,
      color: 'hsl(var(--foreground))'
    }}
  >
    {IconComponent && (
      <IconComponent 
        className="w-2 h-2 mr-0.5 flex-shrink-0" 
        style={{ 
          color: color,
          opacity: 0.8,
          filter: isBlackLogo ? 'brightness(0) invert(1)' : 'none'
        }} 
      />
    )}
    <span className="font-medium opacity-90">{lang.name}</span>
    {context && (
      <span 
        className="px-0.5 py-0 text-[8px] rounded-sm opacity-60"
        style={{
          backgroundColor: `${color}20`,
        }}
      >
        {context}
      </span>
    )}
    <span 
      className="ml-0.5 px-0.5 py-0 text-[9px] font-mono rounded-sm"
      style={{
        backgroundColor: `${color}25`,
        color: 'hsl(var(--foreground))'
      }}
    >
      {lang.percentage.toFixed(1)}%
    </span>
  </Badge>
));

LanguageBadge.displayName = 'LanguageBadge';

export const ProjectLanguages = React.memo<ProjectLanguagesProps>(({
  projectPath,
  projectId,
  maxLanguages = 5,
  className
}) => {
  const [analysis, setAnalysis] = useState<ProjectAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Memoize cache operations
  const cacheKey = useMemo(() => `lang_analysis_${projectId}`, [projectId]);
  
  const getCachedData = useCallback(() => {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        const oneHourAgo = Date.now() - 3600000;
        if (timestamp > oneHourAgo) {
          return data;
        }
      } catch (e) {
        // Silent fail for cache parsing
      }
    }
    return null;
  }, [cacheKey]);

  const setCachedData = useCallback((data: ProjectAnalysis) => {
    try {
      localStorage.setItem(cacheKey, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (e) {
      // Silent fail for cache writing
    }
  }, [cacheKey]);

  useEffect(() => {
    let cancelled = false;

    const fetchLanguages = async () => {
      // Check cache first
      const cachedData = getCachedData();
      if (cachedData) {
        if (!cancelled) {
          setAnalysis(cachedData);
          setLoading(false);
        }
        return;
      }

      try {
        const data = await api.analyzeProjectLanguages(projectPath);
        if (!cancelled) {
          setAnalysis(data);
          setCachedData(data);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Analysis failed');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchLanguages();

    return () => {
      cancelled = true;
    };
  }, [projectPath, getCachedData, setCachedData]);

  // Memoize language processing
  const { displayLanguages, remainingCount } = useMemo(() => {
    if (!analysis || analysis.languages.length === 0) {
      return { displayLanguages: [], remainingCount: 0 };
    }

    // Group related languages together
    const languageGroups: Record<string, string[]> = {
      'TypeScript': ['TSX', 'TypeScript'],
      'JavaScript': ['JSX', 'JavaScript'],
      'Style': ['CSS', 'SCSS', 'SASS', 'Less'],
      'Data': ['JSON', 'YAML', 'TOML', 'XML']
    };
    
    // Sort languages with grouping
    const sortedLanguages = [...analysis.languages].sort((a, b) => {
      // First by percentage
      if (Math.abs(b.percentage - a.percentage) > 5) {
        return b.percentage - a.percentage;
      }
      
      // Then group related languages
      for (const [, group] of Object.entries(languageGroups)) {
        const aInGroup = group.includes(a.name);
        const bInGroup = group.includes(b.name);
        if (aInGroup && bInGroup) {
          return group.indexOf(a.name) - group.indexOf(b.name);
        }
        if (aInGroup || bInGroup) {
          return aInGroup ? -1 : 1;
        }
      }
      
      return b.percentage - a.percentage;
    });
    
    return {
      displayLanguages: sortedLanguages.slice(0, maxLanguages),
      remainingCount: Math.max(0, analysis.languages.length - maxLanguages)
    };
  }, [analysis, maxLanguages]);

  // Languages that have black/dark logos that need to be inverted to white
  const blackLogoLanguages = useMemo(() => [
    'Markdown', 'Next.js', 'Apple', 'Flask', 'GitHub', 'Rust', 
    'Shell', 'JSON', 'C', 'Django', 'Ruby'
  ], []);

  // Get language context (UI, Config, etc)
  const getLanguageContext = useCallback((lang: string): string | null => {
    if (lang === 'TSX' || lang === 'JSX') return 'UI';
    if (lang === 'JSON' || lang === 'YAML' || lang === 'TOML') return 'Config';
    if (lang === 'SCSS' || lang === 'SASS' || lang === 'Less') return 'Style';
    return null;
  }, []);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error || !analysis || analysis.languages.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className={cn("flex flex-wrap gap-1 mt-2", className)}>
      {displayLanguages.map((lang) => {
        const IconComponent = getLanguageIcon(lang.name);
        const color = lang.color || getLanguageColor(lang.name);
        const context = getLanguageContext(lang.name);
        const isBlackLogo = blackLogoLanguages.includes(lang.name);
        
        return (
          <LanguageBadge
            key={lang.name}
            lang={lang}
            color={color}
            IconComponent={IconComponent}
            context={context}
            isBlackLogo={isBlackLogo}
          />
        );
      })}
      
      {remainingCount > 0 && (
        <Badge 
          variant="outline" 
          className="text-[10px] px-1.5 py-0 h-5 text-muted-foreground"
        >
          +{remainingCount}
        </Badge>
      )}
    </div>
  );
});

ProjectLanguages.displayName = 'ProjectLanguages';