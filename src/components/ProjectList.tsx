import React, { useState } from "react";
import { motion } from "framer-motion";
import { 
  FolderOpen, 
  Calendar, 
  FileText, 
  ChevronRight, 
  Settings,
  MoreVertical,
  Clock,
  Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Project } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatTimeAgo } from "@/lib/date-utils";
import { Pagination } from "@/components/ui/pagination";

interface ProjectListProps {
  /**
   * Array of projects to display
   */
  projects: Project[];
  /**
   * Callback when a project is clicked
   */
  onProjectClick: (project: Project) => void;
  /**
   * Callback when hooks configuration is clicked
   */
  onProjectSettings?: (project: Project) => void;
  /**
   * Whether the list is currently loading
   */
  loading?: boolean;
  /**
   * Optional className for styling
   */
  className?: string;
}

const ITEMS_PER_PAGE = 12;

/**
 * Extracts the project name from the full path
 */
const getProjectName = (path: string): string => {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] || path;
};

/**
 * Formats path to be more readable
 */
const getDisplayPath = (path: string): string => {
  // Try to make path home-relative
  const homeIndicators = ['/Users/', '/home/'];
  for (const indicator of homeIndicators) {
    if (path.includes(indicator)) {
      const parts = path.split('/');
      const userIndex = parts.findIndex((p, i) => 
        i > 0 && parts[i - 1] === indicator.split('/')[1]
      );
      if (userIndex > 0) {
        return '~/' + parts.slice(userIndex + 1).join('/');
      }
    }
  }
  
  // Fallback to showing last 2-3 segments for very long paths
  const parts = path.split('/').filter(Boolean);
  if (parts.length > 3) {
    return '.../' + parts.slice(-2).join('/');
  }
  
  return path;
};

/**
 * ProjectList component - Displays a paginated list of projects with hover animations
 * 
 * @example
 * <ProjectList
 *   projects={projects}
 *   onProjectClick={(project) => console.log('Selected:', project)}
 * />
 */
export const ProjectList: React.FC<ProjectListProps> = ({
  projects,
  onProjectClick,
  onProjectSettings,
  className,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  
  // Calculate pagination
  const totalPages = Math.ceil(projects.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentProjects = projects.slice(startIndex, endIndex);
  
  // Reset to page 1 if projects change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [projects.length]);
  
  // Get the most recent session for each project
  const getRecentActivity = (project: Project) => {
    if (project.sessions.length === 0) return null;
    // Assuming sessions are sorted by date, get the most recent one
    return project.sessions[0];
  };

  return (
    <TooltipProvider>
      <div className={cn("space-y-4", className)}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
          {currentProjects.map((project, index) => {
            const recentSession = getRecentActivity(project);
            const hasActivity = project.sessions.length > 0;
            
            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.3,
                  delay: index * 0.05,
                  ease: [0.4, 0, 0.2, 1],
                }}
              >
                <Card
                  className={cn(
                    "p-3 hover:bg-accent/50 transition-all duration-200 cursor-pointer group h-full"
                  )}
                  onClick={() => onProjectClick(project)}
                >
                  <div className="flex flex-col h-full">
                    <div className="flex-1">
                      {/* Project header */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <FolderOpen className="h-4 w-4 text-primary shrink-0" />
                          <h3 className="font-medium text-sm truncate">
                            {getProjectName(project.path)}
                          </h3>
                        </div>
                        {project.sessions.length > 0 && (
                          <Badge 
                            variant={project.sessions.length > 5 ? "default" : "secondary"} 
                            className="text-xs px-1.5 py-0 h-5"
                          >
                            {project.sessions.length}
                          </Badge>
                        )}
                      </div>
                      
                      {/* Path display */}
                      <p className="text-xs text-muted-foreground font-mono truncate mb-2">
                        {getDisplayPath(project.path)}
                      </p>

                      {/* Activity indicator */}
                      {hasActivity && recentSession && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                          <Activity className="h-3 w-3" />
                          <span className="truncate">
                            {recentSession.first_message 
                              ? recentSession.first_message.slice(0, 40) + '...'
                              : 'Active session'}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{formatTimeAgo(project.created_at * 1000)}</span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {onProjectSettings && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onProjectSettings(project);
                                }}
                              >
                                <Settings className="h-3 w-3 mr-2" />
                                Hooks
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
        
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>
    </TooltipProvider>
  );
}; 
