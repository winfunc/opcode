/* 
  Tests for ProjectService

  Testing framework and runner: Jest (TypeScript) with ts-jest assumed based on typical setup.
  If this repository uses Vitest instead, replace jest.mock/jest.fn with vi.mock/vi.fn and update imports accordingly.

  Focus: Validate behaviors across happy paths, edge cases, and failure conditions for:
    - listProjects
    - createProject
    - getProjectSessions
    - loadSessionHistory
    - findClaudeMdFiles + findClaudeMdFilesRecursive
    - readClaudeMdFile
    - saveClaudeMdFile
    - listDirectoryContents

  Strategy:
    - Mock fs.promises: access, readdir, stat, readFile, writeFile, mkdir
    - Use a custom claudeHomeDir so we can assert generated paths deterministically
    - Avoid real filesystem IO
*/

import { join, basename } from 'path';

// Import the service under test. Adjust the import path if the actual service file differs.
// The provided snippet indicates this class is exported as 'ProjectService' from claudia-server/src/services/project.ts
// If the implementation resides elsewhere, update this import accordingly.
import { ProjectService } from './project'; // <-- if this path differs in repo, update accordingly

// Types used in assertions (optional). If types module path differs, you can remove the import and assert using runtime shapes.
type Project = {
  id: string;
  path: string;
  sessions: string[];
  created_at: number;
  most_recent_session?: number;
};

type Session = {
  id: string;
  project_id: string;
  project_path: string;
  created_at: number;
  first_message?: string;
  message_timestamp?: string;
  todo_data?: any;
};

// We will mock fs.promises interface only.
type DirentLike = {
  name: string;
  isFile: () => boolean;
  isDirectory: () => boolean;
};

// Build a manual mock for fs to control fs.promises methods precisely.
jest.mock('fs', () => {
  const original = jest.requireActual('fs');
  const mem: Record<string, string> = {};

  // Not using memfs dependency; we'll stub readFile/writeFile via handlers configured per test

  return {
    ...original,
    promises: {
      access: jest.fn(),
      readdir: jest.fn(),
      stat: jest.fn(),
      readFile: jest.fn(),
      writeFile: jest.fn(),
      mkdir: jest.fn(),
    },
  };
});

const fsPromises = (require('fs').promises) as {
  access: jest.Mock;
  readdir: jest.Mock;
  stat: jest.Mock;
  readFile: jest.Mock;
  writeFile: jest.Mock;
  mkdir: jest.Mock;
};

// Helper to create a Dirent-like object
function dirent(name: string, kind: 'file' | 'dir'): DirentLike {
  return {
    name,
    isFile: () => kind === 'file',
    isDirectory: () => kind === 'dir',
  };
}

// Common test variables
const HOME = '/tmp/claude-home';
const PROJECTS_DIR = join(HOME, 'projects');
const TODOS_DIR = join(HOME, 'todos');

// Date helpers
function fakeDate(epochSecs: number) {
  return new Date(epochSecs * 1000);
}

function statWithTimes({ ctime, mtime, birthtime } : { ctime: number; mtime?: number; birthtime?: number }) {
  return {
    ctime: fakeDate(ctime),
    mtime: fakeDate(mtime ?? ctime),
    birthtime: birthtime ? fakeDate(birthtime) : fakeDate(0),
  };
}

beforeEach(() => {
  jest.resetAllMocks();
});

