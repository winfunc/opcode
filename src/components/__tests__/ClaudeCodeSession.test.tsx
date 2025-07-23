import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ClaudeCodeSession } from "../ClaudeCodeSession";
import { I18nProvider } from "../I18nProvider";

// Mock the API module
vi.mock("@/lib/api", () => ({
  api: {
    getProjects: vi.fn(),
    getSessions: vi.fn(),
    executeClaudeCode: vi.fn(),
    listRunningClaudeSessions: vi.fn().mockResolvedValue([]),
    clearCheckpointManager: vi.fn().mockResolvedValue({}),
    getSettings: vi.fn().mockResolvedValue({}),
    updateSettings: vi.fn().mockResolvedValue({}),
    getSessionOutput: vi.fn().mockResolvedValue([]),
  },
}));

// Mock Tauri APIs
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: "div",
    button: "button",
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

/**
 * Test suite for ClaudeCodeSession component
 *
 * Tests Claude Code session functionality including message handling,
 * streaming behavior, user interactions, and error states.
 */
describe("ClaudeCodeSession", () => {
  const mockOnBack = vi.fn();
  const mockOnProjectSettings = vi.fn();
  // 使用 mockOnProjectSettings 避免 TypeScript 警告
  mockOnProjectSettings.mockName("mockOnProjectSettings");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders correctly with basic props", () => {
    render(
      <I18nProvider>
        <ClaudeCodeSession onBack={mockOnBack} initialProjectPath="/test/path" />
      </I18nProvider>
    );

    expect(screen.getByText("Claude Code Session")).toBeInTheDocument();
  });

  it("calls onBack when back button is clicked", () => {
    render(
      <I18nProvider>
        <ClaudeCodeSession onBack={mockOnBack} />
      </I18nProvider>
    );

    // Find the back button (first button with arrow-left icon)
    const buttons = screen.getAllByRole("button");
    const backButton = buttons.find(button => 
      button.querySelector('svg.lucide-arrow-left')
    );
    
    expect(backButton).toBeDefined();
    if (backButton) {
      fireEvent.click(backButton);
    }

    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  it("displays project path when provided", () => {
    const testPath = "/test/project/path";
    render(
      <I18nProvider>
        <ClaudeCodeSession onBack={mockOnBack} initialProjectPath={testPath} />
      </I18nProvider>
    );

    expect(screen.getByDisplayValue(testPath)).toBeInTheDocument();
  });

  it("handles session resumption", async () => {
    const mockSession = {
      id: "test-session-123",
      project_id: "test-project",
      project_path: "/test/path",
      created_at: Date.now(),
      first_message: "Test message",
      message_timestamp: new Date().toISOString(),
    };

    render(
      <I18nProvider>
        <ClaudeCodeSession session={mockSession} onBack={mockOnBack} />
      </I18nProvider>
    );

    // Check that the session path is displayed
    expect(screen.getByText("/test/path")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const customClass = "custom-test-class";
    const { container } = render(
      <I18nProvider>
        <ClaudeCodeSession onBack={mockOnBack} className={customClass} />
      </I18nProvider>
    );

    expect(container.firstChild).toHaveClass(customClass);
  });
});
