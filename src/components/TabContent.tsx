import React, { Suspense, lazy, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTabState } from '@/hooks/useTabState';
import { useScreenTracking } from '@/hooks/useAnalytics';
import { Tab } from '@/contexts/TabContext';
import { Loader2, Plus, ArrowLeft } from 'lucide-react';
import { api, type Project, type Session, type ClaudeMdFile } from '@/lib/api';
import { ProjectList } from '@/components/ProjectList';
import { SessionList } from '@/components/SessionList';
import { Button } from '@/components/ui/button';

// Lazy load heavy components
const ClaudeCodeSession = lazy(() => import('@/components/ClaudeCodeSession').then(m => ({ default: m.ClaudeCodeSession })));
const AgentRunOutputViewer = lazy(() => import('@/components/AgentRunOutputViewer'));
const AgentExecution = lazy(() => import('@/components/AgentExecution').then(m => ({ default: m.AgentExecution })));
const CreateAgent = lazy(() => import('@/components/CreateAgent').then(m => ({ default: m.CreateAgent })));
const Agents = lazy(() => import('@/components/Agents').then(m => ({ default: m.Agents })));
const UsageDashboard = lazy(() => import('@/components/UsageDashboard').then(m => ({ default: m.UsageDashboard })));
const MCPManager = lazy(() => import('@/components/MCPManager').then(m => ({ default: m.MCPManager })));
const Settings = lazy(() => import('@/components/Settings').then(m => ({ default: m.Settings })));
const MarkdownEditor = lazy(() => import('@/components/MarkdownEditor').then(m => ({ default: m.MarkdownEditor })));
// const ClaudeFileEditor = lazy(() => import('@/components/ClaudeFileEditor').then(m => ({ default: m.ClaudeFileEditor })));

// Import non-lazy components for projects view

interface TabPanelProps {
  tab: Tab;
  isActive: boolean;
}

