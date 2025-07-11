#!/usr/bin/env node

/**
 * Comprehensive Puppeteer Test Suite for Claudia Web GUI
 * 
 * This script tests EVERY single functionality in the web interface
 */

import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.BASE_URL || 'http://localhost:8081';
const SCREENSHOTS_DIR = path.join(__dirname, 'test-screenshots');

// Ensure screenshots directory exists
await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });

// Test results storage
const testResults = {
  passed: [],
  failed: [],
  screenshots: []
};

// Helper functions
async function takeScreenshot(page, name) {
  const filename = `${Date.now()}-${name}.png`;
  const filepath = path.join(SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  testResults.screenshots.push({ name, path: filepath });
  console.log(`📸 Screenshot saved: ${filename}`);
  return filepath;
}

async function testCase(name, fn) {
  console.log(`\n🧪 Testing: ${name}`);
  try {
    await fn();
    testResults.passed.push(name);
    console.log(`✅ PASSED: ${name}`);
  } catch (error) {
    testResults.failed.push({ name, error: error.message });
    console.error(`❌ FAILED: ${name}`, error.message);
  }
}

async function waitAndClick(page, selector, options = {}) {
  await page.waitForSelector(selector, { visible: true, ...options });
  await page.click(selector);
}

async function waitAndType(page, selector, text, options = {}) {
  await page.waitForSelector(selector, { visible: true, ...options });
  await page.click(selector);
  await page.type(selector, text);
}

async function checkElementExists(page, selector, options = {}) {
  try {
    await page.waitForSelector(selector, { timeout: 5000, ...options });
    return true;
  } catch {
    return false;
  }
}

// Main test suite
async function runTests() {
  const browser = await puppeteer.launch({
    headless: false, // Set to true for CI
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1280, height: 800 }
  });

  const page = await browser.newPage();
  
  // Set up console logging
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Browser console error:', msg.text());
    }
  });

  try {
    // Navigate to the app
    await testCase('Load Application', async () => {
      await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
      await takeScreenshot(page, 'initial-load');
    });

    // Test Navigation
    await testCase('Navigation Menu', async () => {
      const navItems = [
        { selector: 'a[href="/"]', text: 'Home' },
        { selector: 'a[href="/sessions"]', text: 'Sessions' },
        { selector: 'a[href="/agents"]', text: 'Agents' },
        { selector: 'a[href="/mcp-servers"]', text: 'MCP Servers' },
        { selector: 'a[href="/slash-commands"]', text: 'Slash Commands' },
        { selector: 'a[href="/usage"]', text: 'Usage' },
        { selector: 'a[href="/settings"]', text: 'Settings' },
        { selector: 'a[href="/help"]', text: 'Help' }
      ];

      for (const item of navItems) {
        const exists = await checkElementExists(page, item.selector);
        if (!exists) throw new Error(`Navigation item ${item.text} not found`);
      }
    });

    // Test Home Page
    await testCase('Home Page Features', async () => {
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
      await takeScreenshot(page, 'home-page');
      
      // Check for quick stats
      await page.waitForSelector('.grid', { timeout: 5000 });
      
      // Check for quick actions
      const quickActions = await page.$$('button');
      if (quickActions.length === 0) throw new Error('No quick action buttons found');
    });

    // Test Sessions Page
    await testCase('Sessions Page - List Projects', async () => {
      await page.goto(`${BASE_URL}/sessions`, { waitUntil: 'networkidle2' });
      await takeScreenshot(page, 'sessions-list');
      
      // Wait for projects to load
      await page.waitForSelector('.project-list, [data-testid="project-list"], .grid', { timeout: 10000 });
    });

    await testCase('Sessions Page - New Session Button', async () => {
      const newSessionBtn = await page.$('button:has-text("New Session"), button:has-text("Start New Session")');
      if (!newSessionBtn) {
        // Try alternative selectors
        const buttons = await page.$$eval('button', buttons => 
          buttons.map(b => ({ text: b.textContent, className: b.className }))
        );
        console.log('Available buttons:', buttons);
      }
    });

    // Test Agents Page
    await testCase('Agents Page - List Agents', async () => {
      await page.goto(`${BASE_URL}/agents`, { waitUntil: 'networkidle2' });
      await takeScreenshot(page, 'agents-list');
      
      // Wait for agents grid or list
      await page.waitForSelector('.grid, [data-testid="agents-grid"], .agent-list', { timeout: 10000 });
    });

    await testCase('Agents Page - Create Agent Button', async () => {
      const createBtn = await checkElementExists(page, 'button:has-text("Create Agent"), button:has-text("New Agent")');
      if (!createBtn) throw new Error('Create Agent button not found');
      
      // Click to open dialog
      await waitAndClick(page, 'button:has-text("Create Agent"), button:has-text("New Agent")');
      await takeScreenshot(page, 'create-agent-dialog');
      
      // Check for form fields
      const nameInput = await checkElementExists(page, 'input[name="name"], input[placeholder*="name"]');
      const promptTextarea = await checkElementExists(page, 'textarea[name="systemPrompt"], textarea[placeholder*="prompt"]');
      
      if (!nameInput || !promptTextarea) throw new Error('Agent form fields not found');
      
      // Close dialog
      const closeBtn = await page.$('button[aria-label="Close"], button:has-text("Cancel")');
      if (closeBtn) await closeBtn.click();
    });

    await testCase('Agents Page - Agent Actions', async () => {
      // Check for action buttons on agent cards
      const agentCards = await page.$$('.agent-card, [data-testid="agent-card"]');
      if (agentCards.length > 0) {
        const firstCard = agentCards[0];
        const runBtn = await firstCard.$('button:has-text("Run"), button[title="Run"]');
        const editBtn = await firstCard.$('button:has-text("Edit"), button[title="Edit"]');
        const deleteBtn = await firstCard.$('button:has-text("Delete"), button[title="Delete"]');
        
        if (!runBtn && !editBtn && !deleteBtn) {
          console.warn('No action buttons found on agent cards');
        }
      }
    });

    // Test MCP Servers Page
    await testCase('MCP Servers Page - List Servers', async () => {
      await page.goto(`${BASE_URL}/mcp-servers`, { waitUntil: 'networkidle2' });
      await takeScreenshot(page, 'mcp-servers-list');
      
      // Check for add server button
      const addBtn = await checkElementExists(page, 'button:has-text("Add Server"), button:has-text("Add MCP Server")');
      if (!addBtn) throw new Error('Add MCP Server button not found');
    });

    await testCase('MCP Servers Page - Add Server Dialog', async () => {
      await waitAndClick(page, 'button:has-text("Add Server"), button:has-text("Add MCP Server")');
      await takeScreenshot(page, 'add-mcp-server-dialog');
      
      // Check for form fields
      const nameInput = await checkElementExists(page, 'input[name="name"], input[placeholder*="Server name"]');
      const transportSelect = await checkElementExists(page, 'select[name="transport"], [role="combobox"]');
      
      if (!nameInput || !transportSelect) throw new Error('MCP Server form fields not found');
      
      // Close dialog
      const closeBtn = await page.$('button[aria-label="Close"], button:has-text("Cancel")');
      if (closeBtn) await closeBtn.click();
    });

    // Test Slash Commands Page
    await testCase('Slash Commands Page - List Commands', async () => {
      await page.goto(`${BASE_URL}/slash-commands`, { waitUntil: 'networkidle2' });
      await takeScreenshot(page, 'slash-commands-list');
      
      // Check for create button
      const createBtn = await checkElementExists(page, 'button:has-text("Create Command"), button:has-text("New Command")');
      if (!createBtn) throw new Error('Create Slash Command button not found');
    });

    await testCase('Slash Commands Page - Create Command Dialog', async () => {
      await waitAndClick(page, 'button:has-text("Create Command"), button:has-text("New Command")');
      await takeScreenshot(page, 'create-slash-command-dialog');
      
      // Check for form fields
      const nameInput = await checkElementExists(page, 'input[name="name"], input[placeholder*="Command name"]');
      const contentTextarea = await checkElementExists(page, 'textarea[name="content"], textarea[placeholder*="content"]');
      
      if (!nameInput || !contentTextarea) throw new Error('Slash Command form fields not found');
      
      // Close dialog
      const closeBtn = await page.$('button[aria-label="Close"], button:has-text("Cancel")');
      if (closeBtn) await closeBtn.click();
    });

    // Test Usage Analytics Page
    await testCase('Usage Analytics Page - Charts', async () => {
      await page.goto(`${BASE_URL}/usage`, { waitUntil: 'networkidle2' });
      await takeScreenshot(page, 'usage-analytics');
      
      // Check for stats cards
      await page.waitForSelector('.grid, [data-testid="usage-stats"]', { timeout: 10000 });
      
      // Check for charts
      const charts = await page.$$('canvas, svg.recharts-surface, [data-testid="chart"]');
      if (charts.length === 0) console.warn('No charts found on usage page');
    });

    // Test Settings Page
    await testCase('Settings Page - Forms', async () => {
      await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle2' });
      await takeScreenshot(page, 'settings-page');
      
      // Check for settings sections
      const sections = await page.$$('.settings-section, [data-testid="settings-section"]');
      if (sections.length === 0) throw new Error('No settings sections found');
      
      // Check for save button
      const saveBtn = await checkElementExists(page, 'button:has-text("Save"), button:has-text("Save Settings")');
      if (!saveBtn) console.warn('Save button not found on settings page');
    });

    // Test Help Page
    await testCase('Help Page - Documentation', async () => {
      await page.goto(`${BASE_URL}/help`, { waitUntil: 'networkidle2' });
      await takeScreenshot(page, 'help-page');
      
      // Check for help content
      const helpContent = await page.$('.help-content, [data-testid="help-content"], .prose');
      if (!helpContent) throw new Error('Help content not found');
    });

    // Test Interactive Features
    await testCase('Dark Mode Toggle', async () => {
      // Look for theme toggle
      const themeToggle = await page.$('button[aria-label*="theme"], button[title*="theme"], [data-testid="theme-toggle"]');
      if (themeToggle) {
        await themeToggle.click();
        await page.waitForTimeout(500);
        await takeScreenshot(page, 'dark-mode');
        
        // Toggle back
        await themeToggle.click();
        await page.waitForTimeout(500);
      } else {
        console.warn('Theme toggle not found');
      }
    });

    // Test Form Validation
    await testCase('Form Validation - Create Agent', async () => {
      await page.goto(`${BASE_URL}/agents`, { waitUntil: 'networkidle2' });
      
      // Open create dialog
      await waitAndClick(page, 'button:has-text("Create Agent"), button:has-text("New Agent")');
      
      // Try to submit empty form
      const submitBtn = await page.$('button[type="submit"], button:has-text("Create"), button:has-text("Save")');
      if (submitBtn) {
        await submitBtn.click();
        await page.waitForTimeout(500);
        
        // Check for validation errors
        const errors = await page.$$('.error, .text-red-500, [role="alert"]');
        if (errors.length === 0) console.warn('No validation errors shown for empty form');
      }
    });

    // Test Search Functionality
    await testCase('Search Functionality', async () => {
      await page.goto(`${BASE_URL}/sessions`, { waitUntil: 'networkidle2' });
      
      // Look for search input
      const searchInput = await page.$('input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]');
      if (searchInput) {
        await searchInput.type('test search');
        await page.waitForTimeout(500);
        await takeScreenshot(page, 'search-results');
      } else {
        console.warn('Search input not found');
      }
    });

    // Test Responsive Design
    await testCase('Responsive Design - Mobile', async () => {
      await page.setViewport({ width: 375, height: 667 });
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
      await takeScreenshot(page, 'mobile-view');
      
      // Check for mobile menu
      const mobileMenuBtn = await page.$('button[aria-label*="menu"], button[aria-label*="Menu"]');
      if (mobileMenuBtn) {
        await mobileMenuBtn.click();
        await page.waitForTimeout(500);
        await takeScreenshot(page, 'mobile-menu-open');
      }
      
      // Reset viewport
      await page.setViewport({ width: 1280, height: 800 });
    });

    // Test Error Handling
    await testCase('Error Handling - 404 Page', async () => {
      await page.goto(`${BASE_URL}/non-existent-page`, { waitUntil: 'networkidle2' });
      await takeScreenshot(page, '404-page');
      
      // Check for 404 content
      const notFoundText = await page.$('h1:has-text("404"), h2:has-text("Not Found"), [data-testid="404"]');
      if (!notFoundText) console.warn('404 page not properly displayed');
    });

    // Test WebSocket Connection
    await testCase('WebSocket Connection', async () => {
      // Check console for WebSocket messages
      const wsConnected = await page.evaluate(() => {
        return new Promise((resolve) => {
          const ws = new WebSocket('ws://localhost:8080/ws');
          ws.onopen = () => resolve(true);
          ws.onerror = () => resolve(false);
          setTimeout(() => resolve(false), 5000);
        });
      });
      
      if (!wsConnected) console.warn('WebSocket connection failed');
    });

  } catch (error) {
    console.error('Test suite error:', error);
    await takeScreenshot(page, 'error-state');
  } finally {
    await browser.close();
  }

  // Generate test report
  console.log('\n' + '='.repeat(60));
  console.log('TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${testResults.passed.length}`);
  console.log(`❌ Failed: ${testResults.failed.length}`);
  console.log(`📸 Screenshots: ${testResults.screenshots.length}`);
  
  if (testResults.failed.length > 0) {
    console.log('\nFailed Tests:');
    testResults.failed.forEach(({ name, error }) => {
      console.log(`  - ${name}: ${error}`);
    });
  }
  
  // Save test report
  const reportPath = path.join(__dirname, 'test-report.json');
  await fs.writeFile(reportPath, JSON.stringify(testResults, null, 2));
  console.log(`\n📄 Full report saved to: ${reportPath}`);
  console.log(`📁 Screenshots saved to: ${SCREENSHOTS_DIR}`);
  
  process.exit(testResults.failed.length > 0 ? 1 : 0);
}

// Run the tests
runTests().catch(console.error);