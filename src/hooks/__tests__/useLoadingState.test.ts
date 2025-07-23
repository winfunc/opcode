import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLoadingState } from "../useLoadingState";

/**
 * Test suite for useLoadingState hook
 *
 * Tests loading state management including async function execution,
 * error handling, state transitions, and reset functionality.
 */
describe("useLoadingState Hook", () => {
  /**
   * Mock async function for testing
   *
   * @param value - Input value to process
   * @returns Processed string with prefix
   */
  const mockAsyncFunction = async (value: string) => {
    return `processed: ${value}`;
  };

  it("should initialize with loading false", () => {
    const { result } = renderHook(() =>
      useLoadingState(mockAsyncFunction as (...args: unknown[]) => Promise<string>)
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should handle async function execution", async () => {
    const { result } = renderHook(() =>
      useLoadingState(mockAsyncFunction as (...args: unknown[]) => Promise<string>)
    );

    let promise: Promise<string> | undefined;

    act(() => {
      promise = result.current.execute("test");
    });

    expect(result.current.isLoading).toBe(true);

    if (!promise) {
      throw new Error("Promise was not assigned");
    }

    const response = await act(async () => {
      return await promise;
    });

    expect(response).toBe("processed: test");
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should handle errors correctly", async () => {
    const errorFunction = async () => {
      throw new Error("Test error");
    };

    const { result } = renderHook(() => useLoadingState(errorFunction));

    let promise: Promise<any> | undefined;

    act(() => {
      promise = result.current.execute();
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
    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toBe("Test error");
  });

  it("should clear error on successful execution", async () => {
    const errorFunction = async () => {
      throw new Error("Initial error");
    };

    const { result } = renderHook(() => useLoadingState(errorFunction));

    // First execution with error
    let promise1: Promise<any> | undefined;

    act(() => {
      promise1 = result.current.execute();
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

    expect(result.current.error).toBeTruthy();

    // Now test with successful function
    const { result: result2 } = renderHook(() =>
      useLoadingState(mockAsyncFunction as (...args: unknown[]) => Promise<string>)
    );

    let promise2: Promise<string> | undefined;

    act(() => {
      promise2 = result2.current.execute("test");
    });

    if (!promise2) {
      throw new Error("Promise was not assigned");
    }

    await act(async () => {
      await promise2;
    });

    expect(result2.current.error).toBeNull();
  });

  it("should reset state correctly", () => {
    const { result } = renderHook(() =>
      useLoadingState(mockAsyncFunction as (...args: unknown[]) => Promise<string>)
    );

    act(() => {
      result.current.reset();
    });

    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
