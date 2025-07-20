import { describe, it, expect, vi } from "vitest";
import { api } from "../api";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

/**
 * Test suite for API module
 *
 * Tests the main API interface including method availability,
 * function types, and module structure validation.
 */
describe("API Module", () => {
  it("should have all required API methods", () => {
    expect(api.listProjects).toBeDefined();
    expect(api.getProjectSessions).toBeDefined();
    expect(api.executeClaudeCode).toBeDefined();
    expect(api.getAgent).toBeDefined();
    expect(api.createAgent).toBeDefined();
  });

  it("should export API functions as expected", () => {
    expect(typeof api.listProjects).toBe("function");
    expect(typeof api.getProjectSessions).toBe("function");
    expect(typeof api.executeClaudeCode).toBe("function");
  });

  it("should have agent management methods", () => {
    expect(typeof api.getAgent).toBe("function");
    expect(typeof api.createAgent).toBe("function");
    expect(typeof api.updateAgent).toBe("function");
    expect(typeof api.deleteAgent).toBe("function");
  });

  it("should have session management methods", () => {
    expect(typeof api.getProjectSessions).toBe("function");
    // Note: deleteSession is not yet implemented in the API
    // expect(typeof api.deleteSession).toBe('function')
  });
});
