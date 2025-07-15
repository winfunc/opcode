/**
 * UI 상호작용 및 Data Usage 테스트
 * 버튼 클릭, 데이터 로딩, 백엔드 연결 상태 확인
 */

const { chromium } = require('playwright');

async function testUIInteractions() {
  console.log('🎯 클라우디아 UI 상호작용 테스트 시작...');
  
  const browser = await chromium.launch({ 
    headless: false,  // UI 확인을 위해 브라우저 창 표시
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const context = await browser.newContext({
      viewport: { width: 1400, height: 900 }
    });
    
    const page = await context.newPage();
    
    // Console 로그 모니터링
    page.on('console', msg => {
      console.log(`📝 Browser Console [${msg.type()}]:`, msg.text());
    });
    
    console.log('🌐 클라우디아 로딩 중...');
    await page.goto('http://localhost:1420');
    await page.waitForLoadState('networkidle');
    
    // 페이지 로드 확인
    const title = await page.title();
    console.log(`📋 페이지 제목: ${title}`);
    
    // React 앱 마운트 대기
    await page.waitForSelector('#root', { timeout: 10000 });
    console.log('✅ React 앱 마운트 성공');
    
    // 탭 네비게이션 확인
    console.log('\n🔍 탭 네비게이션 확인...');
    const tabs = await page.locator('[role="tablist"] button').all();
    console.log(`📊 발견된 탭 수: ${tabs.length}`);
    
    for (let i = 0; i < tabs.length; i++) {
      const tabText = await tabs[i].textContent();
      console.log(`  Tab ${i + 1}: ${tabText}`);
    }
    
    // Usage Dashboard 탭 찾기 및 클릭
    console.log('\n💰 Usage Dashboard 탭 클릭...');
    const usageTab = page.locator('[role="tablist"] button', { hasText: 'Usage Dashboard' });
    
    if (await usageTab.count() > 0) {
      await usageTab.click();
      console.log('✅ Usage Dashboard 탭 클릭 성공');
      
      // 데이터 로딩 대기
      await page.waitForTimeout(2000);
      
      // Usage 데이터 확인
      console.log('\n📊 Usage 데이터 확인...');
      
      // Total Cost 확인
      const totalCostElements = await page.locator('text=/Total Cost|총 비용/').all();
      console.log(`💵 Total Cost 요소 발견: ${totalCostElements.length}개`);
      
      // Charts 확인
      const chartElements = await page.locator('[class*="recharts"], [data-testid*="chart"]').all();
      console.log(`📈 차트 요소 발견: ${chartElements.length}개`);
      
      // Model usage 테이블 확인
      const tableElements = await page.locator('table, [role="table"]').all();
      console.log(`📋 테이블 요소 발견: ${tableElements.length}개`);
      
      // 구체적인 데이터 값 확인
      const pageContent = await page.content();
      
      // Mock 데이터 값들이 표시되는지 확인
      const expectedValues = ['15.42', '125000', '125,000', '$15.42', 'claude-3-5-sonnet', 'claude-3-5-haiku'];
      const foundValues = [];
      
      for (const value of expectedValues) {
        if (pageContent.includes(value)) {
          foundValues.push(value);
        }
      }
      
      console.log(`✅ 발견된 예상 데이터 값: ${foundValues.length}/${expectedValues.length}`);
      foundValues.forEach(value => console.log(`  - ${value}`));
      
      if (foundValues.length === 0) {
        console.log('⚠️ 예상 데이터 값이 발견되지 않음. 빈 상태일 수 있음.');
        
        // 빈 상태 메시지 확인
        const emptyStateElements = await page.locator('text=/No data|No usage|Empty|비어있음/').all();
        console.log(`📭 빈 상태 메시지: ${emptyStateElements.length}개`);
        
        // 로딩 상태 확인
        const loadingElements = await page.locator('text=/Loading|로딩|Fetching/').all();
        console.log(`⏳ 로딩 상태: ${loadingElements.length}개`);
      }
      
    } else {
      console.log('❌ Usage Dashboard 탭을 찾을 수 없음');
      
      // 사용 가능한 탭들 다시 확인
      console.log('\n📋 사용 가능한 탭들:');
      for (let i = 0; i < tabs.length; i++) {
        const tabText = await tabs[i].textContent();
        console.log(`  - ${tabText}`);
      }
    }
    
    // 백엔드 API 호출 확인
    console.log('\n🔗 백엔드 API 호출 테스트...');
    
    // Browser console에서 API 호출 확인
    const apiCalls = await page.evaluate(async () => {
      const results = [];
      
      // Mock API 함수들 직접 호출해보기
      try {
        // window 객체에서 api 접근 시도
        if (window.api) {
          const usageStats = await window.api.getUsageStats();
          results.push({ method: 'getUsageStats', success: true, data: usageStats });
        }
      } catch (error) {
        results.push({ method: 'getUsageStats', success: false, error: error.message });
      }
      
      return results;
    });
    
    console.log('📊 API 호출 결과:', apiCalls);
    
    // 스크린샷 저장
    await page.screenshot({ 
      path: 'claudia-usage-dashboard-test.png',
      fullPage: true 
    });
    console.log('📸 스크린샷 저장: claudia-usage-dashboard-test.png');
    
  } catch (error) {
    console.error('❌ UI 테스트 실행 중 오류:', error.message);
  } finally {
    await browser.close();
  }
}

// 테스트 실행
testUIInteractions().catch(console.error);