/**
 * Helpers for keeping persisted project paths in sync with what the backend
 * currently reports.
 *
 * Older builds could persist a wrongly reconstructed path (for example
 * `/home/michal/mikes/p` for `/home/michal_mikes/p`). The project id (the
 * folder name under `~/.claude/projects`) is stable, so on restore the path is
 * re-resolved from the backend's current project list instead of trusting
 * what is in localStorage.
 */

/** Minimal shape of a project needed to build the lookup index. */
export interface ProjectPathSource {
  id: string;
  path: string;
}

/**
 * Builds a project id -> current path lookup from the backend project list.
 * Projects with an empty path are skipped so they can never overwrite a
 * stored value.
 *
 * @param projects - Projects as returned by `api.listProjects()`
 */
export function buildProjectPathIndex(
  projects: ReadonlyArray<ProjectPathSource>
): Map<string, string> {
  const index = new Map<string, string>();
  for (const project of projects) {
    if (project.id && project.path) {
      index.set(project.id, project.path);
    }
  }
  return index;
}

/**
 * Returns the path to use for a restored session: the backend's current path
 * for the project when known, otherwise the stored one.
 *
 * @param storedPath - Path saved in localStorage
 * @param projectId - Project id (folder name) the session belongs to
 * @param currentPaths - Index from {@link buildProjectPathIndex}
 */
export function resolveRestoredProjectPath(
  storedPath: string,
  projectId: string,
  currentPaths: ReadonlyMap<string, string>
): string {
  return currentPaths.get(projectId) ?? storedPath;
}
