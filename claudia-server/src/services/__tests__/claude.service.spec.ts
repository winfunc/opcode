import { EventEmitter } from 'events';

// We mock child_process.spawn, fs.promises.access, and os.homedir to ensure deterministic behavior
import * as childProcess from 'child_process';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

// Import the class under test
// The provided file is named `claude.test.ts` but contains the service implementation.
// We import it directly as that's where the ClaudeService is exported.
import { ClaudeService } from '../claude.test';

// Test helpers to craft controllable fake ChildProcess instances
class FakeChildProcess extends EventEmitter {
  public pid: number | undefined;
  public stdout?: EventEmitter;
  public stderr?: EventEmitter;
  public killed = false;

  constructor(withPid = true) {
    super();
    this.pid = withPid ? Math.floor(Math.random() * 10000) + 1000 : undefined;
    this.stdout = new EventEmitter();
    this.stderr = new EventEmitter();
  }

  kill = (signal?: NodeJS.Signals | number) => {
    this.killed = true;
    // No-op; tests will assert on flags or trigger "close" as needed
    return true;
  };
}

// Jest-compatible mocks (works in Vitest with vi.mock as well)
jest.mock('child_process', () => {
  const actual = jest.requireActual('child_process');
  return {
    ...actual,
    spawn: jest.fn(),
  };
});

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    promises: {
      ...(actual.promises || {}),
      access: jest.fn(),
    },
  };
});

jest.mock('os', () => {
  const actual = jest.requireActual('os');
  return {
    ...actual,
    homedir: jest.fn(),
  };
});

