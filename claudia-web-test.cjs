#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testClaudiaWeb() {
    console.log('🚀 Starting Claudia Web Version Test with Playwright...');
    
    const browser = await chromium.launch({
        headless: false,
        slowMo: 1000,
        args: ['--start-maximized']
    });
    
    const context = await browser.newContext({
        viewport: { width: 1200, height: 800 }
    });
    
    const page = await context.newPage();
    
    try {
        // Create screenshots directory
        const screenshotDir = path.join(__dirname, 'claudia-web-screenshots');
        if (!fs.existsSync(screenshotDir)) {
            fs.mkdirSync(screenshotDir, { recursive: true });
        }
        
        console.log('📱 Step 1: Navigating to Claudia Web Interface...');
        await page.goto('http://localhost:1420');
        await page.waitForLoadState('networkidle');
        
        // Take initial screenshot
        await page.screenshot({ 
            path: path.join(screenshotDir, '01-initial-load.png'),
            fullPage: true
        });
        
        console.log('📷 Step 2: Capturing main interface...');
        
        // Get page title and basic info
        const title = await page.title();
        const url = page.url();
        console.log(`📋 Page Title: ${title}`);
        console.log(`🔗 Current URL: ${url}`);
        
        // Check for connection status indicators
        console.log('🔍 Step 3: Checking connection status indicators...');
        
        const connectionStatus = await page.evaluate(() => {
            // Look for various connection status indicators
            const statusElements = [
                document.querySelector('[data-testid="connection-status"]'),
                document.querySelector('.connection-status'),
                document.querySelector('[class*="status"]'),
                document.querySelector('[class*="connection"]'),
                document.querySelector('[class*="mcp"]'),
                document.querySelector('[class*="gateway"]')
            ].filter(el => el !== null);
            
            return statusElements.map(el => ({
                tagName: el.tagName,
                className: el.className,
                textContent: el.textContent?.trim(),
                innerHTML: el.innerHTML
            }));
        });
        
        console.log('📊 Connection Status Elements Found:', connectionStatus);
        
        // Check for browser compatibility warnings
        console.log('⚠️ Step 4: Checking browser compatibility warnings...');
        
        const browserWarnings = await page.evaluate(() => {
            const warnings = document.querySelectorAll('[class*="warning"], [class*="compatibility"], [class*="browser"]');
            return Array.from(warnings).map(warning => ({
                text: warning.textContent?.trim(),
                className: warning.className,
                visible: window.getComputedStyle(warning).display !== 'none'
            }));
        });
        
        console.log('🚨 Browser Warnings:', browserWarnings);
        
        // Look for main navigation elements
        console.log('🧭 Step 5: Finding navigation elements...');
        
        const navElements = await page.evaluate(() => {
            const elements = [];
            
            // Look for CC Agents button
            const agentsBtn = document.querySelector('button:has-text("CC Agents"), a:has-text("CC Agents"), [data-testid*="agents"], [class*="agents"]');
            if (agentsBtn) {
                elements.push({
                    type: 'CC Agents',
                    tagName: agentsBtn.tagName,
                    text: agentsBtn.textContent?.trim(),
                    className: agentsBtn.className
                });
            }
            
            // Look for CC Projects button
            const projectsBtn = document.querySelector('button:has-text("CC Projects"), a:has-text("CC Projects"), [data-testid*="projects"], [class*="projects"]');
            if (projectsBtn) {
                elements.push({
                    type: 'CC Projects',
                    tagName: projectsBtn.tagName,
                    text: projectsBtn.textContent?.trim(),
                    className: projectsBtn.className
                });
            }
            
            // Get all buttons for reference
            const allButtons = Array.from(document.querySelectorAll('button, a[role="button"]')).map(btn => ({
                text: btn.textContent?.trim(),
                className: btn.className,
                id: btn.id
            }));
            
            return { foundElements: elements, allButtons };
        });
        
        console.log('🎯 Navigation Elements:', navElements);
        
        // Take screenshot of current state
        await page.screenshot({ 
            path: path.join(screenshotDir, '02-main-interface.png'),
            fullPage: true
        });
        
        // Test CC Agents section
        console.log('🤖 Step 6: Testing CC Agents section...');
        
        try {
            // Try multiple selectors for CC Agents
            const agentsSelectors = [
                'button:has-text("CC Agents")',
                'a:has-text("CC Agents")',
                '[data-testid*="agents"]',
                'button[class*="agents"]',
                'text=CC Agents'
            ];
            
            let agentsButtonFound = false;
            for (const selector of agentsSelectors) {
                try {
                    const element = await page.locator(selector).first();
                    if (await element.isVisible({ timeout: 2000 })) {
                        console.log(`✅ Found CC Agents button with selector: ${selector}`);
                        await element.click();
                        agentsButtonFound = true;
                        break;
                    }
                } catch (e) {
                    // Try next selector
                }
            }
            
            if (agentsButtonFound) {
                await page.waitForTimeout(2000);
                await page.screenshot({ 
                    path: path.join(screenshotDir, '03-cc-agents-page.png'),
                    fullPage: true
                });
                
                // Check what's displayed on agents page
                const agentsPageContent = await page.evaluate(() => {
                    return {
                        title: document.title,
                        url: window.location.href,
                        mainContent: document.body.textContent?.substring(0, 500),
                        hasCreateButton: !!document.querySelector('button:has-text("Create"), [class*="create"]'),
                        hasErrorMessage: !!document.querySelector('[class*="error"], [class*="failed"]')
                    };
                });
                
                console.log('📄 CC Agents Page Content:', agentsPageContent);
            } else {
                console.log('❌ CC Agents button not found');
            }
        } catch (error) {
            console.log('❌ Error testing CC Agents:', error.message);
        }
        
        // Go back to main page
        await page.goto('http://localhost:1420');
        await page.waitForLoadState('networkidle');
        
        // Test CC Projects section
        console.log('📁 Step 7: Testing CC Projects section...');
        
        try {
            const projectsSelectors = [
                'button:has-text("CC Projects")',
                'a:has-text("CC Projects")',
                '[data-testid*="projects"]',
                'button[class*="projects"]',
                'text=CC Projects'
            ];
            
            let projectsButtonFound = false;
            for (const selector of projectsSelectors) {
                try {
                    const element = await page.locator(selector).first();
                    if (await element.isVisible({ timeout: 2000 })) {
                        console.log(`✅ Found CC Projects button with selector: ${selector}`);
                        await element.click();
                        projectsButtonFound = true;
                        break;
                    }
                } catch (e) {
                    // Try next selector
                }
            }
            
            if (projectsButtonFound) {
                await page.waitForTimeout(2000);
                await page.screenshot({ 
                    path: path.join(screenshotDir, '04-cc-projects-page.png'),
                    fullPage: true
                });
                
                const projectsPageContent = await page.evaluate(() => {
                    return {
                        title: document.title,
                        url: window.location.href,
                        mainContent: document.body.textContent?.substring(0, 500),
                        hasCreateButton: !!document.querySelector('button:has-text("Create"), [class*="create"]'),
                        hasProjectsList: !!document.querySelector('[class*="project"], [class*="list"]')
                    };
                });
                
                console.log('📄 CC Projects Page Content:', projectsPageContent);
            } else {
                console.log('❌ CC Projects button not found');
            }
        } catch (error) {
            console.log('❌ Error testing CC Projects:', error.message);
        }
        
        // Check for usage data and other information
        console.log('📊 Step 8: Checking for usage data and system information...');
        
        await page.goto('http://localhost:1420');
        await page.waitForLoadState('networkidle');
        
        const systemInfo = await page.evaluate(() => {
            // Look for various data displays
            const dataElements = Array.from(document.querySelectorAll('*')).filter(el => {
                const text = el.textContent?.toLowerCase() || '';
                return text.includes('usage') || 
                       text.includes('gateway') || 
                       text.includes('mcp') || 
                       text.includes('status') || 
                       text.includes('connection') ||
                       text.includes('tools') ||
                       text.includes('servers');
            });
            
            return {
                dataElementsCount: dataElements.length,
                sampleTexts: dataElements.slice(0, 5).map(el => el.textContent?.trim().substring(0, 100)),
                bodyText: document.body.textContent?.substring(0, 1000)
            };
        });
        
        console.log('📈 System Information Found:', systemInfo);
        
        // Take final screenshot
        await page.screenshot({ 
            path: path.join(screenshotDir, '05-final-state.png'),
            fullPage: true
        });
        
        console.log('✅ Test completed successfully!');
        console.log(`📁 Screenshots saved to: ${screenshotDir}`);
        
        return {
            success: true,
            screenshots: screenshotDir,
            connectionStatus,
            browserWarnings,
            navElements,
            systemInfo
        };
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

// Run the test
if (require.main === module) {
    testClaudiaWeb()
        .then(result => {
            console.log('\n🎉 Claudia Web Test Results:');
            console.log(JSON.stringify(result, null, 2));
        })
        .catch(error => {
            console.error('\n💥 Test failed:', error);
            process.exit(1);
        });
}

module.exports = { testClaudiaWeb };