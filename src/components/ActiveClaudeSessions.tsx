import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Play, Clock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSessionContext } from '@/contexts/SessionContext';

interface ActiveClaudeSessionsProps {
  className?: string;
  onSessionSelect?: (sessionId: string) => void;
}

export function ActiveClaudeSessions({ className, onSessionSelect }: ActiveClaudeSessionsProps) {
  const { activeSessions, resumeSession } = useSessionContext();

  const formatTimeSince = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ago`;
    }
    return `${minutes}m ago`;
  };

  const handleResumeSession = (sessionId: string) => {
    resumeSession(sessionId);
    onSessionSelect?.(sessionId);
  };

  if (activeSessions.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center space-x-2">
        <MessageSquare className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Active Claude Sessions</h3>
        <Badge variant="secondary">{activeSessions.length}</Badge>
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {activeSessions.map((session) => (
            <motion.div
              key={session.sessionId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="hover:shadow-md transition-shadow cursor-pointer group">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full">
                        <MessageSquare className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Claude Code Session</CardTitle>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                            <Play className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            {formatTimeSince(session.timestamp)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResumeSession(session.sessionId)}
                      className="flex items-center space-x-2 group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                    >
                      <span>Resume</span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Project Path</p>
                      <p className="text-xs font-mono bg-muted px-2 py-1 rounded truncate">
                        {session.projectPath}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-muted-foreground">Messages</p>
                      <p className="text-sm">{session.messages.length} messages in conversation</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}