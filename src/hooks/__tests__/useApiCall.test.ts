import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useApiCall } from '../useApiCall'

describe('useApiCall Hook', () => {
  const mockApiFunction = vi.fn()

  beforeEach(() => {
    mockApiFunction.mockClear()
  })

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useApiCall(mockApiFunction))
    
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.data).toBeUndefined()
  })

  it('should handle successful API call', async () => {
    const mockData = { id: 1, name: 'Test' }
    mockApiFunction.mockResolvedValueOnce(mockData)
    
    const { result } = renderHook(() => useApiCall(mockApiFunction))
    
    let promise: Promise<any>
    
    act(() => {
      promise = result.current.call('param1', 'param2')
    })
    
    expect(result.current.isLoading).toBe(true)
    
    const response = await promise!
    
    expect(response).toBe(mockData)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toBe(mockData)
    expect(result.current.error).toBeNull()
    expect(mockApiFunction).toHaveBeenCalledWith('param1', 'param2')
  })

  it('should handle API call errors', async () => {
    const mockError = new Error('API Error')
    mockApiFunction.mockRejectedValueOnce(mockError)
    
    const { result } = renderHook(() => useApiCall(mockApiFunction))
    
    let promise: Promise<any>
    
    act(() => {
      promise = result.current.call()
    })
    
    try {
      await promise!
    } catch (error) {
      // Expected to throw
    }
    
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe(mockError)
    expect(result.current.data).toBeUndefined()
  })

  it('should clear error on new execution', async () => {
    const mockError = new Error('Initial error')
    mockApiFunction.mockRejectedValueOnce(mockError)
    
    const { result } = renderHook(() => useApiCall(mockApiFunction))
    
    // First call with error
    let promise1: Promise<any>
    
    act(() => {
      promise1 = result.current.call()
    })
    
    try {
      await promise1!
    } catch (error) {
      // Expected to throw
    }
    
    expect(result.current.error).toBe(mockError)
    
    // Second call should clear error
    const mockData = { success: true }
    mockApiFunction.mockResolvedValueOnce(mockData)
    
    let promise2: Promise<any>
    
    act(() => {
      promise2 = result.current.call()
    })
    
    await promise2!
    
    expect(result.current.error).toBeNull()
    expect(result.current.data).toBe(mockData)
  })
})