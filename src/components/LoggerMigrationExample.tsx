/**
 * @fileoverview Example component demonstrating unified logger usage
 * This component shows how to properly use the unified logging system
 * instead of console.* calls throughout the application.
 */

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { logger } from "@/lib/logger";

/**
 * Example component showing proper logger usage patterns
 *
 * This component demonstrates:
 * - Using contextual logger instead of console.*
 * - Proper error handling with unified error handler
 * - Performance timing for operations
 * - Different log levels for different scenarios
 */
export const LoggerMigrationExample: React.FC = () => {
  const [result, setResult] = useState<string>("");

  // ❌ OLD WAY - Don't do this
  const oldWayExample = () => {
    logger.info("This is the old way");
    logger.error("Error occurred");
    logger.warn("Warning message");
  };

  // ✅ NEW WAY - Use unified logger
  const newWayExample = () => {
    logger.info("This is the new way with contextual logging");
    logger.error("Error occurred with proper context");
    logger.warn("Warning message with component context");
  };

  // ✅ Example: API call with proper error handling
  const handleApiCall = async () => {
    try {
      logger.info("Starting API call...");

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Simulate random success/failure
      if (Math.random() > 0.5) {
        throw new Error("Simulated API error");
      }

      logger.info("API call completed successfully");
      return "API call successful!";
    } catch (error) {
      logger.error("API call failed:", error);
      return null;
    }
  };

  // ✅ Example: Performance timing
  const handlePerformanceExample = async () => {
    const start = Date.now();
    logger.debug("Starting heavy computation...");

    // Simulate heavy work
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const duration = Date.now() - start;
    logger.debug(`Heavy computation completed in ${duration}ms`);
    setResult("Computation result");
  };

  // ✅ Example: Error handling with context
  const handleErrorExample = async () => {
    try {
      throw new Error("Example error for demonstration");
    } catch (error) {
      logger.error("Error in handleErrorExample:", error);
    }
  };

  // ✅ Example: Different log levels
  const handleLogLevelsExample = () => {
    logger.debug("Debug information - only shown in development");
    logger.info("General information about application flow");
    logger.warn("Warning about potential issues");
    logger.error("Error that needs attention");
  };

  return (
    <Card className="p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Logger Migration Example</h2>

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Basic Logging</h3>
          <div className="flex gap-2">
            <Button onClick={oldWayExample} variant="destructive" size="sm">
              ❌ Old Way (console.*)
            </Button>
            <Button onClick={newWayExample} variant="default" size="sm">
              ✅ New Way (logger)
            </Button>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">API Call with Error Handling</h3>
          <Button
            onClick={async () => {
              const result = await handleApiCall();
              if (result) {
                setResult(result);
              }
            }}
            variant="outline"
          >
            Test API Call
          </Button>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">Performance Timing</h3>
          <Button onClick={handlePerformanceExample} variant="outline">
            Test Performance Timing
          </Button>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">Error Handling</h3>
          <Button onClick={handleErrorExample} variant="outline">
            Test Error Handling
          </Button>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">Log Levels</h3>
          <Button onClick={handleLogLevelsExample} variant="outline">
            Test Log Levels
          </Button>
        </div>

        {result && (
          <div className="mt-4 p-3 bg-green-100 rounded">
            <strong>Result:</strong> {result}
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-gray-100 rounded">
        <h4 className="font-semibold mb-2">Migration Guidelines:</h4>
        <ul className="text-sm space-y-1">
          <li>
            • Replace <code>console.log</code> with <code>logger.info</code>
          </li>
          <li>
            • Replace <code>console.error</code> with <code>logger.error</code>
          </li>
          <li>
            • Replace <code>console.warn</code> with <code>logger.warn</code>
          </li>
          <li>
            • Replace <code>console.debug</code> with <code>logger.debug</code>
          </li>
          <li>
            • Use contextual logger: <code>useLogger('ComponentName')</code>
          </li>
          <li>• Use unified error handler for consistent error handling</li>
          <li>• Use performance timing for measuring operations</li>
        </ul>
      </div>
    </Card>
  );
};
