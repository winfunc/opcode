#!/usr/bin/env node

/**
 * Direct Chrome Browser Test with Playwright
 * Testing Chrome compatibility vs Chromium for Playwright MCP
 * 
 * This script tests:
 * 1. Chrome browser launch capability
 * 2. Navigation to localhost:1420
 * 3. Screenshot capture
 * 4. Element interaction (CC Agents button)
 * 5. Chrome vs Chromium compatibility
 */

const { chromium, webkit, firefox } = require('playwright');
const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  url: 'http://localhost:1420',
  screenshotDir: './chrome-test-screenshots',
  timeout: 30000,
  headless: false // Show browser for visual confirmation
};

// Ensure screenshot directory exists
if (!fs.existsSync(TEST_CONFIG.screenshotDir)) {
  fs.mkdirSync(TEST_CONFIG.screenshotDir, { recursive: true });
}

async function testChromeCompatibility() {
  console.log('\n🧪 CHROME PLAYWRIGHT MCP COMPATIBILITY TEST');
  console.log('='.repeat(50));
  
  const results = {
    timestamp: new Date().toISOString(),
    url: TEST_CONFIG.url,
    chrome: { available: false, errors: [] },
    chromium: { available: false, errors: [] },
    tests: {
      navigation: { chrome: false, chromium: false },
      screenshot: { chrome: false, chromium: false },
      elementDetection: { chrome: false, chromium: false },
      interaction: { chrome: false, chromium: false }
    },
    screenshots: [],
    recommendation: ''
  };

  // Test 1: Chrome Browser Launch Test
  console.log('\n1️⃣  Testing Chrome Browser Launch...');
  try {
    const browser = await chromium.launch({
      headless: false,
      channel: 'chrome', // Specifically request Chrome
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    
    console.log('✅ Chrome browser launched successfully');
    results.chrome.available = true;
    
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    
    const page = await context.newPage();
    
    // Test 2: Navigation Test
    console.log('\n2️⃣  Testing Navigation to', TEST_CONFIG.url);
    try {
      const response = await page.goto(TEST_CONFIG.url, { 
        waitUntil: 'networkidle',
        timeout: TEST_CONFIG.timeout 
      });
      
      if (response && response.ok()) {
        console.log('✅ Successfully navigated to', TEST_CONFIG.url);
        console.log('📊 Response Status:', response.status());
        results.tests.navigation.chrome = true;
        
        // Test 3: Screenshot Test
        console.log('\n3️⃣  Testing Screenshot Capture...');
        const screenshotPath = path.join(TEST_CONFIG.screenshotDir, 'chrome-main-page.png');
        await page.screenshot({ 
          path: screenshotPath,
          fullPage: true 
        });
        console.log('✅ Screenshot captured:', screenshotPath);
        results.tests.screenshot.chrome = true;
        results.screenshots.push(screenshotPath);
        
        // Test 4: Element Detection Test
        console.log('\n4️⃣  Testing Element Detection...');
        try {
          // Wait for page to fully load
          await page.waitForLoadState('networkidle');
          
          // Look for CC Agents button or similar UI elements
          const pageTitle = await page.title();
          console.log('📄 Page Title:', pageTitle);
          
          // Try to find CC Agents button
          const ccAgentsButton = await page.locator('text=CC Agents').first();
          const isVisible = await ccAgentsButton.isVisible({ timeout: 5000 }).catch(() => false);
          
          if (isVisible) {
            console.log('✅ CC Agents button detected and visible');
            results.tests.elementDetection.chrome = true;
            
            // Test 5: Interaction Test
            console.log('\n5️⃣  Testing Button Interaction...');
            const screenshotBeforeClick = path.join(TEST_CONFIG.screenshotDir, 'chrome-before-click.png');
            await page.screenshot({ path: screenshotBeforeClick });
            results.screenshots.push(screenshotBeforeClick);
            
            await ccAgentsButton.click();
            await page.waitForTimeout(2000); // Wait for potential navigation
            
            const screenshotAfterClick = path.join(TEST_CONFIG.screenshotDir, 'chrome-after-click.png');
            await page.screenshot({ path: screenshotAfterClick });
            results.screenshots.push(screenshotAfterClick);
            
            console.log('✅ Button interaction completed');
            results.tests.interaction.chrome = true;
            
          } else {
            console.log('⚠️  CC Agents button not found, checking for other elements...');
            
            // Check for any buttons or interactive elements
            const buttons = await page.locator('button').count();
            const links = await page.locator('a').count();
            console.log(`📊 Found ${buttons} buttons and ${links} links on the page`);
            
            if (buttons > 0 || links > 0) {
              results.tests.elementDetection.chrome = true;
              console.log('✅ Interactive elements detected');
            }
          }
          
        } catch (elementError) {
          console.log('❌ Element detection failed:', elementError.message);
          results.chrome.errors.push(`Element detection: ${elementError.message}`);
        }
        
      } else {
        throw new Error(`Navigation failed with status: ${response?.status()}`);
      }
      
    } catch (navError) {
      console.log('❌ Navigation failed:', navError.message);
      results.chrome.errors.push(`Navigation: ${navError.message}`);
    }
    
    await browser.close();
    
  } catch (chromeError) {
    console.log('❌ Chrome browser test failed:', chromeError.message);
    results.chrome.errors.push(`Browser launch: ${chromeError.message}`);
  }

  // Test 6: Chromium Fallback Test
  console.log('\n6️⃣  Testing Chromium Fallback...');
  try {
    const browser = await chromium.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    
    console.log('✅ Chromium browser launched successfully');
    results.chromium.available = true;
    
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    
    const page = await context.newPage();
    
    const response = await page.goto(TEST_CONFIG.url, { 
      waitUntil: 'networkidle',
      timeout: TEST_CONFIG.timeout 
    });
    
    if (response && response.ok()) {
      console.log('✅ Chromium navigation successful');
      results.tests.navigation.chromium = true;
      
      const screenshotPath = path.join(TEST_CONFIG.screenshotDir, 'chromium-comparison.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      results.tests.screenshot.chromium = true;
      results.screenshots.push(screenshotPath);
    }
    
    await browser.close();
    
  } catch (chromiumError) {
    console.log('❌ Chromium test failed:', chromiumError.message);
    results.chromium.errors.push(`Chromium test: ${chromiumError.message}`);
  }

  // Generate Recommendation
  console.log('\n📋 GENERATING COMPATIBILITY REPORT...');
  
  if (results.chrome.available && results.tests.navigation.chrome) {
    if (results.tests.screenshot.chrome && results.tests.elementDetection.chrome) {
      results.recommendation = 'CHROME FULLY COMPATIBLE: Google Chrome works perfectly with Playwright MCP. Users can rely on Chrome without needing Chromium.';
    } else {
      results.recommendation = 'CHROME PARTIALLY COMPATIBLE: Chrome works for basic automation but may have limitations with advanced features. Chromium recommended for full functionality.';
    }
  } else {
    results.recommendation = 'CHROMIUM REQUIRED: Chrome compatibility issues detected. Users should install Chromium for reliable Playwright MCP functionality.';
  }

  // Save results
  const reportPath = path.join(TEST_CONFIG.screenshotDir, 'chrome-compatibility-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

  // Display Final Report
  console.log('\n🏆 FINAL COMPATIBILITY REPORT');
  console.log('='.repeat(50));
  console.log('🌐 Chrome Available:', results.chrome.available ? '✅' : '❌');
  console.log('🔧 Chromium Available:', results.chromium.available ? '✅' : '❌');
  console.log('🚀 Navigation (Chrome):', results.tests.navigation.chrome ? '✅' : '❌');
  console.log('📸 Screenshots (Chrome):', results.tests.screenshot.chrome ? '✅' : '❌');
  console.log('🎯 Element Detection (Chrome):', results.tests.elementDetection.chrome ? '✅' : '❌');
  console.log('🖱️  Interaction (Chrome):', results.tests.interaction.chrome ? '✅' : '❌');
  console.log('\n💡 RECOMMENDATION:');
  console.log(results.recommendation);
  console.log('\n📁 Screenshots saved to:', TEST_CONFIG.screenshotDir);
  console.log('📊 Full report saved to:', reportPath);
  
  return results;
}

// Run the test
testChromeCompatibility()
  .then(results => {
    console.log('\n✅ Chrome compatibility test completed');
    process.exit(results.chrome.available ? 0 : 1);
  })
  .catch(error => {
    console.error('\n❌ Test execution failed:', error);
    process.exit(1);
  });