import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLoadingState } from '../useLoadingState'

describe('useLoadingState Hook', () => {
  const mockAsyncFunction = async (value: string) => {
    return `processed: ${value}`
  }

  it('should initialize with loading false', () => {
    const { result } = renderHook(() => useLoadingState(mockAsyncFunction))
    
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should handle async function execution', async () => {
    const { result } = renderHook(() => useLoadingState(mockAsyncFunction))
    
    let promise: Promise<string>
    
    act(() => {
      promise = result.current.execute('test')
    })
    
    expect(result.current.isLoading).toBe(true)
    
    const response = await promise!
    
    expect(response).toBe('processed: test')
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should handle errors correctly', async () => {
    const errorFunction = async () => {
      throw new Error('Test error')
    }
    
    const { result } = renderHook(() => useLoadingState(errorFunction))
    
    let promise: Promise<any>
    
    act(() => {
      promise = result.current.execute()
    })
    
    try {
      await promise!
    } catch (error) {
      // Expected to throw
    }
    
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeTruthy()
    expect(result.current.error?.message).toBe('Test error')
  })

  it('should clear error on successful execution', async () => {
    const errorFunction = async () => {
      throw new Error('Initial error')
    }
    
    const { result } = renderHook(() => useLoadingState(errorFunction))
    
    // First execution with error
    let promise1: Promise<any>
    
    act(() => {
      promise1 = result.current.execute()
    })
    
    try {
      await promise1!
    } catch (error) {
      // Expected to throw
    }
    
    expect(result.current.error).toBeTruthy()
    
    // Now test with successful function
    const { result: result2 } = renderHook(() => useLoadingState(mockAsyncFunction))
    
    let promise2: Promise<string>
    
    act(() => {
      promise2 = result2.current.execute('test')
    })
    
    await promise2!
    
    expect(result2.current.error).toBeNull()
  })

  it('should reset state correctly', () => {
    const { result } = renderHook(() => useLoadingState(mockAsyncFunction))
    
    act(() => {
      result.current.reset()
    })
    
    expect(result.current.data).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })
})