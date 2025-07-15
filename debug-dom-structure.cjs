/**
 * DOM 구조 디버깅 - 왜 탭이 보이지 않는지 확인
 */

const { chromium } = require('playwright');

async function debugDOMStructure() {
  console.log('🔍 DOM 구조 디버깅 시작...');
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const context = await browser.newContext({
      viewport: { width: 1400, height: 900 }
    });
    
    const page = await context.newPage();
    
    console.log('🌐 클라우디아 로딩...');
    await page.goto('http://localhost:1420');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // 충분한 로딩 시간
    
    // DOM 구조 분석
    console.log('\n📋 전체 DOM 구조 분석...');
    
    // Root 요소 확인
    const rootContent = await page.evaluate(() => {
      const root = document.getElementById('root');
      if (!root) return 'Root element not found';
      return {
        innerHTML: root.innerHTML.substring(0, 500) + '...',
        childrenCount: root.children.length,
        classes: root.className
      };
    });
    
    console.log('🎯 Root Element:', rootContent);
    
    // 모든 버튼과 탭 관련 요소 찾기
    const interactiveElements = await page.evaluate(() => {
      const elements = [];
      
      // 모든 버튼 찾기
      const buttons = document.querySelectorAll('button');
      elements.push(`Buttons found: ${buttons.length}`);
      buttons.forEach((btn, i) => {
        elements.push(`  Button ${i + 1}: "${btn.textContent?.trim()}" (${btn.className})`);
      });
      
      // 모든 role="tab" 요소 찾기
      const tabs = document.querySelectorAll('[role="tab"], [role="tablist"]');
      elements.push(`\\nTabs/Tablists found: ${tabs.length}`);
      tabs.forEach((tab, i) => {
        elements.push(`  Tab ${i + 1}: "${tab.textContent?.trim()}" (${tab.className})`);
      });
      
      // Radix UI 관련 요소들 찾기
      const radixElements = document.querySelectorAll('[data-radix-collection-item], [data-state]');
      elements.push(`\\nRadix UI elements: ${radixElements.length}`);
      radixElements.forEach((el, i) => {
        if (i < 10) { // 처음 10개만
          elements.push(`  Radix ${i + 1}: "${el.textContent?.trim()}" (${el.tagName})`);
        }
      });
      
      // 내비게이션 관련 요소들
      const navElements = document.querySelectorAll('nav, [role="navigation"]');
      elements.push(`\\nNavigation elements: ${navElements.length}`);
      
      return elements;
    });
    
    console.log('\n🎛️ Interactive Elements:');
    interactiveElements.forEach(elem => console.log(elem));
    
    // 특정 텍스트가 포함된 요소들 찾기
    const textSearch = await page.evaluate(() => {
      const searchTerms = ['Usage', 'Dashboard', 'CC Agents', 'Projects', 'Settings'];
      const results = [];
      
      searchTerms.forEach(term => {
        const elements = [];
        document.querySelectorAll('*').forEach(el => {
          if (el.textContent && el.textContent.includes(term) && el.children.length === 0) {
            elements.push({
              tag: el.tagName,
              text: el.textContent.trim(),
              className: el.className
            });
          }
        });
        if (elements.length > 0) {
          results.push(`${term}: ${elements.length} matches`);
          elements.slice(0, 3).forEach(el => {
            results.push(`  - ${el.tag}: "${el.text}" (${el.className})`);
          });
        }
      });
      
      return results;
    });
    
    console.log('\n🔍 Text Search Results:');
    textSearch.forEach(result => console.log(result));
    
    // 앱이 실제로 렌더링되었는지 확인
    const appState = await page.evaluate(() => {
      return {
        hasReact: typeof window.React !== 'undefined',
        bodyContent: document.body.innerHTML.length,
        scripts: document.querySelectorAll('script').length,
        styles: document.querySelectorAll('style, link[rel="stylesheet"]').length,
        errors: window.console.errors || []
      };
    });
    
    console.log('\n⚙️ App State:', appState);
    
    // 로딩 상태 확인
    const loadingElements = await page.locator('text=/loading|Loading|로딩/i').all();
    console.log(`⏳ Loading elements: ${loadingElements.length}`);
    
    // 에러 메시지 확인
    const errorElements = await page.locator('text=/error|Error|오류|실패/i').all();
    console.log(`❌ Error elements: ${errorElements.length}`);
    
    // 스크린샷으로 실제 화면 확인
    await page.screenshot({ 
      path: 'claudia-dom-debug.png',
      fullPage: true 
    });
    console.log('\n📸 디버깅 스크린샷 저장: claudia-dom-debug.png');
    
    // 브라우저 콘솔 에러들 캡처
    const consoleLogs = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleLogs.push(`ERROR: ${msg.text()}`);
      }
    });
    
    await page.waitForTimeout(2000);
    
    console.log('\n🚨 Console Errors:');
    consoleLogs.forEach(log => console.log(log));
    
  } catch (error) {
    console.error('❌ DOM 디버깅 실행 중 오류:', error.message);
  } finally {
    await browser.close();
  }
}

// 디버깅 실행
debugDOMStructure().catch(console.error);