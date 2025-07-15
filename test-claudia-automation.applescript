#!/usr/bin/osascript

-- Claudia UI Testing Automation Script
-- This script automates browser testing and captures screenshots of each section

on run
    set screenshotDir to (POSIX path of (path to desktop)) & "claudia-test-screenshots/"
    
    -- Create screenshots directory
    do shell script "mkdir -p " & quoted form of screenshotDir
    
    log "Starting Claudia UI Testing Automation"
    log "Screenshots will be saved to: " & screenshotDir
    
    -- Open Claudia in Chrome
    tell application "Google Chrome"
        activate
        set claudiaWindow to make new window
        set URL of active tab of claudiaWindow to "http://localhost:1420"
        delay 3
    end tell
    
    -- Take initial screenshot
    do shell script "screencapture -x " & quoted form of (screenshotDir & "01-initial-load.png")
    delay 1
    
    -- Test each section
    testSection("Welcome", screenshotDir)
    testSection("CC Projects", screenshotDir)
    testSection("CC Agents", screenshotDir)
    testSection("Settings", screenshotDir)
    testSection("Usage Dashboard", screenshotDir)
    testSection("MCP", screenshotDir)
    testSection("CLAUDE.md", screenshotDir)
    
    -- Run the JavaScript test in the browser console
    runJavaScriptTests()
    
    log "Testing completed. Screenshots saved to: " & screenshotDir
    
    return "Claudia UI testing completed successfully"
end run

on testSection(sectionName, screenshotDir)
    log "Testing section: " & sectionName
    
    tell application "Google Chrome"
        activate
        delay 2
        
        -- Navigate based on section
        if sectionName is "CC Projects" then
            execute active tab of front window javascript "
                const projectCard = document.querySelector('[onclick*=\"projects\"]') || document.querySelector('h2:contains(\"CC Projects\")').closest('div');
                if (projectCard) { projectCard.click(); }
            "
        else if sectionName is "CC Agents" then
            execute active tab of front window javascript "
                const agentCard = document.querySelector('[onclick*=\"cc-agents\"]') || document.querySelector('h2:contains(\"CC Agents\")').closest('div');
                if (agentCard) { agentCard.click(); }
            "
        else if sectionName is "Settings" then
            execute active tab of front window javascript "
                const settingsBtn = document.querySelector('[data-testid=\"settings-button\"]') || document.querySelector('button:contains(\"Settings\")');
                if (settingsBtn) { settingsBtn.click(); }
            "
        else if sectionName is "Usage Dashboard" then
            execute active tab of front window javascript "
                const usageBtn = document.querySelector('[data-testid=\"usage-button\"]') || document.querySelector('button:contains(\"Usage\")');
                if (usageBtn) { usageBtn.click(); }
            "
        else if sectionName is "MCP" then
            execute active tab of front window javascript "
                const mcpBtn = document.querySelector('[data-testid=\"mcp-button\"]') || document.querySelector('button:contains(\"MCP\")');
                if (mcpBtn) { mcpBtn.click(); }
            "
        else if sectionName is "CLAUDE.md" then
            execute active tab of front window javascript "
                const claudeBtn = document.querySelector('[data-testid=\"claude-button\"]') || document.querySelector('button:contains(\"CLAUDE\")');
                if (claudeBtn) { claudeBtn.click(); }
            "
        end if
        
        delay 3
    end tell
    
    -- Take screenshot
    set filename to "02-" & (my replaceText(sectionName, " ", "-")) & ".png"
    do shell script "screencapture -x " & quoted form of (screenshotDir & filename)
    
    -- Check for errors in console
    tell application "Google Chrome"
        set consoleErrors to execute active tab of front window javascript "
            const errors = [];
            const originalError = console.error;
            console.error = function(...args) {
                errors.push(args.join(' '));
                originalError.apply(console, arguments);
            };
            
            // Check for visible error messages
            const errorElements = document.querySelectorAll('.error, .alert-error, [class*=\"error\"], [class*=\"fail\"]');
            errorElements.forEach(el => errors.push('UI Error: ' + el.textContent));
            
            JSON.stringify(errors);
        "
        
        if consoleErrors is not "[]" then
            log "Errors found in " & sectionName & ": " & consoleErrors
        end if
    end tell
    
    delay 1
end testSection

on runJavaScriptTests()
    log "Running JavaScript backend connection tests"
    
    tell application "Google Chrome"
        activate
        
        -- Load and run the test script
        execute active tab of front window javascript "
            // Load the test script if not already loaded
            if (typeof testBackendConnections === 'undefined') {
                const script = document.createElement('script');
                script.src = '/test-backend-connections.js';
                document.head.appendChild(script);
                
                script.onload = function() {
                    setTimeout(() => testBackendConnections(), 1000);
                };
            } else {
                testBackendConnections();
            }
        "
        
        delay 10 -- Wait for tests to complete
        
        -- Get test results
        set testResults to execute active tab of front window javascript "
            JSON.stringify(window.testResults || {error: 'Tests not completed'});
        "
        
        log "Test Results: " & testResults
    end tell
end runJavaScriptTests

-- Helper function to replace text
on replaceText(theText, oldString, newString)
    set AppleScript's text item delimiters to oldString
    set theTextItems to text items of theText
    set AppleScript's text item delimiters to newString
    set theText to theTextItems as string
    set AppleScript's text item delimiters to ""
    return theText
end replaceText