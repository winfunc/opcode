import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProjectList } from "../ProjectList";

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: "div",
  },
}));

// Mock Tauri APIs
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

describe("ProjectList Component", () => {
  const mockProjects = [
    { id: "1", path: "/path/to/project1", sessions: [], created_at: Date.now() / 1000 },
    { id: "2", path: "/path/to/project2", sessions: [], created_at: Date.now() / 1000 },
  ];

  it("renders project list correctly", () => {
    render(<ProjectList projects={mockProjects} onProjectClick={vi.fn()} />);

    expect(screen.getByText("project1")).toBeInTheDocument();
    expect(screen.getByText("project2")).toBeInTheDocument();
  });

  it("handles project selection", () => {
    const onProjectClick = vi.fn();
    render(<ProjectList projects={mockProjects} onProjectClick={onProjectClick} />);

    const project1 = screen.getByText("project1").closest(".cursor-pointer");
    if (project1) {
      fireEvent.click(project1);
    }

    expect(onProjectClick).toHaveBeenCalledWith(mockProjects[0]);
  });

  it("shows empty state when no projects", () => {
    render(<ProjectList projects={[]} onProjectClick={vi.fn()} />);

    // Should render empty grid
    expect(screen.queryByText("project1")).not.toBeInTheDocument();
  });

  it("handles project settings callback", () => {
    const onProjectSettings = vi.fn();
    render(
      <ProjectList
        projects={mockProjects}
        onProjectClick={vi.fn()}
        onProjectSettings={onProjectSettings}
      />
    );

    // Should render settings dropdown when callback is provided
    expect(screen.getAllByRole("button")).toHaveLength(2); // One for each project
  });
});
