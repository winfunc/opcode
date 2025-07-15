-- Claudia Browser Automation Testing Script
-- This script will open Chrome, navigate to each section, and capture results

tell application "Google Chrome"
    activate
    
    -- Close any existing Claudia tabs first
    repeat with w in windows
        repeat with t in tabs of w
            if URL of t contains "localhost:1420" then
                close t
            end if
        end repeat
    end repeat
    
    -- Create new window for testing
    set testWindow to make new window
    set URL of active tab of testWindow to "http://localhost:1420"
    
    -- Wait for page to load
    delay 5
    
    -- Test 1: Welcome Page
    log "Testing Welcome Page..."
    do shell script "screencapture -x ~/Desktop/claudia-test-results/01-welcome-page.png"
    
    -- Run initial backend test
    execute active tab of testWindow javascript "
        console.log('🔍 Starting Claudia Backend Tests...');
        
        // Test if Tauri is available
        if (typeof window.__TAURI__ !== 'undefined') {
            console.log('✅ Tauri runtime detected');
            
            // Test basic backend connection
            window.__TAURI__.core.invoke('check_claude_version')
                .then(result => console.log('✅ Backend connection test: SUCCESS', result))
                .catch(error => console.log('❌ Backend connection test: FAILED', error));
        } else {
            console.log('❌ Tauri runtime not available');
        }
    "
    
    delay 3
    
    -- Test 2: Usage Dashboard
    log "Testing Usage Dashboard..."
    execute active tab of testWindow javascript "
        // Look for usage button in various ways
        let usageBtn = document.querySelector('[data-testid=\"usage-button\"]') ||
                      document.querySelector('button:contains(\"Usage\")') ||
                      document.querySelector('[title*=\"Usage\"]') ||
                      document.querySelector('.topbar button[role=\"button\"]');
        
        if (usageBtn) {
            usageBtn.click();
            console.log('✅ Clicked Usage Dashboard button');
        } else {
            // Try clicking topbar buttons one by one to find usage
            const topbarButtons = document.querySelectorAll('.topbar button, [data-radix-collection-item]');
            console.log('Found topbar buttons:', topbarButtons.length);
            
            // Try the usage icon or text
            for (let btn of topbarButtons) {
                if (btn.textContent.includes('Usage') || btn.innerHTML.includes('BarChart') || btn.getAttribute('title')?.includes('Usage')) {
                    btn.click();
                    console.log('✅ Found and clicked Usage button');
                    break;
                }
            }
        }
    "
    
    delay 4
    do shell script "screencapture -x ~/Desktop/claudia-test-results/02-usage-dashboard.png"
    
    -- Test usage stats loading
    execute active tab of testWindow javascript "
        if (typeof window.__TAURI__ !== 'undefined') {
            window.__TAURI__.core.invoke('get_usage_stats')
                .then(result => {
                    console.log('✅ Usage Dashboard: Data loaded successfully', result);
                    document.body.setAttribute('data-usage-status', 'success');
                })
                .catch(error => {
                    console.log('❌ Usage Dashboard: Failed to load data', error);
                    document.body.setAttribute('data-usage-status', 'failed');
                });
        }
    "
    
    delay 3
    
    -- Test 3: CLAUDE.md Editor
    log "Testing CLAUDE.md Editor..."
    execute active tab of testWindow javascript "
        // Look for CLAUDE button
        let claudeBtn = document.querySelector('[data-testid=\"claude-button\"]') ||
                       document.querySelector('button:contains(\"CLAUDE\")') ||
                       document.querySelector('[title*=\"CLAUDE\"]');
        
        if (claudeBtn) {
            claudeBtn.click();
            console.log('✅ Clicked CLAUDE.md button');
        } else {
            // Try finding by icon or alternative selectors
            const topbarButtons = document.querySelectorAll('.topbar button, [data-radix-collection-item]');
            for (let btn of topbarButtons) {
                if (btn.textContent.includes('CLAUDE') || btn.innerHTML.includes('FileText')) {
                    btn.click();
                    console.log('✅ Found and clicked CLAUDE button');
                    break;
                }
            }
        }
    "
    
    delay 4
    do shell script "screencapture -x ~/Desktop/claudia-test-results/03-claude-md.png"
    
    -- Test system prompt loading
    execute active tab of testWindow javascript "
        if (typeof window.__TAURI__ !== 'undefined') {
            window.__TAURI__.core.invoke('get_system_prompt')
                .then(result => {
                    console.log('✅ CLAUDE.md: System prompt loaded successfully', result.length + ' characters');
                    document.body.setAttribute('data-claude-status', 'success');
                })
                .catch(error => {
                    console.log('❌ CLAUDE.md: Failed to load system prompt', error);
                    document.body.setAttribute('data-claude-status', 'failed');
                });
        }
    "
    
    delay 3
    
    -- Test 4: MCP Manager
    log "Testing MCP Manager..."
    execute active tab of testWindow javascript "
        // Look for MCP button
        let mcpBtn = document.querySelector('[data-testid=\"mcp-button\"]') ||
                    document.querySelector('button:contains(\"MCP\")') ||
                    document.querySelector('[title*=\"MCP\"]');
        
        if (mcpBtn) {
            mcpBtn.click();
            console.log('✅ Clicked MCP button');
        } else {
            const topbarButtons = document.querySelectorAll('.topbar button, [data-radix-collection-item]');
            for (let btn of topbarButtons) {
                if (btn.textContent.includes('MCP') || btn.innerHTML.includes('Server')) {
                    btn.click();
                    console.log('✅ Found and clicked MCP button');
                    break;
                }
            }
        }
    "
    
    delay 4
    do shell script "screencapture -x ~/Desktop/claudia-test-results/04-mcp-manager.png"
    
    -- Test MCP server loading
    execute active tab of testWindow javascript "
        if (typeof window.__TAURI__ !== 'undefined') {
            window.__TAURI__.core.invoke('mcp_list')
                .then(result => {
                    console.log('✅ MCP Manager: Servers loaded successfully', result.length + ' servers');
                    document.body.setAttribute('data-mcp-status', 'success');
                })
                .catch(error => {
                    console.log('❌ MCP Manager: Failed to load servers', error);
                    document.body.setAttribute('data-mcp-status', 'failed');
                });
        }
    "
    
    delay 3
    
    -- Test 5: Settings
    log "Testing Settings..."
    execute active tab of testWindow javascript "
        // Look for Settings button
        let settingsBtn = document.querySelector('[data-testid=\"settings-button\"]') ||
                         document.querySelector('button:contains(\"Settings\")') ||
                         document.querySelector('[title*=\"Settings\"]');
        
        if (settingsBtn) {
            settingsBtn.click();
            console.log('✅ Clicked Settings button');
        } else {
            const topbarButtons = document.querySelectorAll('.topbar button, [data-radix-collection-item]');
            for (let btn of topbarButtons) {
                if (btn.textContent.includes('Settings') || btn.innerHTML.includes('Settings') || btn.innerHTML.includes('Gear')) {
                    btn.click();
                    console.log('✅ Found and clicked Settings button');
                    break;
                }
            }
        }
    "
    
    delay 4
    do shell script "screencapture -x ~/Desktop/claudia-test-results/05-settings.png"
    
    -- Test settings loading
    execute active tab of testWindow javascript "
        if (typeof window.__TAURI__ !== 'undefined') {
            window.__TAURI__.core.invoke('get_claude_settings')
                .then(result => {
                    console.log('✅ Settings: Configuration loaded successfully', result);
                    document.body.setAttribute('data-settings-status', 'success');
                })
                .catch(error => {
                    console.log('❌ Settings: Failed to load configuration', error);
                    document.body.setAttribute('data-settings-status', 'failed');
                });
        }
    "
    
    delay 3
    
    -- Return to welcome page for agent/project tests
    log "Returning to welcome page..."
    execute active tab of testWindow javascript "window.location.href = 'http://localhost:1420'"
    delay 4
    
    -- Test 6: CC Agents
    log "Testing CC Agents..."
    execute active tab of testWindow javascript "
        // Look for CC Agents card
        const agentCard = document.querySelector('h2:contains(\"CC Agents\")') ||
                         document.querySelector('[onclick*=\"cc-agents\"]') ||
                         document.querySelector('.card:contains(\"Agents\")');
        
        if (agentCard) {
            agentCard.click();
            console.log('✅ Clicked CC Agents card');
        } else {
            // Find by text content
            const cards = document.querySelectorAll('.card, [role=\"button\"]');
            for (let card of cards) {
                if (card.textContent.includes('CC Agents') || card.textContent.includes('Agents')) {
                    card.click();
                    console.log('✅ Found and clicked CC Agents card');
                    break;
                }
            }
        }
    "
    
    delay 4
    do shell script "screencapture -x ~/Desktop/claudia-test-results/06-cc-agents.png"
    
    -- Test agents loading
    execute active tab of testWindow javascript "
        if (typeof window.__TAURI__ !== 'undefined') {
            window.__TAURI__.core.invoke('list_agents')
                .then(result => {
                    console.log('✅ CC Agents: Agents loaded successfully', result.length + ' agents');
                    document.body.setAttribute('data-agents-status', 'success');
                })
                .catch(error => {
                    console.log('❌ CC Agents: Failed to load agents', error);
                    document.body.setAttribute('data-agents-status', 'failed');
                });
        }
    "
    
    delay 3
    
    -- Return to welcome page for projects test
    execute active tab of testWindow javascript "window.location.href = 'http://localhost:1420'"
    delay 4
    
    -- Test 7: CC Projects
    log "Testing CC Projects..."
    execute active tab of testWindow javascript "
        // Look for CC Projects card
        const projectCard = document.querySelector('h2:contains(\"CC Projects\")') ||
                           document.querySelector('[onclick*=\"projects\"]') ||
                           document.querySelector('.card:contains(\"Projects\")');
        
        if (projectCard) {
            projectCard.click();
            console.log('✅ Clicked CC Projects card');
        } else {
            const cards = document.querySelectorAll('.card, [role=\"button\"]');
            for (let card of cards) {
                if (card.textContent.includes('CC Projects') || card.textContent.includes('Projects')) {
                    card.click();
                    console.log('✅ Found and clicked CC Projects card');
                    break;
                }
            }
        }
    "
    
    delay 4
    do shell script "screencapture -x ~/Desktop/claudia-test-results/07-cc-projects.png"
    
    -- Test projects loading
    execute active tab of testWindow javascript "
        if (typeof window.__TAURI__ !== 'undefined') {
            window.__TAURI__.core.invoke('list_projects')
                .then(result => {
                    console.log('✅ CC Projects: Projects loaded successfully', result.length + ' projects');
                    document.body.setAttribute('data-projects-status', 'success');
                })
                .catch(error => {
                    console.log('❌ CC Projects: Failed to load projects', error);
                    document.body.setAttribute('data-projects-status', 'failed');
                });
        }
    "
    
    delay 3
    
    -- Final comprehensive test
    log "Running comprehensive backend test..."
    execute active tab of testWindow javascript "
        async function runComprehensiveTest() {
            console.log('🔍 Running Comprehensive Backend Test...');
            console.log('=========================================');
            
            const tests = [
                ['Usage Stats', 'get_usage_stats'],
                ['System Prompt', 'get_system_prompt'],
                ['MCP List', 'mcp_list'],
                ['Claude Settings', 'get_claude_settings'],
                ['List Agents', 'list_agents'],
                ['List Projects', 'list_projects'],
                ['Claude Version', 'check_claude_version']
            ];
            
            let passed = 0;
            let failed = 0;
            
            for (const [name, command] of tests) {
                try {
                    const startTime = Date.now();
                    const result = await window.__TAURI__.core.invoke(command);
                    const duration = Date.now() - startTime;
                    console.log(`✅ ${name}: SUCCESS (${duration}ms)`, result);
                    passed++;
                } catch (error) {
                    console.log(`❌ ${name}: FAILED`, error);
                    failed++;
                }
            }
            
            console.log('=========================================');
            console.log(`📊 Test Summary: ${passed} passed, ${failed} failed`);
            console.log(`📈 Success Rate: ${(passed / (passed + failed) * 100).toFixed(1)}%`);
            
            // Store results in DOM for later retrieval
            document.body.setAttribute('data-test-passed', passed);
            document.body.setAttribute('data-test-failed', failed);
            document.body.setAttribute('data-test-total', passed + failed);
        }
        
        runComprehensiveTest();
    "
    
    delay 5
    
    -- Take final screenshot
    do shell script "screencapture -x ~/Desktop/claudia-test-results/08-final-results.png"
    
    log "Testing completed! Screenshots saved to ~/Desktop/claudia-test-results/"
    
end tell