const TabPanel: React.FC<TabPanelProps> = ({ tab, isActive }) => {
  const { updateTab } = useTabState();
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = React.useState<Project | null>(null);
  const [sessions, setSessions] = React.useState<Session[]>([]);
  const [loading, setLoading] = React.useState(false);
  
  // Track screen when tab becomes active
  useScreenTracking(isActive ? tab.type : undefined, isActive ? tab.id : undefined);
  const [error, setError] = React.useState<string | null>(null);
  
  // Load projects when tab becomes active and is of type 'projects'
  useEffect(() => {
    if (isActive && tab.type === 'projects') {
      loadProjects();
    }
  }, [isActive, tab.type]);
  
  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const projectList = await api.listProjects();
      setProjects(projectList);
    } catch (err) {
      console.error("Failed to load projects:", err);
      setError("Failed to load projects. Please ensure ~/.claude directory exists.");
    } finally {
      setLoading(false);
    }
  };
  
  const handleProjectClick = async (project: Project) => {
    try {
      setLoading(true);
      setError(null);
      const sessionList = await api.getProjectSessions(project.id);
      setSessions(sessionList);
      setSelectedProject(project);
      
      // Update tab title to show project name
      const projectName = project.path.split('/').pop() || 'Project';
      updateTab(tab.id, {
        title: projectName
      });
    } catch (err) {
      console.error("Failed to load sessions:", err);
      setError("Failed to load sessions for this project.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenProject = async () => {
    console.log('handleOpenProject called');
    try {
      // Use native dialog to pick folder
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Project Folder',
        defaultPath: await api.getHomeDirectory(),
      });
      
      console.log('Selected folder:', selected);
      
      if (selected && typeof selected === 'string') {
        // Create or open project for the selected directory
        const project = await api.createProject(selected);
        await loadProjects();
        await handleProjectClick(project);
      }
    } catch (err) {
      console.error('Failed to open folder picker:', err);
      setError('Failed to open folder picker');
    }
  };
  
  const handleNewSession = () => {
    // Update current tab to show new chat session instead of creating a new tab
    if (selectedProject) {
      const projectName = selectedProject.path.split('/').pop() || 'Session';
      updateTab(tab.id, {
        type: 'chat',
        title: projectName,
        sessionId: undefined,
        sessionData: undefined,
        initialProjectPath: selectedProject.path
      });
    } else {
      updateTab(tab.id, {
        type: 'chat',
        title: 'New Session',
        sessionId: undefined,
        sessionData: undefined,
        initialProjectPath: undefined
      });
    }
  };
  
  // Panel visibility - hide when not active
  const panelVisibilityClass = isActive ? "" : "hidden";
  
  const renderContent = () => {
    switch (tab.type) {
      case 'projects':
        return (
          <div className="h-full">
              {/* Content based on selection */}
              {selectedProject ? (
                <div className="h-full overflow-y-auto">
                  <div className="max-w-6xl mx-auto p-6">
                    <div className="mb-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <motion.div
                            whileTap={{ scale: 0.97 }}
                            transition={{ duration: 0.15 }}
                          >
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedProject(null);
                                setSessions([]);
                                // Restore tab title to "Projects"
                                updateTab(tab.id, {
                                  title: 'Projects'
                                });
                              }}
                              className="h-8 w-8 -ml-2"
                              title="Back to Projects"
                            >
                              <ArrowLeft className="h-4 w-4" />
                            </Button>
                          </motion.div>
                          <div>
                            <h1 className="text-3xl font-bold tracking-tight">
                              {selectedProject.path.split('/').pop()}
                            </h1>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {`${sessions.length} session${sessions.length !== 1 ? 's' : ''}`}
                            </p>
                          </div>
                        </div>
                        <motion.div
                          whileTap={{ scale: 0.97 }}
                          transition={{ duration: 0.15 }}
                        >
                          <Button
                            onClick={handleNewSession}
                            size="default"
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            New session
                          </Button>
                        </motion.div>
                      </div>
                    </div>

                    {/* Error display */}
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.15 }}
                        className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive"
                      >
                        {error}
                      </motion.div>
                    )}

                    {/* Loading state */}
                    {loading && (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    )}

                    {/* Session List */}
                    {!loading && (
                      <SessionList
                        sessions={sessions}
                        projectPath={selectedProject.path}
                        onSessionClick={(session) => {
                          // Update current tab to show the selected session
                          updateTab(tab.id, {
                            type: 'chat',
                            title: session.project_path.split('/').pop() || 'Session',
                            sessionId: session.id,
                            sessionData: session,
                            initialProjectPath: session.project_path
                          });
                        }}
                        onEditClaudeFile={(file: ClaudeMdFile) => {
                          // Open CLAUDE.md file in a new tab
                          window.dispatchEvent(new CustomEvent('open-claude-file', { 
                            detail: { file } 
                          }));
                        }}
                      />
                    )}
                  </div>
                </div>
              ) : (
                /* Projects List View */
                <ProjectList
                  projects={projects}
                  onProjectClick={handleProjectClick}
                  onOpenProject={handleOpenProject}
                  loading={loading}
                />
              )}
          </div>
        );
      
      case 'chat':
        return (
          <div className="h-full">
            <ClaudeCodeSession
              session={tab.sessionData} // Pass the full session object if available
              initialProjectPath={tab.initialProjectPath || tab.sessionId}
              onBack={() => {
                // Go back to projects view in the same tab
                updateTab(tab.id, {
                  type: 'projects',
                  title: 'Projects',
                });
              }}
              onProjectPathChange={(path: string) => {
                // Update tab title with directory name
                const dirName = path.split('/').pop() || path.split('\\').pop() || 'Session';
                updateTab(tab.id, {
                  title: dirName
                });
              }}
            />
          </div>
        );
      
      case 'agent':
        if (!tab.agentRunId) {
          return (
            <div className="h-full">
              <div className="p-4">No agent run ID specified</div>
            </div>
          );
        }
        return (
          <div className="h-full">
            <AgentRunOutputViewer
              agentRunId={tab.agentRunId}
              tabId={tab.id}
            />
          </div>
        );
      
      case 'agents':
        return (
          <div className="h-full">
            <Agents />
          </div>
        );
      
      case 'usage':
        return (
          <div className="h-full">
            <UsageDashboard onBack={() => {}} />
          </div>
        );
      
      case 'mcp':
        return (
          <div className="h-full">
            <MCPManager onBack={() => {}} />
          </div>
        );
      
      case 'settings':
        return (
          <div className="h-full">
            <Settings onBack={() => {}} />
          </div>
        );
      
      case 'claude-md':
        return (
          <div className="h-full">
            <MarkdownEditor onBack={() => {}} />
          </div>
        );
      
      case 'claude-file':
        if (!tab.claudeFileId) {
          return <div className="p-4">No Claude file ID specified</div>;
        }
        // Note: We need to get the actual file object for ClaudeFileEditor
        // For now, returning a placeholder
        return <div className="p-4">Claude file editor not yet implemented in tabs</div>;
      
      case 'agent-execution':
        if (!tab.agentData) {
          return <div className="p-4">No agent data specified</div>;
        }
        return (
          <AgentExecution
            agent={tab.agentData}
            projectPath={tab.projectPath}
            tabId={tab.id}
            onBack={() => {}}
          />
        );
      
      case 'create-agent':
        return (
          <CreateAgent
            onAgentCreated={() => {
              // Close this tab after agent is created
              window.dispatchEvent(new CustomEvent('close-tab', { detail: { tabId: tab.id } }));
            }}
            onBack={() => {
              // Close this tab when back is clicked
              window.dispatchEvent(new CustomEvent('close-tab', { detail: { tabId: tab.id } }));
            }}
          />
        );
      
      case 'import-agent':
        // TODO: Implement import agent component
        return (
          <div className="h-full">
            <div className="p-4">Import agent functionality coming soon...</div>
          </div>
        );
      
      default:
        return (
          <div className="h-full">
            <div className="p-4">Unknown tab type: {tab.type}</div>
          </div>
        );
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.15 }}
        className={`h-full w-full ${panelVisibilityClass}`}
      >
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          }
        >
          {renderContent()}
        </Suspense>
      </motion.div>

    </>
  );
};

