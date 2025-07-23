import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useRecentDirectories } from '../useRecentDirectories'
import * as api from '@/lib/api'

// Mock the API module
vi.mock('@/lib/api', () => ({
  api: {
    getClaudeSettings: vi.fn(),
    saveClaudeSettings: vi.fn(),
  },
}))

const mockApi = api.api as any

describe('useRecentDirectories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock: empty settings
    mockApi.getClaudeSettings.mockResolvedValue({})
    mockApi.saveClaudeSettings.mockResolvedValue('Settings saved')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initial Loading', () => {
    it('should start with loading state and empty directories', async () => {
      const { result } = renderHook(() => useRecentDirectories())

      expect(result.current.isLoading).toBe(true)
      expect(result.current.recentDirectories).toEqual([])

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('should load existing directories from settings', async () => {
      const mockDirectories = [
        {
          path: '/Users/test/project1',
          lastUsed: '2024-01-15T10:00:00.000Z',
          displayName: 'project1',
        },
        {
          path: '/Users/test/project2',
          lastUsed: '2024-01-14T09:00:00.000Z',
          displayName: 'project2',
        },
      ]

      mockApi.getClaudeSettings.mockResolvedValue({
        recentDirectories: mockDirectories,
      })

      const { result } = renderHook(() => useRecentDirectories())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
        expect(result.current.recentDirectories).toEqual(mockDirectories)
      })
    })

    it('should handle corrupted data gracefully', async () => {
      mockApi.getClaudeSettings.mockResolvedValue({
        recentDirectories: [
          { path: '/valid/path', lastUsed: '2024-01-15T10:00:00.000Z', displayName: 'valid' },
          { path: '', lastUsed: '2024-01-14T09:00:00.000Z', displayName: 'invalid1' }, // Invalid: empty path
          { path: '/another/path' }, // Invalid: missing required fields
          null, // Invalid: null entry
        ],
      })

      const { result } = renderHook(() => useRecentDirectories())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
        expect(result.current.recentDirectories).toEqual([
          { path: '/valid/path', lastUsed: '2024-01-15T10:00:00.000Z', displayName: 'valid' },
        ])
      })
    })

    it('should handle API errors gracefully', async () => {
      mockApi.getClaudeSettings.mockRejectedValue(new Error('API Error'))

      const { result } = renderHook(() => useRecentDirectories())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
        expect(result.current.recentDirectories).toEqual([])
      })
    })
  })

  describe('Adding Recent Directories', () => {
    it('should add a new directory to the beginning of the list', async () => {
      const { result } = renderHook(() => useRecentDirectories())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.addRecentDirectory('/Users/test/new-project')
      })

      expect(result.current.recentDirectories).toHaveLength(1)
      expect(result.current.recentDirectories[0]).toMatchObject({
        path: '/Users/test/new-project',
        displayName: 'new-project',
      })
      expect(result.current.recentDirectories[0].lastUsed).toBeDefined()
    })

    it('should move existing directory to the top when re-added', async () => {
      mockApi.getClaudeSettings.mockResolvedValue({
        recentDirectories: [
          {
            path: '/Users/test/project1',
            lastUsed: '2024-01-15T10:00:00.000Z',
            displayName: 'project1',
          },
          {
            path: '/Users/test/project2',
            lastUsed: '2024-01-14T09:00:00.000Z',
            displayName: 'project2',
          },
        ],
      })

      const { result } = renderHook(() => useRecentDirectories())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.addRecentDirectory('/Users/test/project2')
      })

      expect(result.current.recentDirectories).toHaveLength(2)
      expect(result.current.recentDirectories[0].path).toBe('/Users/test/project2')
      expect(result.current.recentDirectories[1].path).toBe('/Users/test/project1')
    })

    it('should limit directories to maximum of 10', async () => {
      // Create 10 existing directories
      const existingDirectories = Array.from({ length: 10 }, (_, i) => ({
        path: `/Users/test/project${i}`,
        lastUsed: new Date(2024, 0, i + 1).toISOString(),
        displayName: `project${i}`,
      }))

      mockApi.getClaudeSettings.mockResolvedValue({
        recentDirectories: existingDirectories,
      })

      const { result } = renderHook(() => useRecentDirectories())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Add an 11th directory
      await act(async () => {
        await result.current.addRecentDirectory('/Users/test/new-project')
      })

      expect(result.current.recentDirectories).toHaveLength(10)
      expect(result.current.recentDirectories[0].path).toBe('/Users/test/new-project')
      expect(result.current.recentDirectories[9].path).toBe('/Users/test/project1') // Last one should be dropped
    })

    it('should ignore empty or whitespace-only paths', async () => {
      const { result } = renderHook(() => useRecentDirectories())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.addRecentDirectory('')
        await result.current.addRecentDirectory('   ')
        await result.current.addRecentDirectory('\t\n')
      })

      expect(result.current.recentDirectories).toHaveLength(0)
    })

    it('should generate correct display names from paths', async () => {
      const { result } = renderHook(() => useRecentDirectories())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const testCases = [
        { path: '/Users/test/my-project', expectedName: 'my-project' },
        { path: '/complex/nested/path/final-dir', expectedName: 'final-dir' },
        { path: '/single-dir', expectedName: 'single-dir' },
        { path: 'relative-path', expectedName: 'relative-path' },
      ]

      for (const testCase of testCases) {
        await act(async () => {
          await result.current.addRecentDirectory(testCase.path)
        })

        const addedDir = result.current.recentDirectories.find(dir => dir.path === testCase.path)
        expect(addedDir?.displayName).toBe(testCase.expectedName)
      }
    })
  })

  describe('Removing Recent Directories', () => {
    it('should remove directory from the list', async () => {
      mockApi.getClaudeSettings.mockResolvedValue({
        recentDirectories: [
          {
            path: '/Users/test/project1',
            lastUsed: '2024-01-15T10:00:00.000Z',
            displayName: 'project1',
          },
          {
            path: '/Users/test/project2',
            lastUsed: '2024-01-14T09:00:00.000Z',
            displayName: 'project2',
          },
        ],
      })

      const { result } = renderHook(() => useRecentDirectories())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.removeRecentDirectory('/Users/test/project1')
      })

      expect(result.current.recentDirectories).toHaveLength(1)
      expect(result.current.recentDirectories[0].path).toBe('/Users/test/project2')
    })

    it('should handle removing non-existent directory gracefully', async () => {
      mockApi.getClaudeSettings.mockResolvedValue({
        recentDirectories: [
          {
            path: '/Users/test/project1',
            lastUsed: '2024-01-15T10:00:00.000Z',
            displayName: 'project1',
          },
        ],
      })

      const { result } = renderHook(() => useRecentDirectories())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.removeRecentDirectory('/non/existent/path')
      })

      expect(result.current.recentDirectories).toHaveLength(1)
    })
  })

  describe('Clearing All Directories', () => {
    it('should clear all directories', async () => {
      mockApi.getClaudeSettings.mockResolvedValue({
        recentDirectories: [
          {
            path: '/Users/test/project1',
            lastUsed: '2024-01-15T10:00:00.000Z',
            displayName: 'project1',
          },
          {
            path: '/Users/test/project2',
            lastUsed: '2024-01-14T09:00:00.000Z',
            displayName: 'project2',
          },
        ],
      })

      const { result } = renderHook(() => useRecentDirectories())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.clearRecentDirectories()
      })

      expect(result.current.recentDirectories).toHaveLength(0)
    })
  })

  describe('Settings Persistence', () => {
    it('should save to settings when adding directory', async () => {
      const { result } = renderHook(() => useRecentDirectories())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.addRecentDirectory('/Users/test/project')
      })

      await waitFor(() => {
        expect(mockApi.saveClaudeSettings).toHaveBeenCalledWith(
          expect.objectContaining({
            recentDirectories: expect.arrayContaining([
              expect.objectContaining({
                path: '/Users/test/project',
                displayName: 'project',
              }),
            ]),
          })
        )
      })
    })

    it('should save to settings when removing directory', async () => {
      mockApi.getClaudeSettings.mockResolvedValue({
        recentDirectories: [
          {
            path: '/Users/test/project1',
            lastUsed: '2024-01-15T10:00:00.000Z',
            displayName: 'project1',
          },
        ],
      })

      const { result } = renderHook(() => useRecentDirectories())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.removeRecentDirectory('/Users/test/project1')
      })

      await waitFor(() => {
        expect(mockApi.saveClaudeSettings).toHaveBeenCalledWith({
          recentDirectories: [],
        })
      })
    })

    it('should save to settings when clearing all directories', async () => {
      mockApi.getClaudeSettings.mockResolvedValue({
        recentDirectories: [
          {
            path: '/Users/test/project1',
            lastUsed: '2024-01-15T10:00:00.000Z',
            displayName: 'project1',
          },
        ],
      })

      const { result } = renderHook(() => useRecentDirectories())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.clearRecentDirectories()
      })

      expect(mockApi.saveClaudeSettings).toHaveBeenCalledWith({
        recentDirectories: [],
      })
    })

    it('should handle save errors gracefully', async () => {
      mockApi.saveClaudeSettings.mockRejectedValue(new Error('Save failed'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { result } = renderHook(() => useRecentDirectories())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.addRecentDirectory('/Users/test/project')
      })

      // Should still update the UI even if save fails
      expect(result.current.recentDirectories).toHaveLength(1)
      expect(consoleSpy).toHaveBeenCalledWith('Failed to save recent directories:', expect.any(Error))

      consoleSpy.mockRestore()
    })
  })

  describe('Data Sorting', () => {
    it('should sort directories by last used date (most recent first)', async () => {
      mockApi.getClaudeSettings.mockResolvedValue({
        recentDirectories: [
          {
            path: '/Users/test/old-project',
            lastUsed: '2024-01-10T10:00:00.000Z',
            displayName: 'old-project',
          },
          {
            path: '/Users/test/recent-project',
            lastUsed: '2024-01-15T10:00:00.000Z',
            displayName: 'recent-project',
          },
          {
            path: '/Users/test/middle-project',
            lastUsed: '2024-01-12T10:00:00.000Z',
            displayName: 'middle-project',
          },
        ],
      })

      const { result } = renderHook(() => useRecentDirectories())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.recentDirectories[0].path).toBe('/Users/test/recent-project')
      expect(result.current.recentDirectories[1].path).toBe('/Users/test/middle-project')
      expect(result.current.recentDirectories[2].path).toBe('/Users/test/old-project')
    })
  })
})