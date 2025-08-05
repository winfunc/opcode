import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import mermaid from 'mermaid';
import { useTheme } from '@/hooks';
import { Maximize2, Copy, ZoomIn, ZoomOut, RotateCcw, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import Panzoom from '@panzoom/panzoom';

interface MermaidRendererProps {
  chart: string;
  id?: string;
  showControls?: boolean; // Whether to show control buttons
  fullscreen?: boolean; // Whether to use fullscreen pan-zoom viewer
}

// Fullscreen component with pan-zoom functionality
const FullscreenMermaidViewer: React.FC<{ svg: string; chart: string }> = ({ svg, chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgContentRef = useRef<HTMLDivElement>(null);
  const panzoomRef = useRef<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (svgContentRef.current && svg && containerRef.current) {
      // Initialize panzoom on the SVG content
      panzoomRef.current = Panzoom(svgContentRef.current, {
        maxScale: 5,
        minScale: 0.1,
        contain: false,
        cursor: 'move',
        startScale: 1,
      });

      // Calculate initial scale to fit dialog height
      const calculateFitScale = () => {
        const container = containerRef.current;
        const svgContent = svgContentRef.current;
        
        if (container && svgContent) {
          const containerHeight = container.clientHeight;
          const containerWidth = container.clientWidth;
          const svgElement = svgContent.querySelector('svg');
          
          if (svgElement) {
            // Get SVG's natural dimensions
            const svgRect = svgElement.getBoundingClientRect();
            const svgHeight = svgRect.height;
            
            if (svgHeight > 0 && containerHeight > 0) {
              // Calculate scale to fit height with some padding (90% of container height)
              const targetHeight = containerHeight * 0.9;
              const scale = targetHeight / svgHeight;
              
              // Only scale up to fit if SVG is smaller than container
              // Don't scale down too much (minimum 0.5x)
              const finalScale = Math.max(0.5, Math.min(scale, 2));
              
              if (finalScale !== 1) {
                // Apply the scale
                panzoomRef.current.zoom(finalScale, { animate: false });
                
                // After scaling, center the SVG vertically in the viewport
                setTimeout(() => {
                  const scaledHeight = svgHeight * finalScale;
                  const offsetY = (containerHeight - scaledHeight) / 2;
                  
                  // Pan to center vertically (keep horizontal center)
                  panzoomRef.current.pan(0, offsetY, { animate: false });
                }, 50);
              }
            }
          }
        }
      };

      // Wait for SVG to be fully rendered, then calculate scale
      setTimeout(calculateFitScale, 100);

      return () => {
        if (panzoomRef.current) {
          panzoomRef.current.destroy();
        }
      };
    }
  }, [svg]);

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(chart);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  }, [chart]);

  const zoomIn = useCallback(() => {
    if (panzoomRef.current) {
      panzoomRef.current.zoomIn();
    }
  }, []);

  const zoomOut = useCallback(() => {
    if (panzoomRef.current) {
      panzoomRef.current.zoomOut();
    }
  }, []);

  const resetView = useCallback(() => {
    if (panzoomRef.current) {
      panzoomRef.current.reset();
    }
  }, []);

  return (
    <div className="w-full h-full relative bg-background" ref={containerRef}>
      {/* Fixed viewport container - this defines the viewing area */}
      <div className="w-full h-full overflow-hidden relative">
        {/* SVG content container - this is what panzoom moves around */}
        <div 
          ref={svgContentRef}
          className="absolute"
          style={{
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)', // Center horizontally initially
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
      
      {/* Controls */}
      <div className="absolute top-4 right-4 flex gap-2 bg-background/80 backdrop-blur-sm rounded-lg p-2 border">
        <Button
          variant="secondary"
          size="sm"
          onClick={zoomOut}
          className="h-8 w-8 p-0"
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={zoomIn}
          className="h-8 w-8 p-0"
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={resetView}
          className="h-8 w-8 p-0"
          title="Reset view"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          variant={copied ? "default" : "secondary"}
          size="sm"
          onClick={copyToClipboard}
          className={copied ? "h-8 w-8 p-0 bg-green-600 hover:bg-green-700 text-white" : "h-8 w-8 p-0"}
          title="Copy code"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};

// Unified height of 500px for all charts
const CHART_HEIGHT = 500;

// Global cache for rendered SVGs to prevent re-rendering identical charts
const chartCache = new Map<string, { svg: string; timestamp: number }>();
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 100;

// Clean up expired cache entries
const cleanupCache = () => {
  const now = Date.now();
  const entries = Array.from(chartCache.entries());
  
  // Remove expired entries
  entries.forEach(([key, value]) => {
    if (now - value.timestamp > CACHE_EXPIRY_MS) {
      chartCache.delete(key);
    }
  });
  
  // If still too large, remove oldest entries
  if (chartCache.size > MAX_CACHE_SIZE) {
    const sortedEntries = entries
      .filter(([key]) => chartCache.has(key)) // Only keep non-expired entries
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = chartCache.size - MAX_CACHE_SIZE;
    for (let i = 0; i < toRemove; i++) {
      chartCache.delete(sortedEntries[i][0]);
    }
  }
};

// Run cleanup periodically
setInterval(cleanupCache, 60000); // Every minute

// Create a stable hash for chart content + theme combination
const createChartHash = (chart: string, theme: string): string => {
  const content = `${chart}-${theme}`;
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
};

const MermaidRenderer: React.FC<MermaidRendererProps> = ({ chart, id, showControls = true, fullscreen = false }) => {
  const { theme } = useTheme();
  const elementRef = useRef<HTMLDivElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [copied, setCopied] = useState(false);
  const renderRequestRef = useRef<number>(0);
  const hasInitializedRef = useRef<boolean>(false);

  // Copy SVG code to clipboard
  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(chart);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  }, [chart]);

  // Use unified fixed height
  const containerHeight = CHART_HEIGHT;

  // Create a stable chart ID based on content and provided ID
  const chartId = useMemo(() => {
    if (id) return id;
    return createChartHash(chart, theme);
  }, [chart, theme, id]);

  // Create cache key for this chart
  const cacheKey = useMemo(() => {
    return createChartHash(chart, theme);
  }, [chart, theme]);

  // Check if we have cached result immediately
  const cachedEntry = chartCache.get(cacheKey);
  const hasCachedResult = cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_EXPIRY_MS);

  // If we have a cached result, set it immediately
  useEffect(() => {
    if (hasCachedResult && !hasInitializedRef.current && cachedEntry) {
      setSvg(cachedEntry.svg);
      setError(null);
      hasInitializedRef.current = true;
    }
  }, [cacheKey, hasCachedResult, cachedEntry]);

  // Render chart immediately when component mounts (for dialog usage)
  useEffect(() => {
    // Skip if already initialized with cached result
    if (hasInitializedRef.current) {
      return;
    }

    const currentRequest = ++renderRequestRef.current;
    
    // Check cache first
    const cachedEntry = chartCache.get(cacheKey);
    if (cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_EXPIRY_MS)) {
      setSvg(cachedEntry.svg);
      setError(null);
      hasInitializedRef.current = true;
      return;
    }
    
    const renderChart = async () => {
      if (isRendering) {
        return;
      }
      
      try {
        setIsRendering(true);
        setError(null);
        
        // Configure mermaid theme
        mermaid.initialize({
          startOnLoad: false,
          theme: theme === 'dark' ? 'dark' : 'default',
          securityLevel: 'loose',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
        });

        // Validate and render chart
        const { svg: renderedSvg } = await mermaid.render(chartId, chart);
        
        // Only update if this is still the current request
        if (currentRequest === renderRequestRef.current) {
          // Cache the result with timestamp
          chartCache.set(cacheKey, { svg: renderedSvg, timestamp: Date.now() });
          setSvg(renderedSvg);
          hasInitializedRef.current = true;
        }
      } catch (err) {
        if (currentRequest === renderRequestRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to render Mermaid chart');
          hasInitializedRef.current = true;
        }
      } finally {
        if (currentRequest === renderRequestRef.current) {
          setIsRendering(false);
        }
      }
    };

    // Use requestAnimationFrame to defer rendering until the next frame
    const frameId = requestAnimationFrame(() => {
      if (chart && chart.trim() && currentRequest === renderRequestRef.current) {
        renderChart();
      }
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [chart, theme, cacheKey]); // Simplified dependencies

  // Render control buttons
  const renderControls = () => (
    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <Button
        variant={copied ? "default" : "secondary"}
        size="sm"
        onClick={copyToClipboard}
        className={copied ? "h-7 w-7 p-0 bg-green-600 hover:bg-green-700 text-white" : "h-7 w-7 p-0"}
        title="Copy code"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </Button>
    </div>
  );

  if (error) {
    return (
      <div 
        className="border border-destructive/50 bg-destructive/10 rounded-md p-3"
        style={{ height: containerHeight }}
      >
        <div className="text-sm font-medium text-destructive mb-1">Mermaid Rendering Error</div>
        <div className="text-xs text-destructive/80">{error}</div>
        <details className="mt-2">
          <summary className="text-xs text-muted-foreground cursor-pointer">Show raw code</summary>
          <pre className="text-xs font-mono mt-1 p-2 bg-background rounded border overflow-x-auto">
            {chart}
          </pre>
        </details>
      </div>
    );
  }

  if (!svg) {
    return (
      <div 
        ref={elementRef}
        className="border border-muted rounded-md p-3 flex items-center justify-center"
        style={{ height: containerHeight }}
      >
        <div className="text-center">
          <div className="text-sm text-muted-foreground">
            {isRendering ? 'Rendering Mermaid chart...' : 'Preparing to render Mermaid chart...'}
          </div>
        </div>
      </div>
    );
  }

  // Return fullscreen viewer if in fullscreen mode
  if (fullscreen && svg) {
    return <FullscreenMermaidViewer svg={svg} chart={chart} />;
  }

  // Normal mode
  return (
    <div 
      ref={elementRef}
      className="mermaid-container group relative border border-muted rounded-md bg-background overflow-hidden"
      style={{ height: showControls ? containerHeight : 'auto' }} // Remove height restriction when no controls
    >
      <div 
        className="w-full h-full overflow-auto p-4 flex items-center justify-center"
        ref={svgContainerRef}
      >
        <div dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
      {showControls && renderControls()}
    </div>
  );
};

export default React.memo(MermaidRenderer, (prevProps, nextProps) => {
  // Only re-render if the chart content, id, or fullscreen mode actually changed
  return prevProps.chart === nextProps.chart && 
         prevProps.id === nextProps.id && 
         prevProps.fullscreen === nextProps.fullscreen;
});