export const TabContent: React.FC = () => {
  const { tabs, activeTabId, createChatTab, createProjectsTab, findTabBySessionId, createClaudeFileTab, createAgentExecutionTab, createCreateAgentTab, createImportAgentTab, closeTab, updateTab } = useTabState();
  
  // Listen for events to open sessions in tabs
  useEffect(() => {
    const handleOpenSessionInTab = (event: CustomEvent) => {
      const { session } = event.detail;
      
      // Check if tab already exists for this session
      const existingTab = findTabBySessionId(session.id);
      if (existingTab) {
        // Update existing tab with session data and switch to it
        updateTab(existingTab.id, {
          sessionData: session,
          title: session.project_path.split('/').pop() || 'Session'
        });
        window.dispatchEvent(new CustomEvent('switch-to-tab', { detail: { tabId: existingTab.id } }));
      } else {
        // Create new tab for this session
        const projectName = session.project_path.split('/').pop() || 'Session';
        const newTabId = createChatTab(session.id, projectName, session.project_path);
        // Update the new tab with session data
        updateTab(newTabId, {
          sessionData: session,
          initialProjectPath: session.project_path
        });
      }
    };

    const handleOpenClaudeFile = (event: CustomEvent) => {
      const { file } = event.detail;
      createClaudeFileTab(file.id, file.name || 'CLAUDE.md');
    };

    const handleOpenAgentExecution = (event: CustomEvent) => {
      const { agent, tabId, projectPath } = event.detail;
      createAgentExecutionTab(agent, tabId, projectPath);
    };

    const handleOpenCreateAgentTab = () => {
      createCreateAgentTab();
    };

    const handleOpenImportAgentTab = () => {
      createImportAgentTab();
    };

    const handleCloseTab = (event: CustomEvent) => {
      const { tabId } = event.detail;
      closeTab(tabId);
    };

    const handleClaudeSessionSelected = (event: CustomEvent) => {
      const { session } = event.detail;
      // Check if there's an existing tab for this session
      const existingTab = findTabBySessionId(session.id);
      if (existingTab) {
        // If tab exists, just switch to it
        updateTab(existingTab.id, {
          sessionData: session,
          title: session.project_path.split('/').pop() || 'Session',
        });
        window.dispatchEvent(new CustomEvent('switch-to-tab', { detail: { tabId: existingTab.id } }));
      } else {
        // If we're in a projects tab, update it to show the session
        // Otherwise create a new tab (for compatibility with other parts of the app)
        const currentTab = tabs.find(t => t.id === activeTabId);
        if (currentTab && currentTab.type === 'projects') {
          updateTab(currentTab.id, {
            type: 'chat',
            title: session.project_path.split('/').pop() || 'Session',
            sessionId: session.id,
            sessionData: session,
            initialProjectPath: session.project_path
          });
        } else {
          const projectName = session.project_path.split('/').pop() || 'Session';
          const newTabId = createChatTab(session.id, projectName, session.project_path);
          updateTab(newTabId, {
            sessionData: session,
            initialProjectPath: session.project_path,
          });
        }
      }
    };

    window.addEventListener('open-session-in-tab', handleOpenSessionInTab as EventListener);
    window.addEventListener('open-claude-file', handleOpenClaudeFile as EventListener);
    window.addEventListener('open-agent-execution', handleOpenAgentExecution as EventListener);
    window.addEventListener('open-create-agent-tab', handleOpenCreateAgentTab);
    window.addEventListener('open-import-agent-tab', handleOpenImportAgentTab);
    window.addEventListener('close-tab', handleCloseTab as EventListener);
    window.addEventListener('claude-session-selected', handleClaudeSessionSelected as EventListener);
    return () => {
      window.removeEventListener('open-session-in-tab', handleOpenSessionInTab as EventListener);
      window.removeEventListener('open-claude-file', handleOpenClaudeFile as EventListener);
      window.removeEventListener('open-agent-execution', handleOpenAgentExecution as EventListener);
      window.removeEventListener('open-create-agent-tab', handleOpenCreateAgentTab);
      window.removeEventListener('open-import-agent-tab', handleOpenImportAgentTab);
      window.removeEventListener('close-tab', handleCloseTab as EventListener);
      window.removeEventListener('claude-session-selected', handleClaudeSessionSelected as EventListener);
    };
  }, [createChatTab, findTabBySessionId, createClaudeFileTab, createAgentExecutionTab, createCreateAgentTab, createImportAgentTab, closeTab, updateTab]);
  
  return (
    <div className="flex-1 h-full relative">
      <AnimatePresence mode="wait">
        {tabs.map((tab) => (
          <TabPanel
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
          />
        ))}
      </AnimatePresence>
      
      {tabs.length === 0 && (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <div className="text-center">
            <p className="text-lg mb-2">No projects open</p>
            <p className="text-sm mb-4">Click to start a new project</p>
            <Button
              onClick={() => createProjectsTab()}
              size="default"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TabContent;
