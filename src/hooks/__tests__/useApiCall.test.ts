import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useApiCall } from "../useApiCall";

/**
 * Test suite for useApiCall hook
 *
 * Tests the API call hook functionality including loading states,
 * error handling, data management, and state transitions.
 */
describe("useApiCall Hook", () => {
  /**
   * Mock API function for testing
   */
  const mockApiFunction = vi.fn();

  beforeEach(() => {
    mockApiFunction.mockClear();
  });

  it("should initialize with correct default state", () => {
    const { result } = renderHook(() => useApiCall(mockApiFunction));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toBeNull();
  });

  it("should handle successful API call", async () => {
    const mockData = { id: 1, name: "Test" };
    mockApiFunction.mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useApiCall(mockApiFunction));

    let promise: Promise<any> | undefined;

    act(() => {
      promise = result.current.call("param1", "param2");
    });

    expect(result.current.isLoading).toBe(true);

    if (!promise) {
      throw new Error("Promise was not assigned");
    }

    const response = await act(async () => {
      return await promise;
    });

    expect(response).toBe(mockData);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBe(mockData);
    expect(result.current.error).toBeNull();
    expect(mockApiFunction).toHaveBeenCalledWith("param1", "param2");
  });

  it("should handle API call errors", async () => {
    const mockError = new Error("API Error");
    mockApiFunction.mockRejectedValueOnce(mockError);

    const { result } = renderHook(() => useApiCall(mockApiFunction));

    let promise: Promise<any> | undefined;

    act(() => {
      promise = result.current.call();
    });

    if (!promise) {
      throw new Error("Promise was not assigned");
    }

    await act(async () => {
      try {
        await promise;
      } catch (_error) {
        // Expected to throw
      }
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(mockError);
    expect(result.current.data).toBeNull();
  });

  it("should clear error on new execution", async () => {
    const mockError = new Error("Initial error");
    mockApiFunction.mockRejectedValueOnce(mockError);

    const { result } = renderHook(() => useApiCall(mockApiFunction));

    // First call with error
    let promise1: Promise<any> | undefined;

    act(() => {
      promise1 = result.current.call();
    });

    if (!promise1) {
      throw new Error("Promise was not assigned");
    }

    await act(async () => {
      try {
        await promise1;
      } catch (_error) {
        // Expected to throw
      }
    });

    expect(result.current.error).toBe(mockError);

    // Second call should clear error
    const mockData = { success: true };
    mockApiFunction.mockResolvedValueOnce(mockData);

    let promise2: Promise<any> | undefined;

    act(() => {
      promise2 = result.current.call();
    });

    if (!promise2) {
      throw new Error("Promise was not assigned");
    }

    await act(async () => {
      await promise2;
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data).toBe(mockData);
  });
});
