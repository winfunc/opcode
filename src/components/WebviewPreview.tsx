import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  X,
  Minimize2,
  Maximize2,
  Loader2,
  AlertCircle,
  Globe,
  Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface WebviewPreviewProps {
  /**
   * Initial URL to load
   */
  initialUrl: string;
  /**
   * Callback when close is clicked
   */
  onClose: () => void;
  /**
   * Whether the webview is maximized
   */
  isMaximized?: boolean;
  /**
   * Callback when maximize/minimize is clicked
   */
  onToggleMaximize?: () => void;
  /**
   * Callback when URL changes
   */
  onUrlChange?: (url: string) => void;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * WebviewPreview component - Browser-like webview with navigation controls
 * 
 * @example
 * <WebviewPreview
 *   initialUrl="http://localhost:3000"
 *   onClose={() => setShowPreview(false)}
 * />
 */
const WebviewPreviewComponent: React.FC<WebviewPreviewProps> = ({
  initialUrl,
  onClose,
  isMaximized = false,
  onToggleMaximize,
  onUrlChange,
  className,
}) => {
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [inputUrl, setInputUrl] = useState(initialUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  // TODO: These will be implemented with actual webview navigation
  // const [canGoBack, setCanGoBack] = useState(false);
  // const [canGoForward, setCanGoForward] = useState(false);
  
  // TODO: These will be used for actual Tauri webview implementation
  // const webviewRef = useRef<WebviewWindow | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // const previewId = useRef(`preview-${Date.now()}`);

  // Handle ESC key to exit full screen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMaximized && onToggleMaximize) {
        onToggleMaximize();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMaximized, onToggleMaximize]);

  // Debug: Log initial URL on mount
  useEffect(() => {
    console.log('[WebviewPreview] Component mounted with initialUrl:', initialUrl, 'isMaximized:', isMaximized);
  }, []);

  // Focus management for full screen mode
  useEffect(() => {
    if (isMaximized && containerRef.current) {
      containerRef.current.focus();
    }
  }, [isMaximized]);

  // For now, we'll use an iframe as a placeholder
  // In the full implementation, this would create a Tauri webview window
  useEffect(() => {
    if (currentUrl) {
      // This is where we'd create the actual webview
      // For now, using iframe for demonstration
      setIsLoading(true);
      setHasError(false);
      
      // Simulate loading
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [currentUrl]);

  const navigate = (url: string) => {
    try {
      // Validate URL
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      const finalUrl = urlObj.href;
      
      console.log('[WebviewPreview] Navigating to:', finalUrl);
      setCurrentUrl(finalUrl);
      setInputUrl(finalUrl);
      setHasError(false);
      onUrlChange?.(finalUrl);
    } catch (err) {
      setHasError(true);
      setErrorMessage("Invalid URL");
    }
  };

  const handleNavigate = () => {
    if (inputUrl.trim()) {
      navigate(inputUrl);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleNavigate();
    }
  };

  const handleGoBack = () => {
    // In real implementation, this would call webview.goBack()
    console.log("Go back");
  };

  const handleGoForward = () => {
    // In real implementation, this would call webview.goForward()
    console.log("Go forward");
  };

  const handleRefresh = () => {
    setIsLoading(true);
    // In real implementation, this would call webview.reload()
    setTimeout(() => setIsLoading(false), 1000);
  };

  const handleGoHome = () => {
    navigate(initialUrl);
  };

  return (
    <div 
      ref={containerRef}
      className={cn("flex flex-col h-full bg-background border-l", className)}
      tabIndex={-1}
      role="region"
      aria-label="Web preview"
    >
      {/* Browser Top Bar */}
      <div className="border-b bg-muted/30 flex-shrink-0">
        {/* Title Bar */}
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Preview</span>
            {isLoading && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </div>
          
          <div className="flex items-center gap-1">
            {onToggleMaximize && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onToggleMaximize}
                      className="h-7 w-7"
                    >
                      {isMaximized ? (
                        <Minimize2 className="h-3.5 w-3.5" />
                      ) : (
                        <Maximize2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isMaximized ? "Exit full screen (ESC)" : "Enter full screen"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        
        {/* Navigation Bar */}
        <div className="flex items-center gap-2 px-3 py-2">
          {/* Navigation Buttons */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleGoBack}
              disabled={true} // TODO: Enable when implementing actual navigation
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleGoForward}
              disabled={true} // TODO: Enable when implementing actual navigation
              className="h-8 w-8"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isLoading}
              className="h-8 w-8"
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleGoHome}
              className="h-8 w-8"
            >
              <Home className="h-4 w-4" />
            </Button>
          </div>
          
          {/* URL Bar */}
          <div className="flex-1 relative">
            <Input
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter URL..."
              className="pr-10 h-8 text-sm font-mono"
            />
            {inputUrl !== currentUrl && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNavigate}
                className="absolute right-1 top-1 h-6 w-6"
              >
                <ArrowRight className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
      
      {/* Webview Content */}
      <div className="flex-1 relative bg-background" ref={contentRef}>
        {/* Loading Overlay */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center"
            >
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading preview...</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Error State */}
        {hasError ? (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-2">Failed to load preview</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              {errorMessage || "The page could not be loaded. Please check the URL and try again."}
            </p>
            <Button onClick={handleRefresh} variant="outline" size="sm">
              Try Again
            </Button>
          </div>
        ) : currentUrl ? (
          // Placeholder iframe - in real implementation, this would be a Tauri webview
          <iframe
            ref={iframeRef}
            src={currentUrl}
            className="absolute inset-0 w-full h-full border-0"
            title="Preview"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setHasError(true);
              setIsLoading(false);
            }}
          />
        ) : (
          // Empty state when no URL is provided
          <div className="flex flex-col items-center justify-center h-full p-8 text-foreground">
            <Globe className="h-16 w-16 text-muted-foreground/50 mb-6" />
            <h3 className="text-xl font-semibold mb-3">Enter a URL to preview</h3>
            <p className="text-sm text-muted-foreground text-center mb-6 max-w-md">
              Enter a URL in the address bar above to preview a website.
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Try entering</span>
              <code className="px-2 py-1 bg-muted/50 text-foreground rounded font-mono text-xs">localhost:3000</code>
              <span>or any other URL</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const WebviewPreview = React.memo(WebviewPreviewComponent); 