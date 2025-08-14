import React, { useState } from "react";
import { motion } from "framer-motion";
import { 
  FolderOpen,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Project } from "@/lib/api";
import { cn } from "@/lib/utils";

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
   * Callback when open project is clicked
   */
  onOpenProject?: () => void | Promise<void>;
  /**
   * Whether the list is currently loading
   */
  loading?: boolean;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * Extracts the project name from the full path
 */
const getProjectName = (path: string): string => {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] || path;
};

/**
 * Formats path to be more readable - shows full path relative to home
 * Truncates long paths with ellipsis in the middle
 */
const getDisplayPath = (path: string, maxLength: number = 30): string => {
  // Try to make path home-relative
  let displayPath = path;
  const homeIndicators = ['/Users/', '/home/'];
  for (const indicator of homeIndicators) {
    if (path.includes(indicator)) {
      const parts = path.split('/');
      const userIndex = parts.findIndex((_part, i) => 
        i > 0 && parts[i - 1] === indicator.split('/')[1]
      );
      if (userIndex > 0) {
        const relativePath = parts.slice(userIndex + 1).join('/');
        displayPath = `~/${relativePath}`;
        break;
      }
    }
  }
  
  // Truncate if too long
  if (displayPath.length > maxLength) {
    const start = displayPath.substring(0, Math.floor(maxLength / 2) - 2);
    const end = displayPath.substring(displayPath.length - Math.floor(maxLength / 2) + 2);
    return `${start}...${end}`;
  }
  
  return displayPath;
};

/**
 * ProjectList component - Displays recent projects in a Cursor-like interface
 * 
 * @example
 * <ProjectList
 *   projects={projects}
 *   onProjectClick={(project) => console.log('Selected:', project)}
 *   onOpenProject={() => console.log('Open project')}
 * />
 */
export const ProjectList: React.FC<ProjectListProps> = ({
  projects,
  onProjectClick,
  onOpenProject,
  className,
}) => {
  const [showAll, setShowAll] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Determine how many projects to show
  const projectsPerPage = showAll ? 10 : 5;
  const totalPages = Math.ceil(projects.length / projectsPerPage);
  
  // Calculate which projects to display
  const startIndex = showAll ? (currentPage - 1) * projectsPerPage : 0;
  const endIndex = startIndex + projectsPerPage;
  const displayedProjects = projects.slice(startIndex, endIndex);
  
  const handleViewAll = () => {
    setShowAll(true);
    setCurrentPage(1);
  };
  
  const handleViewLess = () => {
    setShowAll(false);
    setCurrentPage(1);
  };

  return (
    <div className={cn("h-full overflow-y-auto", className)}>
      <div className="max-w-6xl mx-auto flex flex-col h-full">
        {/* Header */}
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Projects</h1>
              <p className="mt-1 text-body-small text-muted-foreground">
                Select a project to start working with Claude Code
              </p>
            </div>
            <motion.div
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.15 }}
            >
              <Button
                onClick={onOpenProject}
                size="default"
                className="flex items-center gap-2"
              >
                <FolderOpen className="h-4 w-4" />
                Open Project
              </Button>
            </motion.div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Recent projects section */}
          {displayedProjects.length > 0 ? (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-heading-4">Recent Projects</h2>
            {!showAll ? (
              <button 
                onClick={handleViewAll}
                className="text-caption text-muted-foreground hover:text-foreground transition-colors"
              >
                View all ({projects.length})
              </button>
            ) : (
              <button 
                onClick={handleViewLess}
                className="text-caption text-muted-foreground hover:text-foreground transition-colors"
              >
                View less
              </button>
            )}
          </div>
          
          <div className="space-y-1">
            {displayedProjects.map((project, index) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.15,
                  delay: index * 0.02,
                }}
                className="group"
              >
                <motion.button
                  onClick={() => onProjectClick(project)}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-accent/50 transition-colors flex items-center justify-between"
                >
                  <span className="text-body-small font-medium">
                    {getProjectName(project.path)}
                  </span>
                  <span className="text-caption text-muted-foreground font-mono text-right" style={{ minWidth: '200px' }}>
                    {getDisplayPath(project.path, 35)}
                  </span>
                </motion.button>
              </motion.div>
            ))}
          </div>
          
          {/* Pagination controls */}
          {showAll && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <motion.div
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.15 }}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </motion.div>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className="w-8 h-8 p-0"
                  >
                    {page}
                  </Button>
                ))}
              </div>
              
              <motion.div
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.15 }}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </motion.div>
            </div>
          )}
            </Card>
          ) : (
            <Card className="p-12">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <FolderOpen className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-heading-3 mb-2">No recent projects</h3>
                <p className="text-body-small text-muted-foreground mb-6">
                  Open a project to get started with Claude Code
                </p>
                <motion.div
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                >
                  <Button
                    onClick={onOpenProject}
                    size="default"
                    className="flex items-center gap-2"
                  >
                    <FolderOpen className="h-4 w-4" />
                    Open Your First Project
                  </Button>
                </motion.div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}; 
