import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { OutputCacheProvider } from "@/lib/outputCache";
import { TabProvider } from "@/contexts/TabContext";
import { NFOCredits } from "@/components/NFOCredits";
import { ClaudeBinaryDialog } from "@/components/ClaudeBinaryDialog";
import { Toast, ToastContainer } from "@/components/ui/toast";
import { TabManager } from "@/components/TabManager";
import { TabContent } from "@/components/TabContent";
import { AgentsModal } from "@/components/AgentsModal";
import { useTabState } from "@/hooks/useTabState";

/**
 * AppContent component - Contains the main app logic, wrapped by providers
 */
function AppContent() {
  const { } = useTabState();
  const [showNFO, setShowNFO] = useState(false);
  const [showClaudeBinaryDialog, setShowClaudeBinaryDialog] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [showAgentsModal, setShowAgentsModal] = useState(false);
  const [, setClaudeExecutableExists] = useState(true);

  // Keyboard shortcuts for tab navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;
      
      if (modKey) {
        switch (e.key) {
          case 't':
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('create-chat-tab'));
            break;
          case 'w':
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('close-current-tab'));
            break;
          case 'Tab':
            e.preventDefault();
            if (e.shiftKey) {
              window.dispatchEvent(new CustomEvent('switch-to-previous-tab'));
            } else {
              window.dispatchEvent(new CustomEvent('switch-to-next-tab'));
            }
            break;
          default:
            // Handle number keys 1-9
            const num = parseInt(e.key);
            if (!isNaN(num) && num >= 1 && num <= 9) {
              e.preventDefault();
              window.dispatchEvent(new CustomEvent('switch-to-tab', { detail: num - 1 }));
            }
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Check if Claude executable exists on mount
  useEffect(() => {
    const checkClaudeExecutable = async () => {
      try {
        // Check if claude executable exists - method not available in API
        const exists = true; // Default to true for now
        if (!exists) {
          setShowClaudeBinaryDialog(true);
        }
      } catch (error) {
        console.error("Error checking Claude executable:", error);
      }
    };

    checkClaudeExecutable();
  }, []);

  // Custom event handlers
  useEffect(() => {
    const handleCreateProjectTab = () => {
      window.dispatchEvent(new CustomEvent('create-project-tab'));
    };

    const handleShowNFO = () => setShowNFO(true);
    const handleShowAgents = () => setShowAgentsModal(true);

    const projectButton = document.getElementById('create-project-tab-btn');
    if (projectButton) {
      projectButton.addEventListener('click', handleCreateProjectTab);
    }

    // Listen for custom events to show modals
    window.addEventListener('show-nfo', handleShowNFO);
    window.addEventListener('show-agents-modal', handleShowAgents);

    return () => {
      if (projectButton) {
        projectButton.removeEventListener('click', handleCreateProjectTab);
      }
      window.removeEventListener('show-nfo', handleShowNFO);
      window.removeEventListener('show-agents-modal', handleShowAgents);
    };
  }, []);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="min-h-screen bg-background flex flex-col"
      >
        {/* Tab-based interface */}
        <div className="flex-1 flex flex-col">
          <TabManager />
          <TabContent />
        </div>

        {/* Global Modals */}
        {showNFO && <NFOCredits onClose={() => setShowNFO(false)} />}
        
        <ClaudeBinaryDialog 
          open={showClaudeBinaryDialog} 
          onOpenChange={setShowClaudeBinaryDialog}
          onSuccess={() => {
            setClaudeExecutableExists(true);
            setToast({ message: "Claude binary path set successfully", type: "success" });
          }}
          onError={(message) => {
            setToast({ message, type: "error" });
          }}
        />
        
        <AgentsModal
          open={showAgentsModal}
          onOpenChange={setShowAgentsModal}
        />

        {/* Toast Container */}
        {toast && (
          <ToastContainer>
            <Toast
              message={toast.message}
              type={toast.type}
              onDismiss={() => setToast(null)}
            />
          </ToastContainer>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * App component - Main entry point with providers
 */
function App() {
  return (
    <OutputCacheProvider>
      <TabProvider>
        <AppContent />
      </TabProvider>
    </OutputCacheProvider>
  );
}

export default App;