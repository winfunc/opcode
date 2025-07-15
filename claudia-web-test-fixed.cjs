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
        
        const pageContent = await page.evaluate(() => {
            // Get all text content to analyze
            const bodyText = document.body.textContent || '';
            const allElements = Array.from(document.querySelectorAll('*'));
            
            // Look for status-related elements
            const statusElements = allElements.filter(el => {
                const className = el.className || '';
                const text = el.textContent || '';
                return className.includes('status') || 
                       className.includes('connection') || 
                       className.includes('mcp') || 
                       className.includes('gateway') ||
                       text.toLowerCase().includes('connect') ||
                       text.toLowerCase().includes('status') ||
                       text.toLowerCase().includes('mcp') ||
                       text.toLowerCase().includes('gateway');
            });
            
            // Look for buttons and navigation
            const buttons = Array.from(document.querySelectorAll('button, a[role="button"], [class*="button"]'));
            const buttonInfo = buttons.map(btn => ({
                text: btn.textContent?.trim(),
                className: btn.className,
                id: btn.id,
                tagName: btn.tagName
            }));
            
            // Look for specific text patterns
            const hasAgentsText = bodyText.includes('CC Agents') || bodyText.includes('Agents');
            const hasProjectsText = bodyText.includes('CC Projects') || bodyText.includes('Projects');
            const hasGatewayText = bodyText.includes('Gateway') || bodyText.includes('MCP');
            const hasUsageText = bodyText.includes('Usage') || bodyText.includes('usage');
            
            return {
                bodyTextPreview: bodyText.substring(0, 1000),
                statusElementsCount: statusElements.length,
                statusElementsInfo: statusElements.slice(0, 3).map(el => ({
                    tag: el.tagName,
                    className: el.className,
                    text: el.textContent?.trim().substring(0, 100)
                })),
                buttonsCount: buttons.length,
                buttonInfo: buttonInfo.slice(0, 10),
                textPatterns: {
                    hasAgentsText,
                    hasProjectsText, 
                    hasGatewayText,
                    hasUsageText
                }
            };
        });
        
        console.log('📊 Page Content Analysis:', JSON.stringify(pageContent, null, 2));
        
        // Check for browser compatibility warnings
        console.log('⚠️ Step 4: Checking browser compatibility warnings...');
        
        const browserWarnings = await page.evaluate(() => {
            const allElements = Array.from(document.querySelectorAll('*'));
            const warningElements = allElements.filter(el => {
                const className = el.className || '';
                const text = el.textContent || '';
                return className.includes('warning') || 
                       className.includes('compatibility') || 
                       className.includes('browser') ||
                       text.toLowerCase().includes('warning') ||
                       text.toLowerCase().includes('compatibility') ||
                       text.toLowerCase().includes('browser');
            });
            
            return {
                warningCount: warningElements.length,
                warnings: warningElements.map(el => ({
                    text: el.textContent?.trim(),
                    className: el.className,
                    visible: window.getComputedStyle(el).display !== 'none'
                }))
            };
        });
        
        console.log('🚨 Browser Warnings Analysis:', browserWarnings);
        
        // Take screenshot of current state
        await page.screenshot({ 
            path: path.join(screenshotDir, '02-main-interface.png'),
            fullPage: true
        });
        
        // Try to find and click CC Agents
        console.log('🤖 Step 5: Testing CC Agents section...');
        
        try {
            // Look for CC Agents text and try to click it
            const agentsElement = await page.locator('text=CC Agents').first();
            if (await agentsElement.isVisible({ timeout: 5000 })) {
                console.log('✅ Found CC Agents text');
                await agentsElement.click();
                await page.waitForTimeout(2000);
                
                await page.screenshot({ 
                    path: path.join(screenshotDir, '03-cc-agents-clicked.png'),
                    fullPage: true
                });
                
                const agentsPageInfo = await page.evaluate(() => ({
                    title: document.title,
                    url: window.location.href,
                    bodyText: document.body.textContent?.substring(0, 500)
                }));
                
                console.log('📄 After clicking CC Agents:', agentsPageInfo);
            } else {
                console.log('❌ CC Agents text not found or not visible');
            }
        } catch (error) {
            console.log('❌ Error with CC Agents:', error.message);
        }
        
        // Go back to main page and try CC Projects
        await page.goto('http://localhost:1420');
        await page.waitForLoadState('networkidle');
        
        console.log('📁 Step 6: Testing CC Projects section...');
        
        try {
            const projectsElement = await page.locator('text=CC Projects').first();
            if (await projectsElement.isVisible({ timeout: 5000 })) {
                console.log('✅ Found CC Projects text');
                await projectsElement.click();
                await page.waitForTimeout(2000);
                
                await page.screenshot({ 
                    path: path.join(screenshotDir, '04-cc-projects-clicked.png'),
                    fullPage: true
                });
                
                const projectsPageInfo = await page.evaluate(() => ({
                    title: document.title,
                    url: window.location.href,
                    bodyText: document.body.textContent?.substring(0, 500)
                }));
                
                console.log('📄 After clicking CC Projects:', projectsPageInfo);
            } else {
                console.log('❌ CC Projects text not found or not visible');
            }
        } catch (error) {
            console.log('❌ Error with CC Projects:', error.message);
        }
        
        // Return to main page for final analysis
        await page.goto('http://localhost:1420');
        await page.waitForLoadState('networkidle');
        
        // Final screenshot
        await page.screenshot({ 
            path: path.join(screenshotDir, '05-final-state.png'),
            fullPage: true
        });
        
        // Get final page analysis
        const finalAnalysis = await page.evaluate(() => {
            return {
                title: document.title,
                url: window.location.href,
                allText: document.body.textContent?.replace(/\s+/g, ' ').trim(),
                elementCount: document.querySelectorAll('*').length,
                hasScript: !!document.querySelector('script'),
                hasStyle: !!document.querySelector('style, link[rel="stylesheet"]')
            };
        });
        
        console.log('✅ Test completed successfully!');
        console.log(`📁 Screenshots saved to: ${screenshotDir}`);
        
        return {
            success: true,
            screenshots: screenshotDir,
            pageContent,
            browserWarnings,
            finalAnalysis
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
            console.log('\n🎉 Claudia Web Test Results Summary:');
            console.log('- Success:', result.success);
            console.log('- Screenshots directory:', result.screenshots);
            console.log('- Page has MCP/Gateway text:', result.pageContent?.textPatterns?.hasGatewayText);
            console.log('- Page has Agents text:', result.pageContent?.textPatterns?.hasAgentsText);
            console.log('- Page has Projects text:', result.pageContent?.textPatterns?.hasProjectsText);
            console.log('- Browser warnings found:', result.browserWarnings?.warningCount || 0);
        })
        .catch(error => {
            console.error('\n💥 Test failed:', error.message);
            process.exit(1);
        });
}

module.exports = { testClaudiaWeb };