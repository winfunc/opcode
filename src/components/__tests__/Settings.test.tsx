import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Settings } from "../Settings";

// Mock the API module
vi.mock("@/lib/api", () => ({
  api: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
  },
}));

// Mock Tauri APIs
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

describe("Settings Component", () => {
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders settings tabs correctly", () => {
    render(<Settings onBack={mockOnBack} />);

    expect(screen.getByText("General")).toBeInTheDocument();
    expect(screen.getByText("Claude")).toBeInTheDocument();
    expect(screen.getByText("Storage")).toBeInTheDocument();
  });

  it("handles back button click", () => {
    render(<Settings onBack={mockOnBack} />);

    const backButton = screen.getByRole("button", { name: /back/i });
    fireEvent.click(backButton);

    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  it("handles tab switching", () => {
    render(<Settings onBack={mockOnBack} />);

    const storageTab = screen.getByText("Storage");
    fireEvent.click(storageTab);

    // Should switch to storage tab content
    expect(screen.getByText("Database Management")).toBeInTheDocument();
  });

  it("displays Claude settings form", () => {
    render(<Settings onBack={mockOnBack} />);

    const claudeTab = screen.getByText("Claude");
    fireEvent.click(claudeTab);

    expect(screen.getByText("Claude Binary Path")).toBeInTheDocument();
    expect(screen.getByText("Model Selection")).toBeInTheDocument();
  });
});
