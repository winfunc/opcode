import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecentDirectoriesDropdown } from '../RecentDirectoriesDropdown'
import * as useRecentDirectoriesHook from '@/hooks/useRecentDirectories'

// Mock the hook
vi.mock('@/hooks/useRecentDirectories')

const mockUseRecentDirectories = useRecentDirectoriesHook.useRecentDirectories as any

describe('RecentDirectoriesDropdown', () => {
  const mockOnSelectDirectory = vi.fn()
  const mockRemoveRecentDirectory = vi.fn()
  const mockClearRecentDirectories = vi.fn()

  const defaultProps = {
    onSelectDirectory: mockOnSelectDirectory,
    currentPath: undefined,
    disabled: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Default mock hook return
    mockUseRecentDirectories.mockReturnValue({
      recentDirectories: [],
      isLoading: false,
      removeRecentDirectory: mockRemoveRecentDirectory,
      clearRecentDirectories: mockClearRecentDirectories,
    })
  })

  describe('Loading State', () => {
    it('should show loading state', () => {
      mockUseRecentDirectories.mockReturnValue({
        recentDirectories: [],
        isLoading: true,
        removeRecentDirectory: mockRemoveRecentDirectory,
        clearRecentDirectories: mockClearRecentDirectories,
      })

      render(<RecentDirectoriesDropdown {...defaultProps} />)

      expect(screen.getByText('Loading...')).toBeInTheDocument()
      expect(screen.getByRole('button')).toBeDisabled()
    })
  })

  describe('Empty State', () => {
    it('should show disabled button when no recent directories', () => {
      render(<RecentDirectoriesDropdown {...defaultProps} />)

      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
      expect(button).toHaveTextContent('Recent (0)')
    })
  })

  describe('With Recent Directories', () => {
    const mockDirectories = [
      {
        path: '/Users/test/recent-project',
        lastUsed: '2024-01-15T10:00:00.000Z',
        displayName: 'recent-project',
      },
      {
        path: '/Users/test/older-project',
        lastUsed: '2024-01-14T08:00:00.000Z',
        displayName: 'older-project',
      },
    ]

    beforeEach(() => {
      mockUseRecentDirectories.mockReturnValue({
        recentDirectories: mockDirectories,
        isLoading: false,
        removeRecentDirectory: mockRemoveRecentDirectory,
        clearRecentDirectories: mockClearRecentDirectories,
      })
    })

    it('should show enabled button with count', () => {
      render(<RecentDirectoriesDropdown {...defaultProps} />)

      const button = screen.getByRole('button')
      expect(button).not.toBeDisabled()
      expect(button).toHaveTextContent('Recent (2)')
    })

    it('should show dropdown content when clicked', async () => {
      const user = userEvent.setup()
      
      render(<RecentDirectoriesDropdown {...defaultProps} />)

      const button = screen.getByRole('button')
      await user.click(button)

      await waitFor(() => {
        expect(screen.getByText('Recent Directories')).toBeInTheDocument()
        expect(screen.getByText('recent-project')).toBeInTheDocument()
        expect(screen.getByText('older-project')).toBeInTheDocument()
        expect(screen.getByText('/Users/test/recent-project')).toBeInTheDocument()
        expect(screen.getByText('/Users/test/older-project')).toBeInTheDocument()
      })
    })

    it('should call onSelectDirectory when directory is clicked', async () => {
      const user = userEvent.setup()
      
      render(<RecentDirectoriesDropdown {...defaultProps} />)

      const button = screen.getByRole('button')
      await user.click(button)

      await waitFor(() => {
        expect(screen.getByText('recent-project')).toBeInTheDocument()
      })

      const directoryItem = screen.getByText('recent-project').closest('[role="menuitem"]')
      expect(directoryItem).toBeInTheDocument()
      
      await user.click(directoryItem!)

      expect(mockOnSelectDirectory).toHaveBeenCalledWith('/Users/test/recent-project')
    })

    it('should show formatted timestamps', async () => {
      const user = userEvent.setup()
      
      // Mock current time to be 2024-01-16 (1 day after recent-project)
      const mockDate = new Date('2024-01-16T10:00:00.000Z')
      vi.setSystemTime(mockDate)

      render(<RecentDirectoriesDropdown {...defaultProps} />)

      const button = screen.getByRole('button')
      await user.click(button)

      await waitFor(() => {
        // Should show relative time
        expect(screen.getByText(/1d ago/)).toBeInTheDocument()
        expect(screen.getByText(/2d ago/)).toBeInTheDocument()
      })

      vi.useRealTimers()
    })

    it('should highlight current path', async () => {
      const user = userEvent.setup()
      
      render(<RecentDirectoriesDropdown {...defaultProps} currentPath="/Users/test/recent-project" />)

      const button = screen.getByRole('button')
      await user.click(button)

      await waitFor(() => {
        const currentItem = screen.getByText('recent-project').closest('[role="menuitem"]')
        expect(currentItem).toHaveClass('bg-accent')
      })
    })

    it('should call removeRecentDirectory when X button is clicked', async () => {
      const user = userEvent.setup()
      
      render(<RecentDirectoriesDropdown {...defaultProps} />)

      const button = screen.getByRole('button')
      await user.click(button)

      await waitFor(() => {
        expect(screen.getByText('recent-project')).toBeInTheDocument()
      })

      // Find the remove button (X) for the first item
      const removeButtons = screen.getAllByTitle('Remove from recent directories')
      expect(removeButtons).toHaveLength(2)

      await user.click(removeButtons[0])

      expect(mockRemoveRecentDirectory).toHaveBeenCalledWith('/Users/test/recent-project')
    })

    it('should show clear all option', async () => {
      const user = userEvent.setup()
      
      render(<RecentDirectoriesDropdown {...defaultProps} />)

      const button = screen.getByRole('button')
      await user.click(button)

      await waitFor(() => {
        expect(screen.getByText('Clear all recent directories')).toBeInTheDocument()
      })
    })

    it('should call clearRecentDirectories when clear all is clicked', async () => {
      const user = userEvent.setup()
      
      render(<RecentDirectoriesDropdown {...defaultProps} />)

      const button = screen.getByRole('button')
      await user.click(button)

      await waitFor(() => {
        expect(screen.getByText('Clear all recent directories')).toBeInTheDocument()
      })

      const clearAllButton = screen.getByText('Clear all recent directories')
      await user.click(clearAllButton)

      expect(mockClearRecentDirectories).toHaveBeenCalled()
    })

    it('should prevent event propagation when X button is clicked', async () => {
      const user = userEvent.setup()
      
      render(<RecentDirectoriesDropdown {...defaultProps} />)

      const button = screen.getByRole('button')
      await user.click(button)

      await waitFor(() => {
        expect(screen.getByText('recent-project')).toBeInTheDocument()
      })

      const removeButtons = screen.getAllByTitle('Remove from recent directories')
      await user.click(removeButtons[0])

      // onSelectDirectory should NOT be called when X is clicked
      expect(mockOnSelectDirectory).not.toHaveBeenCalled()
      expect(mockRemoveRecentDirectory).toHaveBeenCalledWith('/Users/test/recent-project')
    })
  })

  describe('Disabled State', () => {
    it('should be disabled when disabled prop is true', () => {
      mockUseRecentDirectories.mockReturnValue({
        recentDirectories: [
          {
            path: '/test/path',
            lastUsed: '2024-01-15T10:00:00.000Z',
            displayName: 'test',
          },
        ],
        isLoading: false,
        removeRecentDirectory: mockRemoveRecentDirectory,
        clearRecentDirectories: mockClearRecentDirectories,
      })

      render(<RecentDirectoriesDropdown {...defaultProps} disabled={true} />)

      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
    })
  })

  describe('Custom Class Name', () => {
    it('should apply custom className', () => {
      render(<RecentDirectoriesDropdown {...defaultProps} className="custom-class" />)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('custom-class')
    })
  })

  describe('Accessibility', () => {
    const mockDirectories = [
      {
        path: '/Users/test/project1',
        lastUsed: '2024-01-15T10:00:00.000Z',
        displayName: 'project1',
      },
    ]

    beforeEach(() => {
      mockUseRecentDirectories.mockReturnValue({
        recentDirectories: mockDirectories,
        isLoading: false,
        removeRecentDirectory: mockRemoveRecentDirectory,
        clearRecentDirectories: mockClearRecentDirectories,
      })
    })

    it('should have proper ARIA labels and roles', async () => {
      const user = userEvent.setup()
      
      render(<RecentDirectoriesDropdown {...defaultProps} />)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-haspopup')

      await user.click(button)

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument()
        expect(screen.getAllByRole('menuitem')).toHaveLength(2) // 1 directory + clear all
      })
    })

    it('should have proper tooltips', () => {
      render(<RecentDirectoriesDropdown {...defaultProps} />)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('title', 'Select from recent directories')
    })

    it('should show no recent directories tooltip when empty', () => {
      // Override mock to return empty directories for this test
      mockUseRecentDirectories.mockReturnValue({
        recentDirectories: [],
        isLoading: false,
        removeRecentDirectory: mockRemoveRecentDirectory,
        clearRecentDirectories: mockClearRecentDirectories,
      })

      render(<RecentDirectoriesDropdown {...defaultProps} />)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('title', 'No recent directories')
    })
  })

  describe('Time Formatting', () => {
    beforeEach(() => {
      // Mock current time for consistent testing
      vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should format recent times correctly', async () => {
      const user = userEvent.setup()
      
      const testDirectories = [
        {
          path: '/test/just-now',
          lastUsed: '2024-01-15T11:59:30.000Z', // 30 seconds ago
          displayName: 'just-now',
        },
        {
          path: '/test/minutes-ago',
          lastUsed: '2024-01-15T11:30:00.000Z', // 30 minutes ago
          displayName: 'minutes-ago',
        },
        {
          path: '/test/hours-ago',
          lastUsed: '2024-01-15T08:00:00.000Z', // 4 hours ago
          displayName: 'hours-ago',
        },
        {
          path: '/test/days-ago',
          lastUsed: '2024-01-13T12:00:00.000Z', // 2 days ago
          displayName: 'days-ago',
        },
        {
          path: '/test/week-ago',
          lastUsed: '2024-01-07T12:00:00.000Z', // 1 week ago
          displayName: 'week-ago',
        },
      ]

      mockUseRecentDirectories.mockReturnValue({
        recentDirectories: testDirectories,
        isLoading: false,
        removeRecentDirectory: mockRemoveRecentDirectory,
        clearRecentDirectories: mockClearRecentDirectories,
      })

      render(<RecentDirectoriesDropdown {...defaultProps} />)

      const button = screen.getByRole('button')
      await user.click(button)

      await waitFor(() => {
        expect(screen.getByText('Just now')).toBeInTheDocument()
        expect(screen.getByText('30m ago')).toBeInTheDocument()
        expect(screen.getByText('4h ago')).toBeInTheDocument()
        expect(screen.getByText('2d ago')).toBeInTheDocument()
        // Week-old items show as date
        expect(screen.getByText('1/7/2024')).toBeInTheDocument()
      })
    })
  })
})