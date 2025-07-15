/**
 * Usage Dashboard 버튼 클릭 및 데이터 확인 테스트
 */

const { chromium } = require('playwright');

async function testUsageDashboard() {
  console.log('💰 Usage Dashboard 테스트 시작...');
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const context = await browser.newContext({
      viewport: { width: 1400, height: 900 }
    });
    
    const page = await context.newPage();
    
    // Console 로그 모니터링
    const apiCalls = [];
    page.on('console', msg => {
      const text = msg.text();
      console.log(`📝 [${msg.type()}]: ${text}`);
      
      // API 호출 추적
      if (text.includes('[WEB MODE] Backend command')) {
        apiCalls.push(text);
      }
    });
    
    console.log('🌐 클라우디아 로딩...');
    await page.goto('http://localhost:1420');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    console.log('🎯 Usage Dashboard 버튼 찾기...');
    const usageButton = page.locator('button', { hasText: 'Usage Dashboard' });
    
    if (await usageButton.count() > 0) {
      console.log('✅ Usage Dashboard 버튼 발견!');
      
      // 클릭 전 상태 확인
      console.log('\n📊 클릭 전 페이지 상태:');
      const beforeClick = await page.evaluate(() => {
        const stats = document.querySelectorAll('text=/\\$|cost|tokens|usage/i');
        return `데이터 관련 요소: ${stats.length}개`;
      });
      console.log(beforeClick);
      
      // Usage Dashboard 버튼 클릭
      console.log('\\n🖱️ Usage Dashboard 버튼 클릭...');
      await usageButton.click();
      
      // 클릭 후 데이터 로딩 대기
      await page.waitForTimeout(3000);
      
      console.log('\\n📈 클릭 후 데이터 확인...');
      
      // Mock 데이터 값들 확인
      const dataCheck = await page.evaluate(() => {
        const pageText = document.body.textContent || '';
        const results = {};
        
        // Mock에서 설정한 값들
        const expectedValues = {
          'totalCost': ['15.42', '$15.42'],
          'totalTokens': ['125000', '125,000'],
          'sessions': ['45'],
          'projects': ['8'],
          'sonnet': ['claude-3-5-sonnet', 'sonnet'],
          'haiku': ['claude-3-5-haiku', 'haiku'],
          'projectName': ['Claudia', 'BRNESTRM']
        };
        
        for (const [category, values] of Object.entries(expectedValues)) {
          results[category] = values.some(value => pageText.includes(value));
        }
        
        // 차트 요소들 확인
        results.charts = document.querySelectorAll('[class*="recharts"], svg').length;
        results.tables = document.querySelectorAll('table, [role="table"]').length;
        
        // 전체 텍스트 길이 (데이터가 로드되었는지 확인)
        results.textLength = pageText.length;
        
        return results;
      });
      
      console.log('📊 데이터 검증 결과:');
      for (const [key, value] of Object.entries(dataCheck)) {
        console.log(`  ${key}: ${value}`);
      }
      
      // 구체적인 사용량 정보 찾기
      const usageInfo = await page.evaluate(() => {
        const results = [];
        
        // 모든 숫자가 포함된 요소들 찾기
        document.querySelectorAll('*').forEach(el => {
          const text = el.textContent?.trim();
          if (text && /\$?\d+(\.\d+)?|\d{1,3}(,\d{3})*/.test(text) && el.children.length === 0) {
            results.push(text);
          }
        });
        
        // 중복 제거 및 정렬
        return [...new Set(results)].slice(0, 20);
      });
      
      console.log('\\n💰 발견된 숫자 데이터:');
      usageInfo.forEach(info => console.log(`  - ${info}`));
      
      // 에러 메시지나 빈 상태 확인
      const emptyState = await page.evaluate(() => {
        const emptyMessages = [];
        const errorMessages = [];
        
        document.querySelectorAll('*').forEach(el => {
          const text = el.textContent?.toLowerCase() || '';
          if (text.includes('no data') || text.includes('empty') || text.includes('없음')) {
            emptyMessages.push(el.textContent?.trim());
          }
          if (text.includes('error') || text.includes('failed') || text.includes('오류')) {
            errorMessages.push(el.textContent?.trim());
          }
        });
        
        return { emptyMessages, errorMessages };
      });
      
      if (emptyState.emptyMessages.length > 0) {
        console.log('\\n📭 빈 상태 메시지:');
        emptyState.emptyMessages.forEach(msg => console.log(`  - ${msg}`));
      }
      
      if (emptyState.errorMessages.length > 0) {
        console.log('\\n❌ 에러 메시지:');
        emptyState.errorMessages.forEach(msg => console.log(`  - ${msg}`));
      }
      
    } else {
      console.log('❌ Usage Dashboard 버튼을 찾을 수 없음');
    }
    
    // API 호출 결과 확인
    console.log('\\n🔗 API 호출 추적:');
    console.log(`총 ${apiCalls.length}개의 API 호출 감지`);
    apiCalls.forEach(call => console.log(`  ${call}`));
    
    // 최종 스크린샷
    await page.screenshot({ 
      path: 'claudia-usage-dashboard-final.png',
      fullPage: true 
    });
    console.log('\\n📸 최종 스크린샷: claudia-usage-dashboard-final.png');
    
  } catch (error) {
    console.error('❌ Usage Dashboard 테스트 오류:', error.message);
  } finally {
    await browser.close();
  }
}

// 테스트 실행
testUsageDashboard().catch(console.error);