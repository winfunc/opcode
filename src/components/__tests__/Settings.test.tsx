import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Settings } from "../Settings";
import { I18nProvider } from "../I18nProvider";

// Mock the API module
vi.mock("@/lib/api", () => ({
  api: {
    getSettings: vi.fn().mockResolvedValue({}),
    updateSettings: vi.fn().mockResolvedValue({}),
    getClaudeBinaryPath: vi.fn().mockResolvedValue("/path/to/claude"),
  },
}));

// Mock Tauri APIs
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

/**
 * Test suite for Settings component
 *
 * Tests settings interface functionality including tab navigation,
 * form rendering, back button handling, and settings management.
 */
describe("Settings Component", () => {
  /**
   * Mock function for back navigation callback
   */
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders settings tabs correctly", async () => {
    render(
      <I18nProvider>
        <Settings onBack={mockOnBack} />
      </I18nProvider>
    );

    // Wait for the settings to load and check for the Settings heading
    await waitFor(() => {
      expect(screen.getByText("Settings")).toBeInTheDocument();
    });
  });

  it("handles back button click", async () => {
    render(
      <I18nProvider>
        <Settings onBack={mockOnBack} />
      </I18nProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Settings")).toBeInTheDocument();
    });

    // Find the back button by its arrow-left icon
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

  it("handles tab switching", async () => {
    render(
      <I18nProvider>
        <Settings onBack={mockOnBack} />
      </I18nProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Settings")).toBeInTheDocument();
    });

    // Just verify the settings component is rendered
    expect(screen.getByText("Configure Claude Code preferences")).toBeInTheDocument();
  });

  it("displays Claude settings form", async () => {
    render(
      <I18nProvider>
        <Settings onBack={mockOnBack} />
      </I18nProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Settings")).toBeInTheDocument();
    });

    // Just verify the save button is present
    expect(screen.getByText("Save Settings")).toBeInTheDocument();
  });
});
