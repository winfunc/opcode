import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { detectBrowser, getBrowserCompatibilityMessage, getSupportedBrowsers } from '@/utils/browserDetection';

interface BrowserCompatibilityWarningProps {
  className?: string;
}

/**
 * Component that shows a warning when user is using an incompatible browser
 */
export const BrowserCompatibilityWarning: React.FC<BrowserCompatibilityWarningProps> = ({ className }) => {
  const [showWarning, setShowWarning] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [browserInfo, setBrowserInfo] = useState<ReturnType<typeof getBrowserCompatibilityMessage> | null>(null);

  useEffect(() => {
    // Check if we're in a browser environment (not Tauri desktop app)
    const isInBrowser = typeof window !== 'undefined';
    
    if (isInBrowser) {
      const compatibility = getBrowserCompatibilityMessage();
      setBrowserInfo(compatibility);
      
      // Show warning only for unsupported browsers
      if (!compatibility.isSupported) {
        // Check if user has previously dismissed the warning
        const dismissedKey = `claudia-browser-warning-dismissed-${detectBrowser().name}`;
        const wasDismissed = localStorage.getItem(dismissedKey) === 'true';
        
        if (!wasDismissed) {
          setShowWarning(true);
        }
      }
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    setShowWarning(false);
    
    // Remember dismissal for this browser
    const browser = detectBrowser();
    const dismissedKey = `claudia-browser-warning-dismissed-${browser.name}`;
    localStorage.setItem(dismissedKey, 'true');
  };

  if (!showWarning || dismissed || !browserInfo || browserInfo.isSupported) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className={`fixed top-4 left-4 right-4 z-50 ${className}`}
      >
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">
                  Browser Compatibility Warning
                </h3>
                
                <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                  {browserInfo.message}
                </p>
                
                {browserInfo.recommendedAction && (
                  <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                    {browserInfo.recommendedAction}
                  </p>
                )}
                
                <div className="text-xs text-amber-600 dark:text-amber-400 mb-3">
                  <strong>Supported browsers:</strong> {getSupportedBrowsers().join(', ')}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => window.open('https://www.chromium.org/getting-involved/download-chromium/', '_blank')}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 h-auto"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Download Chromium
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDismiss}
                    className="text-amber-700 dark:text-amber-300 text-xs px-3 py-1 h-auto"
                  >
                    Dismiss Warning
                  </Button>
                </div>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="text-amber-600 dark:text-amber-400 p-1 h-auto hover:bg-amber-100 dark:hover:bg-amber-900"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
};

export default BrowserCompatibilityWarning;