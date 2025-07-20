import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";

/**
 * Test setup configuration for Vitest and React Testing Library
 *
 * Configures the testing environment with Jest DOM matchers and automatic
 * cleanup after each test case to ensure test isolation.
 */

// Jest DOM matchers are automatically extended when importing '@testing-library/jest-dom'

/**
 * Cleanup function that runs after each test case
 *
 * Ensures proper cleanup of the DOM and React components to prevent
 * test interference and memory leaks.
 */
afterEach(() => {
  cleanup();
});