describe('ProjectService', () => {
  describe('listProjects', () => {
    it('returns empty array if projects directory does not exist', async () => {
      const svc = new ProjectService(HOME);
      fsPromises.access.mockRejectedValueOnce(Object.assign(new Error('no dir'), { code: 'ENOENT' }));

      const projects = await svc.listProjects();

      expect(projects).toEqual([]);
      expect(fsPromises.access).toHaveBeenCalledWith(PROJECTS_DIR);
    });

    it('lists projects, reading sessions and sorting by most recent session then creation time', async () => {
      const svc = new ProjectService(HOME);
      // access ok
      fsPromises.access.mockResolvedValueOnce(undefined);

      // Projects directory contains two projects: a-foo-bar and z-bar
      fsPromises.readdir.mockResolvedValueOnce([
        dirent('a-foo-bar', 'dir'),
        dirent('z-bar', 'dir'),
        dirent('ignore.txt', 'file'),
      ]);

      // For getProjectFromDirectory('a-foo-bar'):
      fsPromises.stat
        // stat(projectDir)
        .mockResolvedValueOnce(statWithTimes({ ctime: 1000 }))
        // stat(session1) for a-foo-bar
        .mockResolvedValueOnce(statWithTimes({ ctime: 0, mtime: 2000 }))
        // stat(session2) for a-foo-bar
        .mockResolvedValueOnce(statWithTimes({ ctime: 0, mtime: 1500 }))

        // For getProjectFromDirectory('z-bar'):
        // stat(projectDir)
        .mockResolvedValueOnce(statWithTimes({ ctime: 900 }))
        // stat(session for z-bar)
        .mockResolvedValueOnce(statWithTimes({ ctime: 0, mtime: 1200 }));

      // readdir(projectDir) calls inside getProjectFromDirectory:
      fsPromises.readdir
        // entries in a-foo-bar
        .mockResolvedValueOnce([
          dirent('123.jsonl', 'file'),
          dirent('456.jsonl', 'file'),
          dirent('ignore.md', 'file'),
        ])
        // entries in z-bar
        .mockResolvedValueOnce([
          dirent('789.jsonl', 'file'),
        ]);

      // getProjectPathFromSessions logic: will read session files and pick first with cwd
      // For a-foo-bar: read 123.jsonl -> has cwd, so used
      fsPromises.readFile
        .mockResolvedValueOnce(JSON.stringify({ cwd: '/work/a/foo/bar' }) + '\n')
        // For z-bar: read 789.jsonl -> throws parse or no cwd, then fallback decode of projectId (z-bar -> z/bar)
        .mockResolvedValueOnce(JSON.stringify({ something: 'else' }) + '\n');

      const projects = await svc.listProjects();

      // Sorting: a-foo-bar most recent session mtime=2000, z-bar most recent session mtime=1200
      expect(projects.map(p => p.id)).toEqual(['a-foo-bar', 'z-bar']);

      const a = projects[0];
      expect(a.path).toBe('/work/a/foo/bar');
      expect(a.sessions.sort()).toEqual(['123', '456']);
      expect(a.created_at).toBe(1000);
      expect(a.most_recent_session).toBe(2000);

      const z = projects[1];
      expect(z.path).toBe('z/bar'); // fallback decodeProjectPath
      expect(z.sessions).toEqual(['789']);
      expect(z.created_at).toBe(900);
      expect(z.most_recent_session).toBe(1200);
    });

    it('ignores unreadable projects and continues', async () => {
      const svc = new ProjectService(HOME);
      fsPromises.access.mockResolvedValueOnce(undefined);
      fsPromises.readdir.mockResolvedValueOnce([
        dirent('good', 'dir'),
        dirent('bad', 'dir'),
      ]);

      // Good project
      fsPromises.stat
        .mockResolvedValueOnce(statWithTimes({ ctime: 100 }))
        .mockResolvedValueOnce(statWithTimes({ ctime: 0, mtime: 120 })); // session

      fsPromises.readdir
        .mockResolvedValueOnce([dirent('s1.jsonl', 'file')]);

      fsPromises.readFile
        .mockResolvedValueOnce(JSON.stringify({ cwd: '/work/good' }) + '\n');

      // Bad project: throw while reading project dir stat
      fsPromises.stat.mockRejectedValueOnce(new Error('stat error for bad'));

      const projects = await svc.listProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0].id).toBe('good');
      expect(projects[0].path).toBe('/work/good');
    });
  });

  describe('createProject', () => {
    it('creates project directory, writes metadata, and returns project data', async () => {
      const svc = new ProjectService(HOME);
      const path = '/repo/foo';
      const projectId = ' - repo - foo - '.trim().replace(/\//g, '-'); // Just a note. Actual code uses path.replace(/\//g, '-')
      // Our expected id:
      const expectedProjectId = path.replace(/\//g, '-');
      const projectDir = join(PROJECTS_DIR, expectedProjectId);

      // mkdir projects dir, then project dir
      fsPromises.mkdir.mockResolvedValue(undefined);

      // stat(projectDir) for timestamps - prefer birthtime if available, else mtime
      fsPromises.stat.mockResolvedValueOnce({
        ctime: fakeDate(0), // not used directly for createProject
        mtime: fakeDate(2000),
        birthtime: fakeDate(1500),
      });

      // write metadata.json
      fsPromises.writeFile.mockResolvedValue(undefined);

      const result = await svc.createProject(path);

      expect(fsPromises.mkdir).toHaveBeenCalledWith(PROJECTS_DIR, { recursive: true });
      expect(fsPromises.mkdir).toHaveBeenCalledWith(projectDir, { recursive: true });
      // uses birthtime first then falls back
      expect(result.created_at).toBe(1500);
      expect(result).toEqual({
        id: expectedProjectId,
        path,
        sessions: [],
        created_at: 1500,
      });
      // verify metadata contents
      const metadataPath = join(projectDir, 'metadata.json');
      const writeCall = fsPromises.writeFile.mock.calls.find(c => c[0] === metadataPath);
      expect(writeCall).toBeTruthy();
      const json = JSON.parse(writeCall![1]);
      expect(json).toEqual({ path, created_at: 1500, version: 1 });
    });

    it('falls back to mtime when birthtime is unavailable', async () => {
      const svc = new ProjectService(HOME);
      fsPromises.mkdir.mockResolvedValue(undefined);
      fsPromises.stat.mockResolvedValueOnce({
        ctime: fakeDate(0),
        mtime: fakeDate(7777),
        birthtime: undefined,
      } as any);
      fsPromises.writeFile.mockResolvedValue(undefined);

      const result = await svc.createProject('/x/y');
      expect(result.created_at).toBe(7777);
    });
  });

  describe('getProjectSessions', () => {
    it('throws if project directory does not exist', async () => {
      const svc = new ProjectService(HOME);
      const projectId = 'x-y';
      const projectDir = join(PROJECTS_DIR, projectId);
      fsPromises.access.mockRejectedValueOnce(Object.assign(new Error('no dir'), { code: 'ENOENT' }));

      await expect(svc.getProjectSessions(projectId)).rejects.toThrow(`Project directory not found: ${projectId}`);
      expect(fsPromises.access).toHaveBeenCalledWith(projectDir);
    });

    it('returns sessions sorted by created_at (newest first) and extracts first user message and todos', async () => {
      const svc = new ProjectService(HOME);
      const projectId = 'foo-bar';
      const projectDir = join(PROJECTS_DIR, projectId);

      // access ok
      fsPromises.access.mockResolvedValueOnce(undefined);

      // getProjectPathFromSessions: read first .jsonl file; include cwd
      // readdir(projectDir) - for determining path
      fsPromises.readdir
        .mockResolvedValueOnce([dirent('100.jsonl', 'file'), dirent('50.jsonl', 'file')]) // for getProjectPathFromSessions
        .mockResolvedValueOnce([dirent('100.jsonl', 'file'), dirent('50.jsonl', 'file')]); // for main sessions loop

      fsPromises.readFile
        // For getProjectPathFromSessions -> pick first and read
        .mockResolvedValueOnce(JSON.stringify({ cwd: '/work/foo/bar' }) + '\n')

        // For getSessionFromFile('100.jsonl')
        .mockResolvedValueOnce([
          JSON.stringify({ message: { role: 'assistant', content: 'hi' }, timestamp: 't1' }),
          JSON.stringify({ message: { role: 'user', content: 'User 100 message' }, timestamp: 't2' }),
          '',
        ].join('\n'))

        // For todos 100
        .mockResolvedValueOnce(JSON.stringify({ tasks: ['a', 'b'] }))

        // For getSessionFromFile('50.jsonl')
        .mockResolvedValueOnce([
          JSON.stringify({ message: { role: 'user', content: [{ type: 'text', text: 'Array user message' }] }, timestamp: 't3' }),
          '',
        ].join('\n'))

        // For todos 50 -> simulate not found
        .mockRejectedValueOnce(Object.assign(new Error('no todo'), { code: 'ENOENT' }));

      // stat for sessions: ctime defines created_at
      fsPromises.stat
        .mockResolvedValueOnce(statWithTimes({ ctime: 100 })) // for 100.jsonl
        .mockResolvedValueOnce(statWithTimes({ ctime: 50 })); // for 50.jsonl

      const sessions = await svc.getProjectSessions(projectId);

      // Sorted newest first (100 then 50)
      expect(sessions.map(s => s.id)).toEqual(['100', '50']);

      const s100 = sessions[0];
      expect(s100.project_id).toBe(projectId);
      expect(s100.project_path).toBe('/work/foo/bar');
      expect(s100.created_at).toBe(100);
      expect(s100.first_message).toBe('User 100 message');
      expect(s100.message_timestamp).toBe('t2');
      expect(s100.todo_data).toEqual({ tasks: ['a', 'b'] });

      const s50 = sessions[1];
      expect(s50.created_at).toBe(50);
      expect(s50.first_message).toBe('Array user message');
      expect(s50.todo_data).toBeUndefined();

      // Verify readFile was attempted for todos in HOME/todos/<id>.json
      const todosPath100 = join(HOME, 'todos', '100.json');
      const todosReadCall = fsPromises.readFile.mock.calls.find(c => c[0] === todosPath100);
      expect(todosReadCall).toBeTruthy();
    });

    it('falls back to decodeProjectPath when getProjectPathFromSessions fails', async () => {
      const svc = new ProjectService(HOME);
      const projectId = 'a-b-c';
      fsPromises.access.mockResolvedValueOnce(undefined);
      // readdir for getProjectPathFromSessions
      fsPromises.readdir
        .mockResolvedValueOnce([dirent('1.jsonl', 'file')]) // for getProjectPathFromSessions
        .mockResolvedValueOnce([dirent('1.jsonl', 'file')]); // main

      fsPromises.readFile
        // fail on reading session for path extraction
        .mockRejectedValueOnce(new Error('parse fail'))
        // for getSessionFromFile
        .mockResolvedValueOnce(JSON.stringify({ message: { role: 'user', content: 'hello' }, timestamp: 't' }));

      fsPromises.stat.mockResolvedValueOnce(statWithTimes({ ctime: 1 }));

      const sessions = await svc.getProjectSessions(projectId);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].project_path).toBe('a/b/c');
    });
  });

  describe('loadSessionHistory', () => {
    it('returns file content for found session across projects', async () => {
      const svc = new ProjectService(HOME);

      // listProjects -> access ok
      fsPromises.access.mockResolvedValueOnce(undefined);

      // readdir projects list: two projects
      fsPromises.readdir
        .mockResolvedValueOnce([dirent('p1', 'dir'), dirent('p2', 'dir')]) // listProjects
        // getProjectFromDirectory('p1') entries
        .mockResolvedValueOnce([dirent('111.jsonl', 'file')])
        // getProjectFromDirectory('p2') entries
        .mockResolvedValueOnce([dirent('222.jsonl', 'file'), dirent('target.jsonl', 'file')]);

      // getProjectPathFromSessions for p1, p2
      fsPromises.readFile
        .mockResolvedValueOnce(JSON.stringify({ cwd: '/work/p1' }) + '\n')
        .mockResolvedValueOnce(JSON.stringify({ cwd: '/work/p2' }) + '\n');

      // stats: project dirs and sessions to compute most_recent_session
      fsPromises.stat
        .mockResolvedValueOnce(statWithTimes({ ctime: 10 })) // p1
        .mockResolvedValueOnce(statWithTimes({ ctime: 0, mtime: 100 })) // p1/111
        .mockResolvedValueOnce(statWithTimes({ ctime: 20 })) // p2
        .mockResolvedValueOnce(statWithTimes({ ctime: 0, mtime: 90 })) // p2/222
        .mockResolvedValueOnce(statWithTimes({ ctime: 0, mtime: 200 })); // p2/target

      // Once listProjects done, loadSessionHistory reads the target
      fsPromises.readFile.mockResolvedValueOnce('HISTORY CONTENT');

      const content = await svc.loadSessionHistory('target');
      expect(content).toBe('HISTORY CONTENT');
      const expectedPath = join(PROJECTS_DIR, 'p2', 'target.jsonl');
      expect(fsPromises.readFile).toHaveBeenCalledWith(expectedPath, 'utf-8');
    });

    it('throws if session not found in any project', async () => {
      const svc = new ProjectService(HOME);

      fsPromises.access.mockResolvedValueOnce(undefined);
      fsPromises.readdir
        .mockResolvedValueOnce([dirent('p', 'dir')]);
      fsPromises.readdir
        .mockResolvedValueOnce([dirent('111.jsonl', 'file')]); // getProjectFromDirectory
      fsPromises.readFile
        .mockResolvedValueOnce(JSON.stringify({ cwd: '/work/p' }) + '\n');

      fsPromises.stat
        .mockResolvedValueOnce(statWithTimes({ ctime: 1 })) // project dir
        .mockResolvedValueOnce(statWithTimes({ ctime: 0, mtime: 2 })); // session

      await expect(svc.loadSessionHistory('nope')).rejects.toThrow('Session not found: nope');
    });
  });

  describe('findClaudeMdFiles', () => {
    it('recursively finds CLAUDE.md files ignoring hidden directories', async () => {
      const svc = new ProjectService(HOME);
      const root = '/r';

      // Directory tree:
      // /r
      //   /sub1
      //     CLAUDE.md
      //     file.txt
      //   /.hidden
      //     CLAUDE.md (should be ignored)
      //   /sub2
      //     /nested
      //       CLAUDE.md
      //   CLAUDE.md
      //
      // Simulate traversal order with readdir per directory encountered
      fsPromises.readdir
        .mockResolvedValueOnce([dirent('sub1', 'dir'), dirent('.hidden', 'dir'), dirent('sub2', 'dir'), dirent('CLAUDE.md', 'file')]) // /r
        .mockResolvedValueOnce([dirent('CLAUDE.md', 'file'), dirent('file.txt', 'file')]) // /r/sub1
        // .hidden should be attempted but ignored because name startsWith('.'); still a readdir call is made only if code enters it, but code avoids recursion into hidden dirs
        .mockResolvedValueOnce([dirent('nested', 'dir')]) // /r/sub2
        .mockResolvedValueOnce([dirent('CLAUDE.md', 'file')]); // /r/sub2/nested

      // stat for each discovered CLAUDE.md
      fsPromises.stat
        .mockResolvedValueOnce(statWithTimes({ ctime: 0, mtime: 100 })) // /r/CLAUDE.md
        .mockResolvedValueOnce(statWithTimes({ ctime: 0, mtime: 110 })) // /r/sub1/CLAUDE.md
        .mockResolvedValueOnce(statWithTimes({ ctime: 0, mtime: 150 })); // /r/sub2/nested/CLAUDE.md

      const files = await svc.findClaudeMdFiles(root);

      // Expect 3 files (root, sub1, sub2/nested). Ensure properties filled.
      const rel = files.map(f => f.relative_path).sort();
      expect(rel).toEqual(['CLAUDE.md', 'sub1/CLAUDE.md', 'sub2/nested/CLAUDE.md']);

      const rootFile = files.find(f => f.relative_path === 'CLAUDE.md')!;
      expect(rootFile.absolute_path).toBe(join(root, 'CLAUDE.md'));
      expect(rootFile.size).toBeDefined();
      expect(rootFile.modified).toBe(100);

      const nestedFile = files.find(f => f.relative_path === 'sub2/nested/CLAUDE.md')!;
      expect(nestedFile.modified).toBe(150);
    });

    it('logs and continues when encountering unreadable directories', async () => {
      const svc = new ProjectService(HOME);
      const root = '/r';

      // First call throws, to simulate unreadable root (function should catch and warn, then return [])
      fsPromises.readdir.mockRejectedValueOnce(new Error('permission denied'));

      const files = await svc.findClaudeMdFiles(root);
      expect(files).toEqual([]);
    });
  });

  describe('readClaudeMdFile', () => {
    it('reads CLAUDE.md content', async () => {
      const svc = new ProjectService(HOME);
      fsPromises.readFile.mockResolvedValueOnce('# Hello');

      const content = await svc.readClaudeMdFile('/p/CLAUDE.md');
      expect(content).toBe('# Hello');
      expect(fsPromises.readFile).toHaveBeenCalledWith('/p/CLAUDE.md', 'utf-8');
    });
  });

  describe('saveClaudeMdFile', () => {
    it('writes CLAUDE.md content', async () => {
      const svc = new ProjectService(HOME);
      fsPromises.writeFile.mockResolvedValueOnce(undefined);

      await svc.saveClaudeMdFile('/p/CLAUDE.md', 'Body');
      expect(fsPromises.writeFile).toHaveBeenCalledWith('/p/CLAUDE.md', 'Body', 'utf-8');
    });
  });

  describe('listDirectoryContents', () => {
    it('lists files and directories with details and sorts dirs first then by name', async () => {
      const svc = new ProjectService(HOME);
      const path = '/code';

      fsPromises.readdir.mockResolvedValueOnce([
        dirent('b.txt', 'file'),
        dirent('a', 'dir'),
        dirent('z', 'dir'),
        dirent('a.txt', 'file'),
      ]);

      // stat for each full path in iteration order
      fsPromises.stat
        .mockResolvedValueOnce({ size: 22, isDirectory: () => false }) // b.txt
        .mockResolvedValueOnce({ size: 0, isDirectory: () => true })   // a (dir) - ignored since entry.isDirectory() used
        .mockResolvedValueOnce({ size: 0, isDirectory: () => true })   // z (dir) - ignored
        .mockResolvedValueOnce({ size: 11, isDirectory: () => false }); // a.txt

      const result = await svc.listDirectoryContents(path);

      // Sorted: directories first (a, z), then files (a.txt, b.txt) alphabetically
      expect(result.map(e => e.name)).toEqual(['a', 'z', 'a.txt', 'b.txt']);

      const aTxt = result.find(e => e.name === 'a.txt')!;
      expect(aTxt.extension).toBe('txt');
      expect(aTxt.size).toBe(11);
      expect(aTxt.is_directory).toBe(false);

      const aDir = result.find(e => e.name === 'a')!;
      expect(aDir.is_directory).toBe(true);
      expect(aDir.size).toBe(0);
      expect(aDir.extension).toBeUndefined();
    });

    it('skips files that cannot be stat-ed', async () => {
      const svc = new ProjectService(HOME);
      const path = '/code';

      fsPromises.readdir.mockResolvedValueOnce([
        dirent('ok.txt', 'file'),
        dirent('bad.txt', 'file'),
      ]);

      fsPromises.stat
        .mockResolvedValueOnce({ size: 5 }) // ok.txt
        .mockRejectedValueOnce(new Error('stat failed')); // bad.txt

      const result = await svc.listDirectoryContents(path);

      expect(result.map(e => e.name)).toEqual(['ok.txt']);
    });
  });

  describe('internal behaviors', () => {
    it('getProjectPathFromSessions selects first JSONL with cwd and throws when none provide it', async () => {
      const svc = new ProjectService(HOME);
      const dir = '/p';

      // Entries: two jsonl files
      fsPromises.readdir.mockResolvedValueOnce([
        dirent('1.jsonl', 'file'),
        dirent('2.jsonl', 'file'),
        dirent('readme.md', 'file'),
      ]);

      // read 1 -> no cwd; read 2 -> has cwd
      fsPromises.readFile
        .mockResolvedValueOnce(JSON.stringify({}) + '\n')
        .mockResolvedValueOnce(JSON.stringify({ cwd: '/work/p' }) + '\n');

      // @ts-ignore accessing private method by casting to any for unit testing purposes
      const path = await (svc as any).getProjectPathFromSessions(dir);
      expect(path).toBe('/work/p');
    });

    it('getProjectPathFromSessions throws if no sessions have cwd or files are unreadable', async () => {
      const svc = new ProjectService(HOME);
      const dir = '/p';

      fsPromises.readdir.mockResolvedValueOnce([
        dirent('1.jsonl', 'file'),
        dirent('2.jsonl', 'file'),
      ]);

      fsPromises.readFile
        .mockResolvedValueOnce(JSON.stringify({}) + '\n')
        .mockResolvedValueOnce(JSON.stringify({ notcwd: true }) + '\n');

      await expect((svc as any).getProjectPathFromSessions(dir)).rejects.toThrow('Could not determine project path from session files');
    });

    it('decodeProjectPath decodes hyphens to slashes', () => {
      const svc = new ProjectService(HOME);
      // @ts-ignore
      const decoded = (svc as any).decodeProjectPath('a-b-c');
      expect(decoded).toBe('a/b/c');
    });
  });

});