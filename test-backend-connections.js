/**
 * Claudia Backend Connection Test Script
 * Run this in the browser console at http://localhost:1420 to test all API endpoints
 */

async function testBackendConnections() {
    console.log("🔍 Starting Claudia Backend Connection Tests...");
    console.log("Backend URL: http://localhost:1420");
    console.log("===================================");
    
    const testResults = {
        timestamp: new Date().toISOString(),
        tests: [],
        summary: { passed: 0, failed: 0, total: 0 }
    };

    // Helper function to run individual tests
    async function runTest(testName, testFunction, description) {
        const startTime = Date.now();
        let result = {
            name: testName,
            description,
            status: 'unknown',
            duration: 0,
            error: null,
            response: null
        };

        try {
            console.log(`\n📋 Testing: ${testName}`);
            console.log(`   ${description}`);
            
            const response = await testFunction();
            
            result.status = 'PASS';
            result.response = response;
            result.duration = Date.now() - startTime;
            
            console.log(`   ✅ PASS (${result.duration}ms)`);
            testResults.summary.passed++;
            
        } catch (error) {
            result.status = 'FAIL';
            result.error = error.message || error.toString();
            result.duration = Date.now() - startTime;
            
            console.log(`   ❌ FAIL (${result.duration}ms)`);
            console.log(`   Error: ${result.error}`);
            testResults.summary.failed++;
        }
        
        testResults.tests.push(result);
        testResults.summary.total++;
    }

    // Test 1: Usage Dashboard API
    await runTest("Usage Dashboard", async () => {
        if (typeof window !== 'undefined' && window.api) {
            return await window.api.getUsageStats();
        } else {
            // Fallback: try to access via global objects
            const { api } = await import('./src/lib/api.js');
            return await api.getUsageStats();
        }
    }, "Tests if usage statistics can be loaded (api.getUsageStats)");

    // Test 2: CLAUDE.md File Loading
    await runTest("CLAUDE.md Loading", async () => {
        if (typeof window !== 'undefined' && window.api) {
            return await window.api.getSystemPrompt();
        } else {
            const { api } = await import('./src/lib/api.js');
            return await api.getSystemPrompt();
        }
    }, "Tests if CLAUDE.md system prompt can be loaded (api.getSystemPrompt)");

    // Test 3: MCP Servers
    await runTest("MCP Servers", async () => {
        if (typeof window !== 'undefined' && window.api) {
            return await window.api.mcpList();
        } else {
            const { api } = await import('./src/lib/api.js');
            return await api.mcpList();
        }
    }, "Tests if MCP servers can be listed (api.mcpList)");

    // Test 4: Settings
    await runTest("Claude Settings", async () => {
        if (typeof window !== 'undefined' && window.api) {
            return await window.api.getClaudeSettings();
        } else {
            const { api } = await import('./src/lib/api.js');
            return await api.getClaudeSettings();
        }
    }, "Tests if Claude settings can be loaded (api.getClaudeSettings)");

    // Test 5: CC Agents
    await runTest("CC Agents", async () => {
        if (typeof window !== 'undefined' && window.api) {
            return await window.api.listAgents();
        } else {
            const { api } = await import('./src/lib/api.js');
            return await api.listAgents();
        }
    }, "Tests if CC agents can be listed (api.listAgents)");

    // Test 6: CC Projects
    await runTest("CC Projects", async () => {
        if (typeof window !== 'undefined' && window.api) {
            return await window.api.listProjects();
        } else {
            const { api } = await import('./src/lib/api.js');
            return await api.listProjects();
        }
    }, "Tests if CC projects can be listed (api.listProjects)");

    // Test 7: Claude Version Check
    await runTest("Claude Version Check", async () => {
        if (typeof window !== 'undefined' && window.api) {
            return await window.api.checkClaudeVersion();
        } else {
            const { api } = await import('./src/lib/api.js');
            return await api.checkClaudeVersion();
        }
    }, "Tests if Claude version can be checked (api.checkClaudeVersion)");

    // Print summary
    console.log("\n===================================");
    console.log("🔍 Test Results Summary");
    console.log("===================================");
    console.log(`✅ Passed: ${testResults.summary.passed}`);
    console.log(`❌ Failed: ${testResults.summary.failed}`);
    console.log(`📊 Total:  ${testResults.summary.total}`);
    console.log(`📈 Success Rate: ${(testResults.summary.passed / testResults.summary.total * 100).toFixed(1)}%`);
    
    // Store results globally for access
    window.testResults = testResults;
    
    return testResults;
}

// Auto-run if this script is loaded in the browser
if (typeof window !== 'undefined') {
    console.log("🚀 Claudia Backend Test Script Loaded");
    console.log("Run testBackendConnections() to start testing");
    
    // Make the function globally available
    window.testBackendConnections = testBackendConnections;
} else {
    // Export for Node.js if needed
    module.exports = { testBackendConnections };
}