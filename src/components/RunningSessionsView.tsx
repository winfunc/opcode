import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Square, Clock, Cpu, RefreshCw, Eye, ArrowLeft, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Toast, ToastContainer } from '@/components/ui/toast';
import { SessionOutputViewer } from './SessionOutputViewer';
import { api } from '@/lib/api';
import type { AgentRun } from '@/lib/api';
import { useTranslations } from '@/lib/i18n/useI18n';

interface RunningSessionsViewProps {
  className?: string;
  showBackButton?: boolean;
  onBack?: () => void;
}

export function RunningSessionsView({ className, showBackButton = false, onBack }: RunningSessionsViewProps) {
  const t = useTranslations();
  const [runningSessions, setRunningSessions] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSession, setSelectedSession] = useState<AgentRun | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const loadRunningSessions = async () => {
    try {
      const sessions = await api.listRunningAgentSessions();
      setRunningSessions(sessions);
    } catch (error) {
      console.error('Failed to load running sessions:', error);
      setToast({ message: t('agents.failedToLoad'), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const refreshSessions = async () => {
    setRefreshing(true);
    try {
      // First cleanup finished processes
      await api.cleanupFinishedProcesses();
      // Then reload the list
      await loadRunningSessions();
      setToast({ message: t('agents.runningSessionsUpdated'), type: 'success' });
    } catch (error) {
      console.error('Failed to refresh sessions:', error);
      setToast({ message: t('agents.failedToRefresh'), type: 'error' });
    } finally {
      setRefreshing(false);
    }
  };

  const killSession = async (runId: number, agentName: string) => {
    try {
      const success = await api.killAgentSession(runId);
      if (success) {
        setToast({ message: t('agents.sessionStopped').replace('{agentName}', agentName), type: 'success' });
        // Refresh the list after killing
        await loadRunningSessions();
      } else {
        setToast({ message: t('agents.sessionMayFinished'), type: 'error' });
      }
    } catch (error) {
      console.error('Failed to kill session:', error);
      setToast({ message: t('agents.failedToTerminate'), type: 'error' });
    }
  };

  const formatDuration = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const durationMs = now.getTime() - start.getTime();
    const minutes = Math.floor(durationMs / (1000 * 60));
    const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">{t('agents.running')}</Badge>;
      case 'pending':
        return <Badge variant="secondary">{t('agents.pending')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  useEffect(() => {
    loadRunningSessions();
    
    // Set up auto-refresh every 5 seconds
    const interval = setInterval(() => {
      if (!refreshing) {
        loadRunningSessions();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [refreshing]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>{t('agents.loadingRunningSessions')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {showBackButton && onBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <Play className="h-5 w-5" />
          <h2 className="text-lg font-semibold">{t('agents.runningSessions')}</h2>
          <Badge variant="secondary">{runningSessions.length}</Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshSessions}
          disabled={refreshing}
          className="flex items-center space-x-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{t('ui.refresh')}</span>
        </Button>
      </div>

      {runningSessions.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center p-8">
            <div className="text-center space-y-2">
              <Clock className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">{t('agents.noRunningSessions')}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {runningSessions.map((session) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
                        <Bot className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{session.agent_name}</CardTitle>
                        <div className="flex items-center space-x-2 mt-1">
                          {getStatusBadge(session.status)}
                          {session.pid && (
                            <Badge variant="outline" className="text-xs">
                              <Cpu className="h-3 w-3 mr-1" />
                              PID {session.pid}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedSession(session)}
                        className="flex items-center space-x-2"
                      >
                        <Eye className="h-4 w-4" />
                        <span>{t('agents.viewOutput')}</span>
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => session.id && killSession(session.id, session.agent_name)}
                        className="flex items-center space-x-2"
                      >
                        <Square className="h-4 w-4" />
                        <span>{t('agents.stop')}</span>
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-muted-foreground">{t('agents.task')}</p>
                      <p className="text-sm font-medium truncate">{session.task}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">{t('agents.model')}</p>
                        <p className="font-medium">{session.model}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t('agents.duration')}</p>
                        <p className="font-medium">
                          {session.process_started_at 
                            ? formatDuration(session.process_started_at)
                            : t('agents.unknown')
                          }
                        </p>
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-sm text-muted-foreground">{t('agents.projectPath')}</p>
                      <p className="text-xs font-mono bg-muted px-2 py-1 rounded truncate">
                        {session.project_path}
                      </p>
                    </div>
                    
                    {session.session_id && (
                      <div>
                        <p className="text-sm text-muted-foreground">{t('agents.sessionId')}</p>
                        <p className="text-xs font-mono bg-muted px-2 py-1 rounded truncate">
                          {session.session_id}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Session Output Viewer */}
      <AnimatePresence>
        {selectedSession && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-4xl h-full max-h-[90vh]">
              <SessionOutputViewer
                session={selectedSession}
                onClose={() => setSelectedSession(null)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <ToastContainer>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onDismiss={() => setToast(null)}
          />
        )}
      </ToastContainer>
    </div>
  );
}