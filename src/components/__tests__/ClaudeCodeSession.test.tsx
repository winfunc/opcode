import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ClaudeCodeSession } from '../ClaudeCodeSession'

// Mock the API module
vi.mock('@/lib/api', () => ({
  api: {
    getProjects: vi.fn(),
    getSessions: vi.fn(),
    executeClaudeCode: vi.fn(),
  }
}))

// Mock Tauri APIs
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}))

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: 'div',
    button: 'button',
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}))

describe('ClaudeCodeSession', () => {
  const mockOnBack = vi.fn()
  const mockOnProjectSettings = vi.fn()
  // 使用 mockOnProjectSettings 避免 TypeScript 警告
  mockOnProjectSettings.mockName('mockOnProjectSettings')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders correctly with basic props', () => {
    render(
      <ClaudeCodeSession 
        onBack={mockOnBack}
        initialProjectPath="/test/path"
      />
    )

    expect(screen.getByText('Claude Code Session')).toBeInTheDocument()
  })

  it('calls onBack when back button is clicked', () => {
    render(
      <ClaudeCodeSession 
        onBack={mockOnBack}
      />
    )

    const backButton = screen.getByRole('button', { name: /back/i })
    fireEvent.click(backButton)

    expect(mockOnBack).toHaveBeenCalledTimes(1)
  })

  it('displays project path when provided', () => {
    const testPath = '/test/project/path'
    render(
      <ClaudeCodeSession 
        onBack={mockOnBack}
        initialProjectPath={testPath}
      />
    )

    expect(screen.getByDisplayValue(testPath)).toBeInTheDocument()
  })

  it('handles session resumption', async () => {
    const mockSession = {
      id: 'test-session-123',
      project_id: 'test-project',
      project_path: '/test/path',
      created_at: Date.now(),
      first_message: 'Test message',
      message_timestamp: new Date().toISOString(),
    }

    render(
      <ClaudeCodeSession 
        session={mockSession}
        onBack={mockOnBack}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Resume Session')).toBeInTheDocument()
    })
  })

  it('applies custom className', () => {
    const customClass = 'custom-test-class'
    const { container } = render(
      <ClaudeCodeSession 
        onBack={mockOnBack}
        className={customClass}
      />
    )

    expect(container.firstChild).toHaveClass(customClass)
  })
})