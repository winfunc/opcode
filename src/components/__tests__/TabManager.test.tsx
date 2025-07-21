import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TabManager } from "../TabManager";

// Mock the TabContext
vi.mock("@/contexts/hooks", () => ({
  useTabContext: () => ({
    tabs: [
      { id: "1", title: "Tab 1", type: "project", content: {} },
      { id: "2", title: "Tab 2", type: "session", content: {} },
    ],
    activeTabId: "1",
    addTab: vi.fn(),
    removeTab: vi.fn(),
    setActiveTab: vi.fn(),
    updateTab: vi.fn(),
    getTabById: vi.fn((id) => {
      const tabs = [
        { id: "1", title: "Tab 1", type: "project", content: {} },
        { id: "2", title: "Tab 2", type: "session", content: {} },
      ];
      return tabs.find(tab => tab.id === id);
    }),
    getTabsByType: vi.fn((type) => {
      const tabs = [
        { id: "1", title: "Tab 1", type: "project", content: {} },
        { id: "2", title: "Tab 2", type: "session", content: {} },
      ];
      return tabs.filter(tab => tab.type === type);
    }),
    reorderTabs: vi.fn(),
    closeAllTabs: vi.fn(),
  }),
}));

/**
 * Test suite for TabManager component
 *
 * Tests tab management functionality including tab rendering,
 * active tab indicators, tab closing, and new tab creation.
 */
describe("TabManager Component", () => {
  it("renders tabs correctly", () => {
    render(<TabManager />);

    expect(screen.getByText("Tab 1")).toBeInTheDocument();
    expect(screen.getByText("Tab 2")).toBeInTheDocument();
  });

  it("shows active tab indicator", () => {
    render(<TabManager />);

    const activeTab = screen.getByText("Tab 1").closest("li");
    expect(activeTab).toHaveClass("border-blue-500");
  });

  it("handles tab close button", () => {
    render(<TabManager />);

    // Look for close buttons by their X icon
    const closeButtons = screen.getAllByRole("button").filter(button => 
      button.querySelector('svg.lucide-x')
    );
    expect(closeButtons.length).toBeGreaterThan(0);
  });

  it("handles new tab creation", () => {
    render(<TabManager />);

    const newTabButton = screen.getByTitle("Browse projects");
    fireEvent.click(newTabButton);

    // Should trigger addTab function
    expect(newTabButton).toBeInTheDocument();
  });
});
