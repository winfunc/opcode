import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  X,
  Minimize2,
  Maximize2,
  Camera,
  Loader2,
  AlertCircle,
  Globe,
  Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
// TODO: These imports will be used when implementing actual Tauri webview
// import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
// import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

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
   * Callback when screenshot is requested
   */
  onScreenshot?: (imagePath: string) => void;
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
 *   onScreenshot={(path) => attachImage(path)}
 * />
 */
const WebviewPreviewComponent: React.FC<WebviewPreviewProps> = ({
  initialUrl,
  onClose,
  onScreenshot,
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
  const [isCapturing, setIsCapturing] = useState(false);
  const [showShutterAnimation, setShowShutterAnimation] = useState(false);
  
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
      setErrorMessage(t('invalidUrl'));
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

  const handleScreenshot = async () => {
    if (isCapturing || !currentUrl) return;
    
    try {
      setIsCapturing(true);
      setShowShutterAnimation(true);
      
      // Wait for shutter animation to start
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Capture the current URL using headless Chrome
      const filePath = await api.captureUrlScreenshot(
        currentUrl,
        null,  // No specific selector - capture the whole viewport
        false  // Not full page, just viewport
      );
      
      if (filePath && onScreenshot) {
        onScreenshot(filePath);
        console.log('[WebviewPreview] Screenshot captured:', filePath);
      }
      
      // Show success briefly
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error('[WebviewPreview] Screenshot failed:', error);
      // Could show an error toast here if needed
    } finally {
      setIsCapturing(false);
      setShowShutterAnimation(false);
    }
  };

  return (
    <TooltipProvider>
      <div
        ref={containerRef}
        className={cn(
          "flex flex-col bg-background border border-border rounded-lg overflow-hidden",
          isMaximized && "fixed inset-0 z-50 rounded-none border-0",
          className
        )}
        tabIndex={-1}
      >
        {/* Browser Controls */}
        <div className="flex items-center gap-2 p-3 border-b border-border bg-muted/50">
          {/* Navigation Controls */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGoBack}
                  disabled={true} // TODO: Implement actual navigation state
                  className="h-8 w-8 p-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('goBack')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGoForward}
                  disabled={true} // TODO: Implement actual navigation state
                  className="h-8 w-8 p-0"
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('goForward')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isLoading}
                  className="h-8 w-8 p-0"
                >
                  <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('refresh')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGoHome}
                  className="h-8 w-8 p-0"
                >
                  <Home className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('goHome')}</TooltipContent>
            </Tooltip>
          </div>

          {/* URL Bar */}
          <div className="flex-1 flex items-center gap-2">
            <div className="flex items-center gap-2 flex-1">
              <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Input
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('enterUrl')}
                className="flex-1 h-8 text-sm"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Window Controls */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleScreenshot}
                  disabled={isCapturing || !currentUrl}
                  className="h-8 w-8 p-0"
                >
                  {isCapturing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('screenshot')}</TooltipContent>
            </Tooltip>

            {onToggleMaximize && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onToggleMaximize}
                    className="h-8 w-8 p-0"
                  >
                    {isMaximized ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize2 className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isMaximized ? t('minimize') : t('maximize')}
                </TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-8 w-8 p-0 hover:bg-destructive hover:text-destructive-foreground"
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('close')}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Content Area */}
        <div ref={contentRef} className="flex-1 relative bg-background">
          {hasError ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <AlertCircle className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium">{errorMessage}</p>
              <p className="text-sm mt-2">{t('enterUrl')}</p>
            </div>
          ) : (
            <>
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
              
              {/* Placeholder iframe - In real implementation, this would be a Tauri webview */}
              <iframe
                ref={iframeRef}
                src={currentUrl}
                className="w-full h-full border-0"
                title={t('webPreview')}
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setHasError(true);
                  setErrorMessage(t('invalidUrl'));
                }}
              />
            </>
          )}

          {/* Camera Shutter Animation */}
          <AnimatePresence>
            {showShutterAnimation && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 bg-white z-20 pointer-events-none"
              />
            )}
          </AnimatePresence>

          {/* Full Screen Hint */}
          {isMaximized && (
            <div className="absolute top-4 right-4 bg-black/80 text-white px-3 py-2 rounded-md text-sm z-30">
              {t('exitFullScreenEsc')}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
};

export const WebviewPreview = React.memo(WebviewPreviewComponent); 