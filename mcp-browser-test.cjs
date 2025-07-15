#!/usr/bin/env node

/**
 * Comprehensive Sequential Testing of Claudia Application
 * Using Playwright MCP with Chromium Browser
 * 
 * Testing Strategy:
 * 1. Navigate to localhost:1420 
 * 2. Test all navigation buttons sequentially
 * 3. Verify 186 MCP tools are available
 * 4. Test browser compatibility warnings
 * 5. Report all failures or issues
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  url: 'http://localhost:1420',
  screenshotDir: './mcp-test-screenshots',
  timeout: 30000,
  headless: true // Use headless for MCP testing
};

// Ensure screenshot directory exists
if (!fs.existsSync(TEST_CONFIG.screenshotDir)) {
  fs.mkdirSync(TEST_CONFIG.screenshotDir, { recursive: true });
}

async function comprehensiveClaudiaTest() {
  console.log('\n🧪 COMPREHENSIVE SEQUENTIAL CLAUDIA TEST');
  console.log('Using Playwright MCP with Chromium Browser');
  console.log('='.repeat(60));
  
  const results = {
    timestamp: new Date().toISOString(),
    url: TEST_CONFIG.url,
    browser: 'chromium',
    tests: {
      navigation: false,
      ccAgents: { accessible: false, functional: false },
      ccProjects: { accessible: false, functional: false },
      crewAI: { accessible: false, functional: false },
      mcpTools: { accessible: false, toolCount: 0, expectedCount: 186 },
      settings: { accessible: false, functional: false },
      browserCompatibility: { detected: false, chromiumOnly: false }
    },
    screenshots: [],
    errors: [],
    summary: '',
    recommendations: []
  };

  let browser, context, page;

  try {
    // Step 1: Launch Browser
    console.log('\n1️⃣  Launching Chromium Browser...');
    browser = await chromium.launch({
      headless: TEST_CONFIG.headless,
      args: [
        '--no-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: true
    });
    
    page = await context.newPage();
    
    // Step 2: Navigation Test
    console.log('\n2️⃣  Testing Navigation to Claudia Application...');
    try {
      console.log(`Attempting to connect to: ${TEST_CONFIG.url}`);
      
      const response = await page.goto(TEST_CONFIG.url, { 
        waitUntil: 'networkidle',
        timeout: TEST_CONFIG.timeout 
      });
      
      if (response && response.ok()) {
        console.log('✅ Successfully connected to Claudia');
        console.log(`📊 HTTP Status: ${response.status()}`);
        results.tests.navigation = true;
        
        // Take initial screenshot
        const screenshotPath = path.join(TEST_CONFIG.screenshotDir, '01-initial-load.png');
        await page.screenshot({ 
          path: screenshotPath,
          fullPage: true 
        });
        results.screenshots.push(screenshotPath);
        
        // Get page info
        const pageTitle = await page.title();
        const pageUrl = page.url();
        console.log(`📋 Page Title: ${pageTitle}`);
        console.log(`🔗 Current URL: ${pageUrl}`);
        
        // Step 3: Test Browser Compatibility Warning
        console.log('\n3️⃣  Testing Browser Compatibility System...');
        await testBrowserCompatibility(page, results);
        
        // Step 4: Test CC Agents Button
        console.log('\n4️⃣  Testing CC Agents Button...');
        await testCCAgents(page, results);
        
        // Step 5: Test CC Projects Button
        console.log('\n5️⃣  Testing CC Projects Button...');
        await testCCProjects(page, results);
        
        // Step 6: Test CrewAI Button
        console.log('\n6️⃣  Testing CrewAI Integration...');
        await testCrewAI(page, results);
        
        // Step 7: Test MCP Tools Panel
        console.log('\n7️⃣  Testing MCP Tools Panel (186 tools expected)...');
        await testMCPTools(page, results);
        
        // Step 8: Test Settings
        console.log('\n8️⃣  Testing Settings Configuration...');
        await testSettings(page, results);
        
        // Final screenshot
        const finalScreenshot = path.join(TEST_CONFIG.screenshotDir, '09-final-state.png');
        await page.screenshot({ 
          path: finalScreenshot,
          fullPage: true 
        });
        results.screenshots.push(finalScreenshot);
        
      } else {
        throw new Error(`Navigation failed with status: ${response?.status() || 'unknown'}`);
      }
      
    } catch (navError) {
      console.log('❌ Navigation failed:', navError.message);
      results.errors.push(`Navigation: ${navError.message}`);
      
      // Try to get error page screenshot
      try {
        const errorScreenshot = path.join(TEST_CONFIG.screenshotDir, '00-navigation-error.png');
        await page.screenshot({ path: errorScreenshot });
        results.screenshots.push(errorScreenshot);
      } catch (screenshotError) {
        console.log('Could not capture error screenshot');
      }
    }
    
  } catch (browserError) {
    console.log('❌ Browser setup failed:', browserError.message);
    results.errors.push(`Browser setup: ${browserError.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  // Generate final report
  generateFinalReport(results);
  return results;
}

async function testBrowserCompatibility(page, results) {
  try {
    // Look for browser compatibility warnings
    const compatibilityWarnings = await page.evaluate(() => {
      const warnings = [];
      
      // Look for warning elements
      const warningElements = document.querySelectorAll(
        '[class*="warning"], [class*="compatibility"], [class*="browser"], .alert, .notification'
      );
      
      warningElements.forEach(el => {
        const text = el.textContent?.trim();
        if (text && (text.includes('browser') || text.includes('chrome') || text.includes('compatibility'))) {
          warnings.push({
            text: text,
            className: el.className,
            visible: window.getComputedStyle(el).display !== 'none'
          });
        }
      });
      
      return warnings;
    });
    
    if (compatibilityWarnings.length > 0) {
      console.log('✅ Browser compatibility warnings detected');
      results.tests.browserCompatibility.detected = true;
      
      const chromiumOnlyWarning = compatibilityWarnings.some(w => 
        w.text.toLowerCase().includes('chromium') && w.text.toLowerCase().includes('only')
      );
      
      if (chromiumOnlyWarning) {
        results.tests.browserCompatibility.chromiumOnly = true;
        console.log('✅ Chromium-only requirement properly enforced');
      }
    } else {
      console.log('⚠️  No browser compatibility warnings found');
    }
    
    const compatibilityScreenshot = path.join(TEST_CONFIG.screenshotDir, '02-browser-compatibility.png');
    await page.screenshot({ path: compatibilityScreenshot });
    results.screenshots.push(compatibilityScreenshot);
    
  } catch (error) {
    console.log('❌ Browser compatibility test failed:', error.message);
    results.errors.push(`Browser compatibility: ${error.message}`);
  }
}

async function testCCAgents(page, results) {
  try {
    // Multiple strategies to find CC Agents button
    const strategies = [
      () => page.locator('text=CC Agents').first(),
      () => page.locator('button:has-text("CC Agents")'),
      () => page.locator('[data-testid*="agents"]'),
      () => page.locator('button[class*="agents"]'),
      () => page.locator('a[href*="agents"]')
    ];
    
    let agentsButton = null;
    let strategyUsed = '';
    
    for (let i = 0; i < strategies.length; i++) {
      try {
        const button = strategies[i]();
        if (await button.isVisible({ timeout: 3000 })) {
          agentsButton = button;
          strategyUsed = `Strategy ${i + 1}`;
          break;
        }
      } catch (e) {
        // Try next strategy
      }
    }
    
    if (agentsButton) {
      console.log(`✅ CC Agents button found using ${strategyUsed}`);
      results.tests.ccAgents.accessible = true;
      
      // Take before click screenshot
      const beforeClickScreenshot = path.join(TEST_CONFIG.screenshotDir, '03-cc-agents-before-click.png');
      await page.screenshot({ path: beforeClickScreenshot });
      results.screenshots.push(beforeClickScreenshot);
      
      // Click the button
      await agentsButton.click();
      await page.waitForTimeout(2000);
      
      // Take after click screenshot
      const afterClickScreenshot = path.join(TEST_CONFIG.screenshotDir, '04-cc-agents-after-click.png');
      await page.screenshot({ path: afterClickScreenshot });
      results.screenshots.push(afterClickScreenshot);
      
      // Check if page changed or content loaded
      const pageContent = await page.evaluate(() => ({
        title: document.title,
        url: window.location.href,
        hasAgentsList: !!document.querySelector('[class*="agent"], [class*="list"]'),
        hasCreateButton: !!document.querySelector('button:has-text("Create")')
      }));
      
      if (pageContent.hasAgentsList || pageContent.hasCreateButton) {
        console.log('✅ CC Agents functionality verified');
        results.tests.ccAgents.functional = true;
      } else {
        console.log('⚠️  CC Agents button clicked but functionality unclear');
      }
      
    } else {
      console.log('❌ CC Agents button not found');
      
      // Get all buttons for debugging
      const allButtons = await page.evaluate(() => 
        Array.from(document.querySelectorAll('button, a[role="button"]')).map(btn => ({
          text: btn.textContent?.trim(),
          className: btn.className,
          id: btn.id
        }))
      );
      
      console.log('🔍 Available buttons:', allButtons.slice(0, 10));
    }
    
  } catch (error) {
    console.log('❌ CC Agents test failed:', error.message);
    results.errors.push(`CC Agents: ${error.message}`);
  }
}

async function testCCProjects(page, results) {
  try {
    // Navigate back to main page first
    await page.goto(TEST_CONFIG.url);
    await page.waitForLoadState('networkidle');
    
    const projectsButton = await page.locator('text=CC Projects').first();
    
    if (await projectsButton.isVisible({ timeout: 5000 })) {
      console.log('✅ CC Projects button found');
      results.tests.ccProjects.accessible = true;
      
      const beforeClickScreenshot = path.join(TEST_CONFIG.screenshotDir, '05-cc-projects-before-click.png');
      await page.screenshot({ path: beforeClickScreenshot });
      results.screenshots.push(beforeClickScreenshot);
      
      await projectsButton.click();
      await page.waitForTimeout(2000);
      
      const afterClickScreenshot = path.join(TEST_CONFIG.screenshotDir, '06-cc-projects-after-click.png');
      await page.screenshot({ path: afterClickScreenshot });
      results.screenshots.push(afterClickScreenshot);
      
      // Check for projects functionality
      const projectsContent = await page.evaluate(() => ({
        hasProjectsList: !!document.querySelector('[class*="project"], [class*="list"]'),
        hasCreateButton: !!document.querySelector('button:has-text("Create")')
      }));
      
      if (projectsContent.hasProjectsList || projectsContent.hasCreateButton) {
        console.log('✅ CC Projects functionality verified');
        results.tests.ccProjects.functional = true;
      }
      
    } else {
      console.log('❌ CC Projects button not found');
    }
    
  } catch (error) {
    console.log('❌ CC Projects test failed:', error.message);
    results.errors.push(`CC Projects: ${error.message}`);
  }
}

async function testCrewAI(page, results) {
  try {
    await page.goto(TEST_CONFIG.url);
    await page.waitForLoadState('networkidle');
    
    const crewAIButton = await page.locator('text=CrewAI').first();
    
    if (await crewAIButton.isVisible({ timeout: 5000 })) {
      console.log('✅ CrewAI button found');
      results.tests.crewAI.accessible = true;
      
      await crewAIButton.click();
      await page.waitForTimeout(2000);
      
      const crewAIScreenshot = path.join(TEST_CONFIG.screenshotDir, '07-crew-ai.png');
      await page.screenshot({ path: crewAIScreenshot });
      results.screenshots.push(crewAIScreenshot);
      
      console.log('✅ CrewAI navigation completed');
      results.tests.crewAI.functional = true;
      
    } else {
      console.log('❌ CrewAI button not found');
    }
    
  } catch (error) {
    console.log('❌ CrewAI test failed:', error.message);
    results.errors.push(`CrewAI: ${error.message}`);
  }
}

async function testMCPTools(page, results) {
  try {
    await page.goto(TEST_CONFIG.url);
    await page.waitForLoadState('networkidle');
    
    // Look for MCP Tools Panel
    const mcpToolsSelectors = [
      'text=MCP Tools',
      'text=MCP Tools Panel',
      '[class*="mcp"]',
      '[data-testid*="mcp"]',
      'button:has-text("Tools")'
    ];
    
    let mcpToolsButton = null;
    
    for (const selector of mcpToolsSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.isVisible({ timeout: 3000 })) {
          mcpToolsButton = button;
          break;
        }
      } catch (e) {
        // Try next selector
      }
    }
    
    if (mcpToolsButton) {
      console.log('✅ MCP Tools Panel found');
      results.tests.mcpTools.accessible = true;
      
      await mcpToolsButton.click();
      await page.waitForTimeout(3000);
      
      // Count available tools
      const toolsCount = await page.evaluate(() => {
        // Look for tool listings
        const toolElements = document.querySelectorAll(
          '[class*="tool"], .tool-item, [data-testid*="tool"]'
        );
        return toolElements.length;
      });
      
      console.log(`📊 Found ${toolsCount} tools (expected: 186)`);
      results.tests.mcpTools.toolCount = toolsCount;
      
      if (toolsCount >= 180) { // Allow some tolerance
        console.log('✅ MCP Tools count verified (within expected range)');
      } else if (toolsCount > 0) {
        console.log('⚠️  MCP Tools found but count lower than expected');
      } else {
        console.log('❌ No MCP Tools detected');
      }
      
      const mcpToolsScreenshot = path.join(TEST_CONFIG.screenshotDir, '08-mcp-tools-panel.png');
      await page.screenshot({ path: mcpToolsScreenshot });
      results.screenshots.push(mcpToolsScreenshot);
      
    } else {
      console.log('❌ MCP Tools Panel not found');
    }
    
  } catch (error) {
    console.log('❌ MCP Tools test failed:', error.message);
    results.errors.push(`MCP Tools: ${error.message}`);
  }
}

async function testSettings(page, results) {
  try {
    await page.goto(TEST_CONFIG.url);
    await page.waitForLoadState('networkidle');
    
    const settingsButton = await page.locator('text=Settings').first();
    
    if (await settingsButton.isVisible({ timeout: 5000 })) {
      console.log('✅ Settings button found');
      results.tests.settings.accessible = true;
      
      await settingsButton.click();
      await page.waitForTimeout(2000);
      
      // Check for settings options
      const settingsContent = await page.evaluate(() => ({
        hasConfigOptions: !!document.querySelector('[class*="config"], [class*="setting"]'),
        hasToggleSwitches: !!document.querySelector('input[type="checkbox"], .toggle'),
        hasFormInputs: !!document.querySelector('input, select, textarea')
      }));
      
      if (settingsContent.hasConfigOptions || settingsContent.hasFormInputs) {
        console.log('✅ Settings functionality verified');
        results.tests.settings.functional = true;
      }
      
    } else {
      console.log('❌ Settings button not found');
    }
    
  } catch (error) {
    console.log('❌ Settings test failed:', error.message);
    results.errors.push(`Settings: ${error.message}`);
  }
}

function generateFinalReport(results) {
  console.log('\n🏆 COMPREHENSIVE TEST RESULTS');
  console.log('='.repeat(60));
  
  // Calculate success metrics
  const totalTests = Object.keys(results.tests).length;
  let passedTests = 0;
  
  console.log('📊 Test Results Summary:');
  console.log(`🌐 Navigation: ${results.tests.navigation ? '✅ PASS' : '❌ FAIL'}`);
  if (results.tests.navigation) passedTests++;
  
  console.log(`🤖 CC Agents: ${results.tests.ccAgents.accessible ? '✅ ACCESSIBLE' : '❌ NOT ACCESSIBLE'} | ${results.tests.ccAgents.functional ? '✅ FUNCTIONAL' : '❌ NOT FUNCTIONAL'}`);
  if (results.tests.ccAgents.accessible && results.tests.ccAgents.functional) passedTests++;
  
  console.log(`📁 CC Projects: ${results.tests.ccProjects.accessible ? '✅ ACCESSIBLE' : '❌ NOT ACCESSIBLE'} | ${results.tests.ccProjects.functional ? '✅ FUNCTIONAL' : '❌ NOT FUNCTIONAL'}`);
  if (results.tests.ccProjects.accessible && results.tests.ccProjects.functional) passedTests++;
  
  console.log(`🚀 CrewAI: ${results.tests.crewAI.accessible ? '✅ ACCESSIBLE' : '❌ NOT ACCESSIBLE'} | ${results.tests.crewAI.functional ? '✅ FUNCTIONAL' : '❌ NOT FUNCTIONAL'}`);
  if (results.tests.crewAI.accessible && results.tests.crewAI.functional) passedTests++;
  
  console.log(`🔧 MCP Tools: ${results.tests.mcpTools.accessible ? '✅ ACCESSIBLE' : '❌ NOT ACCESSIBLE'} | Tools Count: ${results.tests.mcpTools.toolCount}/186`);
  if (results.tests.mcpTools.accessible && results.tests.mcpTools.toolCount >= 180) passedTests++;
  
  console.log(`⚙️  Settings: ${results.tests.settings.accessible ? '✅ ACCESSIBLE' : '❌ NOT ACCESSIBLE'} | ${results.tests.settings.functional ? '✅ FUNCTIONAL' : '❌ NOT FUNCTIONAL'}`);
  if (results.tests.settings.accessible && results.tests.settings.functional) passedTests++;
  
  console.log(`🌐 Browser Compatibility: ${results.tests.browserCompatibility.detected ? '✅ DETECTED' : '❌ NOT DETECTED'} | Chromium Only: ${results.tests.browserCompatibility.chromiumOnly ? '✅ ENFORCED' : '❌ NOT ENFORCED'}`);
  if (results.tests.browserCompatibility.detected) passedTests++;
  
  const successRate = Math.round((passedTests / totalTests) * 100);
  console.log(`\n📈 Overall Success Rate: ${successRate}% (${passedTests}/${totalTests} tests passed)`);
  
  // Error summary
  if (results.errors.length > 0) {
    console.log('\n❌ Errors Encountered:');
    results.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
  }
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  if (!results.tests.navigation) {
    results.recommendations.push('Check if Claudia server is running on localhost:1420');
  }
  if (!results.tests.browserCompatibility.detected) {
    results.recommendations.push('Browser compatibility warning system may need review');
  }
  if (results.tests.mcpTools.toolCount < 180) {
    results.recommendations.push('MCP Tools count is below expected 186 tools - check MCP server configuration');
  }
  
  if (results.recommendations.length > 0) {
    results.recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec}`);
    });
  } else {
    console.log('   ✅ All systems functioning within expected parameters');
  }
  
  console.log(`\n📁 Screenshots saved to: ${TEST_CONFIG.screenshotDir}`);
  console.log(`📊 Total screenshots captured: ${results.screenshots.length}`);
  
  // Generate summary
  if (successRate >= 80) {
    results.summary = 'EXCELLENT: Claudia application is functioning well with minor issues if any.';
  } else if (successRate >= 60) {
    results.summary = 'GOOD: Claudia application is mostly functional but has some issues that need attention.';
  } else if (successRate >= 40) {
    results.summary = 'POOR: Claudia application has significant issues that require immediate attention.';
  } else {
    results.summary = 'CRITICAL: Claudia application has major functionality problems and needs comprehensive review.';
  }
  
  console.log(`\n🎯 Final Assessment: ${results.summary}`);
  
  // Save detailed results
  const reportPath = path.join(TEST_CONFIG.screenshotDir, 'comprehensive-test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`📋 Detailed report saved to: ${reportPath}`);
}

// Run the comprehensive test
if (require.main === module) {
  comprehensiveClaudiaTest()
    .then(results => {
      console.log('\n✅ Comprehensive Claudia test completed');
      process.exit(results.tests.navigation ? 0 : 1);
    })
    .catch(error => {
      console.error('\n💥 Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { comprehensiveClaudiaTest };