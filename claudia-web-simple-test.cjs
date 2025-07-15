#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testClaudiaWeb() {
    console.log('🚀 Starting Simple Claudia Web Test...');
    
    const browser = await chromium.launch({
        headless: false,
        slowMo: 2000,
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
        
        console.log('📱 Navigating to Claudia Web Interface...');
        await page.goto('http://localhost:1420');
        await page.waitForLoadState('networkidle');
        
        // Get basic page info
        const title = await page.title();
        const url = page.url();
        console.log(`📋 Page Title: ${title}`);
        console.log(`🔗 Current URL: ${url}`);
        
        // Take initial screenshot
        await page.screenshot({ 
            path: path.join(screenshotDir, '01-initial-load.png'),
            fullPage: true
        });
        console.log('📷 Screenshot 1: Initial page load');
        
        // Get page text content
        const bodyText = await page.evaluate(() => document.body.textContent);
        console.log('📝 Page content preview:', bodyText.substring(0, 300));
        
        // Check for key elements by text content
        const hasAgents = bodyText.includes('CC Agents') || bodyText.includes('Agents');
        const hasProjects = bodyText.includes('CC Projects') || bodyText.includes('Projects');
        const hasGateway = bodyText.includes('Gateway') || bodyText.includes('MCP');
        const hasConnection = bodyText.includes('Connection') || bodyText.includes('Connected');
        const hasUsage = bodyText.includes('Usage') || bodyText.includes('usage');
        
        console.log('🔍 Content Analysis:');
        console.log('- Has Agents text:', hasAgents);
        console.log('- Has Projects text:', hasProjects);
        console.log('- Has Gateway/MCP text:', hasGateway);
        console.log('- Has Connection text:', hasConnection);
        console.log('- Has Usage text:', hasUsage);
        
        // Try to click on CC Agents if found
        if (hasAgents) {
            console.log('🤖 Attempting to click CC Agents...');
            try {
                await page.locator('text=CC Agents').first().click({ timeout: 5000 });
                await page.waitForTimeout(3000);
                
                const newUrl = page.url();
                const newTitle = await page.title();
                console.log(`✅ Navigated to: ${newUrl} - ${newTitle}`);
                
                await page.screenshot({ 
                    path: path.join(screenshotDir, '02-cc-agents.png'),
                    fullPage: true
                });
                console.log('📷 Screenshot 2: CC Agents page');
                
                const agentsPageText = await page.evaluate(() => document.body.textContent);
                console.log('📝 Agents page content:', agentsPageText.substring(0, 300));
                
            } catch (error) {
                console.log('❌ Failed to click CC Agents:', error.message);
            }
        }
        
        // Go back to main page
        await page.goto('http://localhost:1420');
        await page.waitForLoadState('networkidle');
        
        // Try to click on CC Projects if found
        if (hasProjects) {
            console.log('📁 Attempting to click CC Projects...');
            try {
                await page.locator('text=CC Projects').first().click({ timeout: 5000 });
                await page.waitForTimeout(3000);
                
                const newUrl = page.url();
                const newTitle = await page.title();
                console.log(`✅ Navigated to: ${newUrl} - ${newTitle}`);
                
                await page.screenshot({ 
                    path: path.join(screenshotDir, '03-cc-projects.png'),
                    fullPage: true
                });
                console.log('📷 Screenshot 3: CC Projects page');
                
                const projectsPageText = await page.evaluate(() => document.body.textContent);
                console.log('📝 Projects page content:', projectsPageText.substring(0, 300));
                
            } catch (error) {
                console.log('❌ Failed to click CC Projects:', error.message);
            }
        }
        
        // Go back to main page for final screenshot
        await page.goto('http://localhost:1420');
        await page.waitForLoadState('networkidle');
        
        await page.screenshot({ 
            path: path.join(screenshotDir, '04-final-main-page.png'),
            fullPage: true
        });
        console.log('📷 Screenshot 4: Final main page state');
        
        // Get all visible text for analysis
        const finalText = await page.evaluate(() => document.body.textContent);
        
        console.log('✅ Test completed successfully!');
        console.log(`📁 Screenshots saved to: ${screenshotDir}`);
        
        return {
            success: true,
            title,
            url,
            screenshotDir,
            contentAnalysis: {
                hasAgents,
                hasProjects,
                hasGateway,
                hasConnection,
                hasUsage
            },
            fullText: finalText
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
            console.log('\n🎉 Test Results Summary:');
            console.log('- Title:', result.title);
            console.log('- URL:', result.url);
            console.log('- Screenshots:', result.screenshotDir);
            console.log('- Content Analysis:', result.contentAnalysis);
            
            // Save detailed results
            const resultsFile = path.join(__dirname, 'claudia-web-test-results.json');
            fs.writeFileSync(resultsFile, JSON.stringify(result, null, 2));
            console.log('- Detailed results saved to:', resultsFile);
        })
        .catch(error => {
            console.error('\n💥 Test failed:', error.message);
            process.exit(1);
        });
}

module.exports = { testClaudiaWeb };