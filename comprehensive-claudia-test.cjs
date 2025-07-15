const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function comprehensiveClaudiaTest() {
  console.log('🚀 Starting Comprehensive Claudia Application Test');
  
  // Ensure screenshots directory exists
  const screenshotDir = path.join(__dirname, 'test-screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 1000 // Slow down for visibility
  });
  
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  });
  
  const page = await context.newPage();
  
  const testResults = {
    initialLoad: { status: 'pending', details: '', screenshot: '' },
    ccAgents: { status: 'pending', details: '', screenshot: '' },
    ccProjects: { status: 'pending', details: '', screenshot: '' },
    crewAI: { status: 'pending', details: '', screenshot: '' },
    mcpTools: { status: 'pending', details: '', screenshot: '' },
    detailedFeatures: { status: 'pending', details: '', screenshot: '' },
    navigationFlow: { status: 'pending', details: '', screenshot: '' },
    errors: [],
    summary: ''
  };

  try {
    // ===========================================
    // 1. INITIAL LOAD TEST
    // ===========================================
    console.log('\n📱 Step 1: Initial Load Test');
    
    console.log('Navigating to http://localhost:1420...');
    await page.goto('http://localhost:1420', { waitUntil: 'networkidle' });
    
    // Wait for page to fully load
    await page.waitForTimeout(3000);
    
    // Check page title
    const title = await page.title();
    console.log(`Page title: ${title}`);
    
    // Take initial screenshot
    const initialScreenshot = path.join(screenshotDir, '01-initial-load.png');
    await page.screenshot({ path: initialScreenshot, fullPage: true });
    console.log(`Screenshot saved: ${initialScreenshot}`);
    
    // Check for browser compatibility warning
    const compatibilityWarning = await page.locator('[data-testid="browser-warning"]').count();
    const hasWarning = compatibilityWarning > 0;
    
    testResults.initialLoad = {
      status: 'success',
      details: `Page loaded successfully. Title: "${title}". Browser compatibility warning: ${hasWarning ? 'SHOWN (❌ Unexpected in Chromium)' : 'NOT SHOWN (✅ Expected)'}`,
      screenshot: initialScreenshot
    };
    
    console.log('✅ Initial load test completed');

    // ===========================================
    // 2. CC AGENTS BUTTON TEST
    // ===========================================
    console.log('\n🤖 Step 2: CC Agents Button Test');
    
    // Find and click CC Agents button
    const ccAgentsButton = page.locator('button:has-text("CC Agents"), a:has-text("CC Agents"), [data-testid="cc-agents"]').first();
    const ccAgentsExists = await ccAgentsButton.count() > 0;
    
    if (ccAgentsExists) {
      console.log('Found CC Agents button, clicking...');
      await ccAgentsButton.click();
      await page.waitForTimeout(2000);
      
      // Take screenshot after click
      const ccAgentsScreenshot = path.join(screenshotDir, '02-cc-agents-page.png');
      await page.screenshot({ path: ccAgentsScreenshot, fullPage: true });
      
      // Check page content
      const pageContent = await page.textContent('body');
      const currentUrl = page.url();
      
      // Look for specific CC Agents elements
      const createAgentButton = await page.locator('button:has-text("Create"), button:has-text("Add"), [data-testid="create-agent"]').count();
      const agentsList = await page.locator('[data-testid="agents-list"], .agents-container').count();
      const errorMessage = await page.locator(':has-text("Failed"), :has-text("Error"), .error').count();
      
      testResults.ccAgents = {
        status: 'success',
        details: `CC Agents page loaded. URL: ${currentUrl}. Create button found: ${createAgentButton > 0}. Agents list: ${agentsList > 0}. Error messages: ${errorMessage > 0}`,
        screenshot: ccAgentsScreenshot
      };
      
      console.log('✅ CC Agents test completed');
      
      // Navigate back to main page
      await page.goBack();
      await page.waitForTimeout(1000);
    } else {
      testResults.ccAgents = {
        status: 'failed',
        details: 'CC Agents button not found on main page',
        screenshot: ''
      };
      console.log('❌ CC Agents button not found');
    }

    // ===========================================
    // 3. CC PROJECTS BUTTON TEST
    // ===========================================
    console.log('\n📁 Step 3: CC Projects Button Test');
    
    const ccProjectsButton = page.locator('button:has-text("CC Projects"), a:has-text("CC Projects"), [data-testid="cc-projects"]').first();
    const ccProjectsExists = await ccProjectsButton.count() > 0;
    
    if (ccProjectsExists) {
      console.log('Found CC Projects button, clicking...');
      await ccProjectsButton.click();
      await page.waitForTimeout(2000);
      
      // Take screenshot after click
      const ccProjectsScreenshot = path.join(screenshotDir, '03-cc-projects-page.png');
      await page.screenshot({ path: ccProjectsScreenshot, fullPage: true });
      
      // Check page content
      const currentUrl = page.url();
      const createProjectButton = await page.locator('button:has-text("Create"), button:has-text("Add"), button:has-text("New")').count();
      const projectsList = await page.locator('[data-testid="projects-list"], .projects-container').count();
      const errorMessage = await page.locator(':has-text("Failed"), :has-text("Error"), .error').count();
      
      testResults.ccProjects = {
        status: 'success',
        details: `CC Projects page loaded. URL: ${currentUrl}. Create button found: ${createProjectButton > 0}. Projects list: ${projectsList > 0}. Error messages: ${errorMessage > 0}`,
        screenshot: ccProjectsScreenshot
      };
      
      console.log('✅ CC Projects test completed');
      
      // Navigate back to main page
      await page.goBack();
      await page.waitForTimeout(1000);
    } else {
      testResults.ccProjects = {
        status: 'failed',
        details: 'CC Projects button not found on main page',
        screenshot: ''
      };
      console.log('❌ CC Projects button not found');
    }

    // ===========================================
    // 4. CREWAI BUTTON TEST
    // ===========================================
    console.log('\n🚢 Step 4: CrewAI Button Test');
    
    const crewAIButton = page.locator('button:has-text("CrewAI"), a:has-text("CrewAI"), [data-testid="crewai"]').first();
    const crewAIExists = await crewAIButton.count() > 0;
    
    if (crewAIExists) {
      console.log('Found CrewAI button, clicking...');
      await crewAIButton.click();
      await page.waitForTimeout(2000);
      
      // Take screenshot after click
      const crewAIScreenshot = path.join(screenshotDir, '04-crewai-page.png');
      await page.screenshot({ path: crewAIScreenshot, fullPage: true });
      
      // Check page content and functionality
      const currentUrl = page.url();
      const connectionStatus = await page.locator('[data-testid="connection-status"], .status-indicator').count();
      const agentList = await page.locator('[data-testid="agent-list"], .agents').count();
      const executeButton = await page.locator('button:has-text("Execute"), button:has-text("Run")').count();
      
      testResults.crewAI = {
        status: 'success',
        details: `CrewAI page loaded. URL: ${currentUrl}. Connection status indicator: ${connectionStatus > 0}. Agent list: ${agentList > 0}. Execute buttons: ${executeButton > 0}`,
        screenshot: crewAIScreenshot
      };
      
      console.log('✅ CrewAI test completed');
      
      // Navigate back to main page
      await page.goBack();
      await page.waitForTimeout(1000);
    } else {
      testResults.crewAI = {
        status: 'failed',
        details: 'CrewAI button not found on main page',
        screenshot: ''
      };
      console.log('❌ CrewAI button not found');
    }

    // ===========================================
    // 5. MCP TOOLS PANEL TEST
    // ===========================================
    console.log('\n🛠️ Step 5: MCP Tools Panel Test');
    
    // Test Playwright MCP button
    const playwrightMCPButton = page.locator('button:has-text("Test Playwright MCP"), button:has-text("Playwright")').first();
    const playwrightExists = await playwrightMCPButton.count() > 0;
    
    // Test Desktop Commander button
    const desktopCommanderButton = page.locator('button:has-text("Test Desktop Commander"), button:has-text("Desktop Commander")').first();
    const desktopExists = await desktopCommanderButton.count() > 0;
    
    // Test Brave Search button
    const braveSearchButton = page.locator('button:has-text("Test Brave Search"), button:has-text("Brave Search")').first();
    const braveExists = await braveSearchButton.count() > 0;
    
    // Check for any connection status indicators
    const statusIndicators = await page.locator('.connection-status, .status-indicator, [data-testid*="status"]').count();
    
    // Take screenshot of MCP tools panel
    const mcpToolsScreenshot = path.join(screenshotDir, '05-mcp-tools-panel.png');
    await page.screenshot({ path: mcpToolsScreenshot, fullPage: true });
    
    testResults.mcpTools = {
      status: playwrightExists || desktopExists || braveExists ? 'partial' : 'failed',
      details: `MCP Tools found - Playwright MCP: ${playwrightExists}, Desktop Commander: ${desktopExists}, Brave Search: ${braveExists}. Status indicators: ${statusIndicators}`,
      screenshot: mcpToolsScreenshot
    };
    
    console.log('✅ MCP Tools panel test completed');

    // ===========================================
    // 6. DETAILED FEATURE TESTING
    // ===========================================
    console.log('\n🔍 Step 6: Detailed Feature Testing');
    
    let detailedTestResults = [];
    
    // Test Create CC Agent if available
    if (testResults.ccAgents.status === 'success') {
      await page.goto('http://localhost:1420');
      const ccAgentsButton = page.locator('button:has-text("CC Agents"), a:has-text("CC Agents")').first();
      await ccAgentsButton.click();
      await page.waitForTimeout(1000);
      
      const createButton = page.locator('button:has-text("Create"), button:has-text("Add Agent")').first();
      const createExists = await createButton.count() > 0;
      
      if (createExists) {
        try {
          await createButton.click();
          await page.waitForTimeout(1000);
          detailedTestResults.push('✅ Create CC Agent button clickable');
        } catch (error) {
          detailedTestResults.push(`❌ Create CC Agent button error: ${error.message}`);
        }
      } else {
        detailedTestResults.push('ℹ️ Create CC Agent button not found');
      }
      
      await page.goBack();
    }
    
    const detailedScreenshot = path.join(screenshotDir, '06-detailed-features.png');
    await page.screenshot({ path: detailedScreenshot, fullPage: true });
    
    testResults.detailedFeatures = {
      status: 'completed',
      details: detailedTestResults.join('; '),
      screenshot: detailedScreenshot
    };
    
    console.log('✅ Detailed feature testing completed');

    // ===========================================
    // 7. NAVIGATION FLOW VERIFICATION
    // ===========================================
    console.log('\n🧭 Step 7: Navigation Flow Verification');
    
    await page.goto('http://localhost:1420');
    await page.waitForTimeout(1000);
    
    // Test breadcrumb navigation if present
    const breadcrumbs = await page.locator('.breadcrumb, [data-testid="breadcrumb"]').count();
    
    // Test back button functionality
    let backButtonWorks = false;
    try {
      const ccAgentsButton = page.locator('button:has-text("CC Agents"), a:has-text("CC Agents")').first();
      if (await ccAgentsButton.count() > 0) {
        await ccAgentsButton.click();
        await page.waitForTimeout(1000);
        await page.goBack();
        await page.waitForTimeout(1000);
        const mainPageReturn = await page.locator('button:has-text("CC Agents")').count() > 0;
        backButtonWorks = mainPageReturn;
      }
    } catch (error) {
      console.log(`Back button test error: ${error.message}`);
    }
    
    const navigationScreenshot = path.join(screenshotDir, '07-navigation-flow.png');
    await page.screenshot({ path: navigationScreenshot, fullPage: true });
    
    testResults.navigationFlow = {
      status: 'completed',
      details: `Breadcrumbs found: ${breadcrumbs > 0}. Back button works: ${backButtonWorks}`,
      screenshot: navigationScreenshot
    };
    
    console.log('✅ Navigation flow verification completed');

  } catch (error) {
    console.error('❌ Test execution error:', error);
    testResults.errors.push(`Global error: ${error.message}`);
  } finally {
    await browser.close();
  }

  // ===========================================
  // GENERATE COMPREHENSIVE REPORT
  // ===========================================
  console.log('\n📋 Generating Comprehensive Test Report...');
  
  const report = {
    testExecutionTime: new Date().toISOString(),
    browser: 'Chromium',
    testUrl: 'http://localhost:1420',
    results: testResults,
    summary: generateSummary(testResults)
  };

  // Save detailed report
  const reportPath = path.join(__dirname, 'claudia-comprehensive-test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log('\n🎯 COMPREHENSIVE TEST REPORT SUMMARY:');
  console.log('==========================================');
  console.log(report.summary);
  console.log('==========================================');
  console.log(`📁 Full report saved to: ${reportPath}`);
  console.log(`📸 Screenshots saved to: ${screenshotDir}`);
  
  return report;
}

