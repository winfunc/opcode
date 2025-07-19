import React from 'react';
import { Plus, LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { RunningClaudeSessions } from './RunningClaudeSessions';
import { ProjectList } from './ProjectList';
import type { Project } from '@/lib/api';

interface ProjectsLayoutProps {
  projects: Project[];
  loading: boolean;
  onNewSession: () => void;
  onProjectClick: (project: Project) => void;
  onProjectSettings?: (project: Project) => void;
}

/**
 * 优化后的项目布局组件
 * 遵循 Material Design 8px 网格系统
 */
export const ProjectsLayout: React.FC<ProjectsLayoutProps> = ({
  projects,
  loading,
  onNewSession,
  onProjectClick,
  onProjectSettings,
}) => {
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');

  return (
    <div className="space-y-6"> {/* 增加到 24px (6 * 8px) 间距 */}
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between gap-4">
        <Button
          onClick={onNewSession}
          size="default"
          className="w-full max-w-md"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Claude Code session
        </Button>

        {/* 视图切换 */}
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(value: string) => value && setViewMode(value as 'grid' | 'list')}
          className="hidden md:flex"
        >
          <ToggleGroupItem value="grid" size="sm">
            <LayoutGrid className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" size="sm">
            <List className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* 运行中的会话 - 增加顶部间距 */}
      <div className="mt-8"> {/* 32px (4 * 8px) 顶部间距 */}
        <RunningClaudeSessions />
      </div>

      {/* 项目列表 - 明确的分隔 */}
      <div className="mt-8 pt-8 border-t"> {/* 添加分隔线和额外内边距 */}
        <h2 className="text-lg font-semibold mb-4">All Projects</h2>
        
        {projects.length > 0 ? (
          viewMode === 'grid' ? (
            <ProjectList
              projects={projects}
              onProjectClick={onProjectClick}
              onProjectSettings={onProjectSettings}
              loading={loading}
            />
          ) : (
            <ProjectListView
              projects={projects}
              onProjectClick={onProjectClick}
              onProjectSettings={onProjectSettings}
            />
          )
        ) : (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">
              No projects found in ~/.claude/projects
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 列表视图组件
 */
const ProjectListView: React.FC<{
  projects: Project[];
  onProjectClick: (project: Project) => void;
  onProjectSettings?: (project: Project) => void;
}> = ({ projects, onProjectClick }) => {
  return (
    <div className="space-y-2">
      {projects.map((project) => (
        <div
          key={project.id}
          className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
          onClick={() => onProjectClick(project)}
        >
          <div className="flex-1">
            <h3 className="font-medium">{project.path.split('/').pop()}</h3>
            <p className="text-sm text-muted-foreground">{project.path}</p>
          </div>
          <div className="text-sm text-muted-foreground">
            {project.sessions.length} sessions
          </div>
        </div>
      ))}
    </div>
  );
};