describe('ClaudeService', () => {
  const mockedSpawn = childProcess.spawn as unknown as jest.Mock;
  const mockedFsAccess = fs.access as unknown as jest.Mock;
  const mockedHomedir = os.homedir as unknown as jest.Mock;

  const CLAUDE_BIN = '/fake/path/claude';

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(global, 'setTimeout');

    mockedHomedir.mockReturnValue('/home/testuser');
    mockedFsAccess.mockResolvedValue(undefined);
    mockedSpawn.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  function setupSpawnForVersion(output: string, exitCode: number) {
    const fake = new FakeChildProcess(true);
    // For --version call invoked by findClaudeBinary().testClaudeBinary() and by runCommand
    mockedSpawn.mockImplementation((_cmd: string, args: string[]) => {
      // args may include --version or other CLI flags
      // simulate emission of output to stdout
      setImmediate(() => {
        if (output) {
          fake.stdout?.emit('data', Buffer.from(output));
        }
        // stderr is unused for success path; keep empty
        fake.emit('close', exitCode);
      });
      return fake as unknown as childProcess.ChildProcess;
    });
    return fake;
  }

  function setupSpawnForRunCommand(stdoutOutput: string, stderrOutput: string, exitCode: number) {
    const fake = new FakeChildProcess(true);
    mockedSpawn.mockImplementation((_cmd: string, _args: string[]) => {
      setImmediate(() => {
        if (stdoutOutput) fake.stdout?.emit('data', Buffer.from(stdoutOutput));
        if (stderrOutput) fake.stderr?.emit('data', Buffer.from(stderrOutput));
        fake.emit('close', exitCode);
      });
      return fake as unknown as childProcess.ChildProcess;
    });
    return fake;
  }

  function setupSpawnForStreaming(argsMatcher: (args: string[]) => boolean, events: Array<{ type: 'stdout' | 'stderr' | 'close' | 'error'; data?: string; code?: number; error?: Error }>) {
    const fake = new FakeChildProcess(true);
    mockedSpawn.mockImplementation((_cmd: string, args: string[]) => {
      // Only stream for the matching command invocation; other spawns (e.g. --version) need separate stubs in tests
      if (argsMatcher(args)) {
        setImmediate(() => {
          for (const ev of events) {
            if (ev.type === 'stdout' && ev.data !== undefined) {
              fake.stdout?.emit('data', Buffer.from(ev.data));
            } else if (ev.type === 'stderr' && ev.data !== undefined) {
              fake.stderr?.emit('data', Buffer.from(ev.data));
            } else if (ev.type === 'close') {
              fake.emit('close', ev.code ?? 0);
            } else if (ev.type === 'error') {
              fake.emit('error', ev.error ?? new Error('spawn error'));
            }
          }
        });
      }
      return fake as unknown as childProcess.ChildProcess;
    });
    return fake;
  }

  describe('checkClaudeVersion', () => {
    it('returns installed=true with parsed semver when binary is valid and outputs version', async () => {
      // findClaudeBinary -> testClaudeBinary uses spawn(..., ['--version'])
      setupSpawnForVersion('claude version 1.2.3\n', 0);

      // runCommand(..., ['--version']) is also used; provide output there too
      setupSpawnForRunCommand('claude version 1.2.3\n', '', 0);

      const svc = new ClaudeService(CLAUDE_BIN);
      const res = await svc.checkClaudeVersion();

      expect(res.is_installed).toBe(true);
      expect(res.version).toBe('1.2.3');
      expect(res.output).toContain('claude');
    });

    it('returns installed=true but undefined version if format lacks semver', async () => {
      setupSpawnForVersion('claude build main\n', 0);
      setupSpawnForRunCommand('claude build main\n', '', 0);

      const svc = new ClaudeService(CLAUDE_BIN);
      const res = await svc.checkClaudeVersion();

      expect(res.is_installed).toBe(true);
      expect(res.version).toBeUndefined();
      expect(res.output).toContain('claude');
    });

    it('returns installed=false when binary missing or invalid', async () => {
      // fs.access ok, but testClaudeBinary fails via non-zero exit or non-matching output
      setupSpawnForVersion('something else\n', 1);

      const svc = new ClaudeService(CLAUDE_BIN);
      const res = await svc.checkClaudeVersion();

      expect(res.is_installed).toBe(false);
      expect(res.output).toMatch(/Invalid Claude binary|not found|Unknown error/i);
    });
  });

  describe('execute/continue/resume stream handling and registry', () => {
    it('executeClaudeCode: streams JSON and non-JSON lines, emits events, and registers process', async () => {
      // testClaudeBinary path when finding claude binary
      setupSpawnForVersion('claude 1.0.0', 0);

      const json1 = JSON.stringify({ type: 'token', text: 'Hello' });
      const json2 = JSON.stringify({ type: 'done' });

      // stream-json invocation args matcher
      const isExecuteArgs = (args: string[]) =>
        args.includes('-p') &&
        args.includes('--model') &&
        args.includes('--output-format') &&
        args.includes('stream-json') &&
        !args.includes('-c') &&
        !args.includes('--resume');

      // streaming events: stdout lines include JSON and a non-JSON line
      const streamEvents = [
        { type: 'stdout' as const, data: json1 + '\n' },
        { type: 'stdout' as const, data: 'raw text line\n' },
        { type: 'stdout' as const, data: json2 + '\n' },
        { type: 'stderr' as const, data: 'warning: something\n' },
        { type: 'close' as const, code: 0 },
      ];

      setupSpawnForStreaming(isExecuteArgs, streamEvents);

      const svc = new ClaudeService(CLAUDE_BIN);

      const streamEventsCaptured: any[] = [];
      const outputEventsCaptured: any[] = [];
      const errorEventsCaptured: any[] = [];
      const exitEventsCaptured: any[] = [];

      svc.on('claude_stream', (e) => streamEventsCaptured.push(e));
      svc.on('claude_output', (e) => outputEventsCaptured.push(e));
      svc.on('claude_error', (e) => errorEventsCaptured.push(e));
      svc.on('claude_exit', (e) => exitEventsCaptured.push(e));

      const sessionId = await svc.executeClaudeCode({
        prompt: 'Do something',
        model: 'claude-3',
        project_path: '/tmp/project',
      });

      expect(typeof sessionId).toBe('string');
      // wait microtasks to flush stream events
      await Promise.resolve();

      // Validate stream parsing and event enrichment with session_id/timestamp
      expect(streamEventsCaptured.length).toBe(2);
      for (const ev of streamEventsCaptured) {
        expect(ev.session_id).toBe(sessionId);
        expect(ev.message).toHaveProperty('timestamp');
        expect(ev.message).toHaveProperty('session_id', sessionId);
      }

      expect(outputEventsCaptured.length).toBe(1);
      expect(outputEventsCaptured[0].session_id).toBe(sessionId);
      expect(outputEventsCaptured[0].data).toBe('raw text line');

      expect(errorEventsCaptured.length).toBe(1);
      expect(errorEventsCaptured[0].session_id).toBe(sessionId);
      expect(errorEventsCaptured[0].error).toContain('warning');

      // exit event fired and registries cleared
      // wait for close handling
      await Promise.resolve();
      expect(exitEventsCaptured.length).toBe(1);
      expect(exitEventsCaptured[0].session_id).toBe(sessionId);
      expect(typeof exitEventsCaptured[0].code).toBe('number');

      // After exit, process should be removed from registries
      expect(svc.getSessionInfo(sessionId)).toBeUndefined();
      expect(svc.getRunningClaudeSessions().find(s => (s as any).process_type?.ClaudeSession?.session_id === sessionId)).toBeUndefined();
    });

    it('continueClaudeCode: uses -c flag and registers until exit', async () => {
      setupSpawnForVersion('claude 1.0.0', 0);

      const isContinueArgs = (args: string[]) => args.includes('-c');
      setupSpawnForStreaming(isContinueArgs, [
        { type: 'stdout', data: JSON.stringify({ type: 'token', text: 'cont' }) + '\n' },
        { type: 'close', code: 0 },
      ]);

      const svc = new ClaudeService(CLAUDE_BIN);
      const exitEvents: any[] = [];
      svc.on('claude_exit', (e) => exitEvents.push(e));

      const sessionId = await svc.continueClaudeCode({
        prompt: 'Continue',
        model: 'claude-3',
        project_path: '/tmp/project',
      });

      expect(typeof sessionId).toBe('string');
      await Promise.resolve();
      expect(svc.getSessionInfo(sessionId)).toBeUndefined();
      expect(exitEvents.length).toBe(1);
    });

    it('resumeClaudeCode: uses --resume and given session_id', async () => {
      setupSpawnForVersion('claude 1.0.0', 0);

      const isResumeArgs = (args: string[]) => args.includes('--resume') && args.some((a) => a === 'existing-session');
      setupSpawnForStreaming(isResumeArgs, [
        { type: 'stdout', data: JSON.stringify({ type: 'token', text: 'resumed' }) + '\n' },
        { type: 'close', code: 0 },
      ]);

      const svc = new ClaudeService(CLAUDE_BIN);
      const exitEvents: any[] = [];
      svc.on('claude_exit', (e) => exitEvents.push(e));

      const sessionId = await svc.resumeClaudeCode({
        prompt: 'Resume please',
        model: 'claude-3',
        project_path: '/tmp/project',
        session_id: 'existing-session',
      });

      expect(sessionId).toBe('existing-session');
      await Promise.resolve();
      expect(exitEvents.length).toBe(1);
    });

    it('emits claude_error and clears registries on spawn error', async () => {
      setupSpawnForVersion('claude 1.0.0', 0);

      const isExecuteArgs = (args: string[]) => args.includes('-p') && args.includes('Fail');
      const fake = setupSpawnForStreaming(isExecuteArgs, [
        { type: 'error', error: new Error('spawn failure') },
      ]);

      const svc = new ClaudeService(CLAUDE_BIN);
      const errors: any[] = [];
      svc.on('claude_error', (e) => errors.push(e));

      const sessionId = await svc.executeClaudeCode({
        prompt: 'Fail',
        model: 'claude-3',
        project_path: '/tmp/project',
      });

      // Ensure error was emitted with session_id and message
      await Promise.resolve();
      expect(errors.length).toBe(1);
      expect(errors[0].session_id).toBe(sessionId);
      expect(errors[0].error).toContain('spawn failure');

      // Make sure registries are cleared on error
      expect(svc.getSessionInfo(sessionId)).toBeUndefined();
      expect(svc.getRunningClaudeSessions().find(s => (s as any).process_type?.ClaudeSession?.session_id === sessionId)).toBeUndefined();

      // Avoid eslint 'unused' warning for fake
      expect(fake).toBeTruthy();
    });
  });

  describe('cancelClaudeExecution', () => {
    it('returns true and sends SIGTERM; SIGKILL after 5s if not killed', async () => {
      setupSpawnForVersion('claude 1.0.0', 0);

      // The process that will be stored/registered; we need it to not exit immediately
      const isExecuteArgs = (args: string[]) => args.includes('-p') && args.includes('cancel test');
      const fake = new FakeChildProcess(true);
      (childProcess.spawn as jest.Mock).mockImplementation((_cmd: string, args: string[]) => {
        if (isExecuteArgs(args)) {
          // keep it alive; do not emit close immediately
          return fake as unknown as childProcess.ChildProcess;
        }
        // For binary validation
        const ver = new FakeChildProcess(true);
        setImmediate(() => ver.emit('close', 0));
        return ver as unknown as childProcess.ChildProcess;
      });

      const svc = new ClaudeService(CLAUDE_BIN);
      const id = await svc.executeClaudeCode({
        prompt: 'cancel test',
        model: 'claude-3',
        project_path: '/tmp/project',
      });

      const result = await svc.cancelClaudeExecution(id);
      expect(result).toBe(true);

      // Force the delayed SIGKILL path by leaving fake.killed=false
      jest.advanceTimersByTime(5000);
      expect(setTimeout).toHaveBeenCalled();
      // We can only assert that kill was invoked; our FakeChildProcess.kill toggles .killed=true on any call
      expect(fake.killed).toBe(true);
    });

    it('returns false when no such session exists', async () => {
      const svc = new ClaudeService(CLAUDE_BIN);
      const res = await svc.cancelClaudeExecution('non-existent');
      expect(res).toBe(false);
    });
  });

  describe('registry and helpers', () => {
    it('getRunningClaudeSessions and getSessionInfo reflect active process; cleared on close', async () => {
      setupSpawnForVersion('claude 1.0.0', 0);

      const isExecuteArgs = (args: string[]) => args.includes('-p') && args.includes('track me');
      const events = [
        { type: 'stdout' as const, data: JSON.stringify({ type: 'token', text: 'hi' }) + '\n' },
        { type: 'close' as const, code: 0 },
      ];
      setupSpawnForStreaming(isExecuteArgs, events);

      const svc = new ClaudeService(CLAUDE_BIN);
      const id = await svc.executeClaudeCode({
        prompt: 'track me',
        model: 'claude-3',
        project_path: '/tmp/prj',
      });

      // Immediately after spawn, registry should have the session
      const running = svc.getRunningClaudeSessions();
      expect(running.length).toBe(1);
      const info = svc.getSessionInfo(id);
      expect(info).toBeDefined();
      expect(info?.model).toBe('claude-3');
      expect(info?.project_path).toBe('/tmp/prj');
      expect(info?.process_type).toEqual({ ClaudeSession: { session_id: id } });

      // After close, cleared
      await Promise.resolve();
      expect(svc.getSessionInfo(id)).toBeUndefined();
      expect(svc.getRunningClaudeSessions().length).toBe(0);
    });

    it('getClaudeHomeDir returns ~/.claude', () => {
      mockedHomedir.mockReturnValue('/home/userx');
      const svc = new ClaudeService(CLAUDE_BIN);
      expect(svc.getClaudeHomeDir()).toBe(path.join('/home/userx', '.claude'));
    });

    it('cleanup kills all tracked processes and clears registries', async () => {
      setupSpawnForVersion('claude 1.0.0', 0);

      // Keep the process running so cleanup has something to kill
      const isExecuteArgs = (args: string[]) => args.includes('-p') && args.includes('cleanup');
      const fake = new FakeChildProcess(true);
      mockedSpawn.mockImplementation((_cmd: string, args: string[]) => {
        if (isExecuteArgs(args)) {
          return fake as unknown as childProcess.ChildProcess;
        }
        const ver = new FakeChildProcess(true);
        setImmediate(() => ver.emit('close', 0));
        return ver as unknown as childProcess.ChildProcess;
      });

      const svc = new ClaudeService(CLAUDE_BIN);
      const id = await svc.executeClaudeCode({
        prompt: 'cleanup',
        model: 'claude-3',
        project_path: '/tmp/p',
      });

      expect(svc.getSessionInfo(id)).toBeDefined();

      // Invoke cleanup
      svc.cleanup();

      // Process array cleared
      expect(svc.getSessionInfo(id)).toBeUndefined();
      expect(svc.getRunningClaudeSessions().length).toBe(0);
      // Fake process kill called
      expect(fake.killed).toBe(true);
    });
  });

  describe('runCommand failure path (indirectly via checkClaudeVersion)', () => {
    it('bubbles up non-zero exit errors from runCommand', async () => {
      // testClaudeBinary ok
      setupSpawnForVersion('claude 1.0.0', 0);

      // Next spawn for runCommand returns non-zero with stderr message
      mockedSpawn.mockImplementationOnce((_cmd: string, _args: string[]) => {
        // This first call already consumed by setupSpawnForVersion. We need second for runCommand:
        // To ensure we target runCommand, we return a process that emits stderr and close 2.
        const fake = new FakeChildProcess(true);
        setImmediate(() => {
          fake.stderr?.emit('data', Buffer.from('boom'));
          fake.emit('close', 2);
        });
        return fake as unknown as childProcess.ChildProcess;
      });

      const svc = new ClaudeService(CLAUDE_BIN);
      const res = await svc.checkClaudeVersion();
      expect(res.is_installed).toBe(false);
      expect(res.output).toContain('boom');
    });
  });

  describe('spawn failure to start (no pid)', () => {
    it('throws if spawn returns process without pid', async () => {
      setupSpawnForVersion('claude 1.0.0', 0);

      // Create a child process without pid to trigger the guard
      const badChild = new FakeChildProcess(false);
      mockedSpawn.mockImplementation((_cmd: string, args: string[]) => {
        // for the execution spawn (not version check), return bad child
        if (args.includes('--output-format')) {
          return badChild as unknown as childProcess.ChildProcess;
        }
        // for version checks, return normal that closes immediately
        const ver = new FakeChildProcess(true);
        setImmediate(() => ver.emit('close', 0));
        return ver as unknown as childProcess.ChildProcess;
      });

      const svc = new ClaudeService(CLAUDE_BIN);
      await expect(svc.executeClaudeCode({
        prompt: 'start please',
        model: 'claude-3',
        project_path: '/tmp/pp',
      })).rejects.toThrow(/Failed to start Claude process/);
    });
  });
});