function generateSummary(testResults) {
  const tests = [
    { name: 'Initial Load', result: testResults.initialLoad },
    { name: 'CC Agents', result: testResults.ccAgents },
    { name: 'CC Projects', result: testResults.ccProjects },
    { name: 'CrewAI', result: testResults.crewAI },
    { name: 'MCP Tools', result: testResults.mcpTools },
    { name: 'Detailed Features', result: testResults.detailedFeatures },
    { name: 'Navigation Flow', result: testResults.navigationFlow }
  ];

  const successful = tests.filter(t => t.result.status === 'success').length;
  const failed = tests.filter(t => t.result.status === 'failed').length;
  const partial = tests.filter(t => t.result.status === 'partial').length;
  const total = tests.length;

  let summary = `
✅ SUCCESSFUL TESTS: ${successful}/${total}
❌ FAILED TESTS: ${failed}/${total}
⚠️  PARTIAL TESTS: ${partial}/${total}

DETAILED RESULTS:
`;

  tests.forEach(test => {
    const status = test.result.status === 'success' ? '✅' : 
                   test.result.status === 'failed' ? '❌' : 
                   test.result.status === 'partial' ? '⚠️' : '🔄';
    summary += `${status} ${test.name}: ${test.result.details}\n`;
  });

  if (testResults.errors.length > 0) {
    summary += `\n🚨 ERRORS ENCOUNTERED:\n`;
    testResults.errors.forEach(error => {
      summary += `   - ${error}\n`;
    });
  }

  return summary;
}

// Execute the test
comprehensiveClaudiaTest().catch(console.error);