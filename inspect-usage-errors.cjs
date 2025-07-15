/**
 * Usage Dashboard 컴포넌트 오류 검사
 */

const { chromium } = require('playwright');

async function inspectUsageErrors() {
  console.log('🔍 Usage Dashboard 오류 검사...');
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const context = await browser.newContext({
      viewport: { width: 1400, height: 900 }
    });
    
    const page = await context.newPage();
    
    // 모든 콘솔 메시지 수집
    const consoleLogs = [];
    page.on('console', msg => {
      consoleLogs.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      });
    });
    
    console.log('🌐 페이지 로딩...');
    await page.goto('http://localhost:1420');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    console.log('🎯 Usage Dashboard 클릭...');
    const usageButton = page.locator('button', { hasText: 'Usage Dashboard' });
    await usageButton.click();
    await page.waitForTimeout(5000); // 충분한 로딩 시간
    
    // 콘솔 오류들 분석
    console.log('\n🚨 콘솔 메시지 분석:');
    const errors = consoleLogs.filter(log => log.type === 'error');
    const warnings = consoleLogs.filter(log => log.type === 'warning');
    
    console.log(`❌ Errors: ${errors.length}`);
    errors.forEach((error, i) => {
      console.log(`  ${i + 1}. ${error.text}`);
    });
    
    console.log(`⚠️ Warnings: ${warnings.length}`);
    warnings.slice(0, 5).forEach((warning, i) => {
      console.log(`  ${i + 1}. ${warning.text}`);
    });
    
    // React 컴포넌트 상태 확인
    const componentState = await page.evaluate(() => {
      // Usage Dashboard가 렌더링되었는지 확인
      const usageDashboard = document.querySelector('[data-testid="usage-dashboard"]') || 
                           document.querySelector('.usage-dashboard') ||
                           document.querySelector('*:has-text("Usage Dashboard")');
      
      // 로딩 상태 확인
      const loadingElements = document.querySelectorAll('*:has-text("Loading"), *:has-text("로딩")');
      
      // 에러 메시지 확인
      const errorElements = document.querySelectorAll('*:has-text("Error"), *:has-text("Failed"), *:has-text("오류")');
      
      // 데이터 관련 요소들
      const dataElements = document.querySelectorAll('*:has-text("$"), *:has-text("cost"), *:has-text("tokens")');
      
      return {
        hasUsageDashboard: !!usageDashboard,
        loadingCount: loadingElements.length,
        errorCount: errorElements.length,
        dataCount: dataElements.length,
        totalElements: document.querySelectorAll('*').length,
        bodyText: document.body.textContent?.substring(0, 500)
      };
    });
    
    console.log('\n📊 컴포넌트 상태:');
    console.log(`  Usage Dashboard 존재: ${componentState.hasUsageDashboard}`);
    console.log(`  로딩 요소: ${componentState.loadingCount}개`);
    console.log(`  에러 요소: ${componentState.errorCount}개`);
    console.log(`  데이터 요소: ${componentState.dataCount}개`);
    console.log(`  전체 DOM 요소: ${componentState.totalElements}개`);
    
    console.log('\n📄 Body 텍스트 미리보기:');
    console.log(componentState.bodyText);
    
    // API 응답 모니터링
    const apiResponses = [];
    page.on('response', response => {
      if (response.url().includes('1420')) {
        apiResponses.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText()
        });
      }
    });
    
    // 스크린샷으로 현재 상태 확인
    await page.screenshot({ 
      path: 'usage-dashboard-error-inspection.png',
      fullPage: true 
    });
    console.log('\n📸 오류 검사 스크린샷: usage-dashboard-error-inspection.png');
    
    // 브라우저를 잠시 열어두고 수동 검사 가능하게 함
    console.log('\n⏸️ 브라우저를 10초간 열어둡니다. 수동으로 확인해보세요...');
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('❌ 검사 중 오류:', error.message);
  } finally {
    await browser.close();
  }
}

inspectUsageErrors().catch(console.error);