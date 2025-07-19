import React, { useState, useEffect } from "react";
import { CursorLayout } from "./CursorLayout";
import { OutputCacheProvider } from "@/lib/outputCache";
import { TabProvider } from "@/contexts/TabContext";
import { TabContent } from "./TabContent";
import { NFOCredits } from "./NFOCredits";
import { ClaudeBinaryDialog } from "./ClaudeBinaryDialog";
import { Toast, ToastContainer } from "./ui/toast";
import { AgentsModal } from "./AgentsModal";

/**
 * Cursor-style App component
 * Features the modern Cursor-like interface with:
 * - Left sidebar for navigation and project management
 * - Modern tab bar with clean design
 * - Main content area for editing and interaction
 * - Right chat panel for AI assistance
 * - Responsive design that adapts to screen size
 */
function CursorStyleAppContent() {
  const [showNFO, setShowNFO] = useState(false);
  const [showClaudeBinaryDialog, setShowClaudeBinaryDialog] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [showAgentsModal, setShowAgentsModal] = useState(false);

  // Listen for Claude not found events
  useEffect(() => {
    const handleClaudeNotFound = () => {
      setShowClaudeBinaryDialog(true);
    };

    window.addEventListener('claude-not-found', handleClaudeNotFound as EventListener);
    return () => {
      window.removeEventListener('claude-not-found', handleClaudeNotFound as EventListener);
    };
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;
      
      if (modKey && e.shiftKey) {
        switch (e.key) {
          case 'P':
            // Command palette (future feature)
            e.preventDefault();
            setToast({ message: "Command palette coming soon!", type: "info" });
            break;
          case 'A':
            // Show agents modal
            e.preventDefault();
            setShowAgentsModal(true);
            break;
        }
      }

      // Escape key handlers
      if (e.key === 'Escape') {
        if (showAgentsModal) {
          setShowAgentsModal(false);
        } else if (showNFO) {
          setShowNFO(false);
        } else if (showClaudeBinaryDialog) {
          setShowClaudeBinaryDialog(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAgentsModal, showNFO, showClaudeBinaryDialog]);

  return (
    <CursorLayout>
      {/* Main Content - TabContent handles all the different views */}
      <TabContent />
      
      {/* Global Modals */}
      {showNFO && <NFOCredits onClose={() => setShowNFO(false)} />}
      
      <AgentsModal 
        open={showAgentsModal} 
        onOpenChange={setShowAgentsModal} 
      />
      
      <ClaudeBinaryDialog
        open={showClaudeBinaryDialog}
        onOpenChange={setShowClaudeBinaryDialog}
        onSuccess={() => {
          setToast({ message: "Claude binary path saved successfully", type: "success" });
          window.location.reload();
        }}
        onError={(message) => setToast({ message, type: "error" })}
      />
      
      {/* Toast Notifications */}
      <ToastContainer>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onDismiss={() => setToast(null)}
          />
        )}
      </ToastContainer>
    </CursorLayout>
  );
}

/**
 * Main Cursor-style App wrapper with providers
 */
export function CursorStyleApp() {
  return (
    <OutputCacheProvider>
      <TabProvider>
        <CursorStyleAppContent />
      </TabProvider>
    </OutputCacheProvider>
  );
}