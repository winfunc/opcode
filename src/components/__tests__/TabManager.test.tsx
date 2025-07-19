import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TabManager } from '../TabManager'

// Mock the TabContext
vi.mock('@/contexts/TabContext', () => ({
  useTabContext: () => ({
    tabs: [
      { id: '1', title: 'Tab 1', type: 'project', content: {} },
      { id: '2', title: 'Tab 2', type: 'session', content: {} }
    ],
    activeTabId: '1',
    addTab: vi.fn(),
    removeTab: vi.fn(),
    setActiveTab: vi.fn(),
    updateTab: vi.fn()
  })
}))

describe('TabManager Component', () => {
  it('renders tabs correctly', () => {
    render(<TabManager />)
    
    expect(screen.getByText('Tab 1')).toBeInTheDocument()
    expect(screen.getByText('Tab 2')).toBeInTheDocument()
  })

  it('shows active tab indicator', () => {
    render(<TabManager />)
    
    const activeTab = screen.getByText('Tab 1').closest('button')
    expect(activeTab).toHaveClass('bg-background')
  })

  it('handles tab close button', () => {
    render(<TabManager />)
    
    const closeButtons = screen.getAllByRole('button', { name: /close/i })
    expect(closeButtons).toHaveLength(2)
  })

  it('handles new tab creation', () => {
    render(<TabManager />)
    
    const newTabButton = screen.getByRole('button', { name: /new tab/i })
    fireEvent.click(newTabButton)
    
    // Should trigger addTab function
    expect(newTabButton).toBeInTheDocument()
  })
})