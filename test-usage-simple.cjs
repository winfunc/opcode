/**
 * 간단한 Usage Dashboard 테스트
 */

const { chromium } = require('playwright');

async function testUsageSimple() {
  console.log('💰 Usage Dashboard 간단 테스트...');
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const context = await browser.newContext({
      viewport: { width: 1400, height: 900 }
    });
    
    const page = await context.newPage();
    
    // API 호출 추적
    const apiCalls = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[WEB MODE] Backend command')) {
        apiCalls.push(text);
        console.log(`🔗 API: ${text}`);
      }
    });
    
    console.log('🌐 페이지 로딩...');
    await page.goto('http://localhost:1420');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    console.log('🎯 Usage Dashboard 버튼 클릭...');
    const usageButton = page.locator('button', { hasText: 'Usage Dashboard' });
    await usageButton.click();
    await page.waitForTimeout(3000);
    
    // 페이지 텍스트 전체 확인
    const pageText = await page.textContent('body');
    console.log('\\n📄 페이지 텍스트 길이:', pageText.length);
    
    // Mock 데이터 값들 검색
    const mockValues = ['15.42', '125000', '125,000', 'claude-3-5-sonnet', 'claude-3-5-haiku', 'Claudia', 'BRNESTRM'];
    const foundValues = [];
    
    for (const value of mockValues) {
      if (pageText.includes(value)) {
        foundValues.push(value);
      }
    }
    
    console.log('\\n💰 발견된 Mock 데이터:');
    if (foundValues.length > 0) {
      foundValues.forEach(value => console.log(`  ✅ ${value}`));
    } else {
      console.log('  ❌ Mock 데이터가 표시되지 않음');
    }
    
    // 숫자나 금액 관련 텍스트 찾기
    const numberMatches = pageText.match(/\$?\d+\.?\d*|\d{1,3},\d{3}/g) || [];
    console.log('\\n🔢 발견된 숫자들:');
    [...new Set(numberMatches)].slice(0, 10).forEach(num => console.log(`  - ${num}`));
    
    // 차트나 테이블 요소 확인
    const charts = await page.locator('svg, [class*="recharts"]').count();
    const tables = await page.locator('table, [role="table"]').count();
    console.log(`\\n📊 UI 요소: ${charts}개 차트, ${tables}개 테이블`);
    
    // "No data" 또는 에러 메시지 확인
    const hasNoData = pageText.toLowerCase().includes('no data') || 
                     pageText.toLowerCase().includes('empty') ||
                     pageText.toLowerCase().includes('없음');
    
    const hasError = pageText.toLowerCase().includes('error') || 
                    pageText.toLowerCase().includes('failed') ||
                    pageText.toLowerCase().includes('오류');
    
    console.log(`\\n🔍 상태: NoData=${hasNoData}, Error=${hasError}`);
    
    // API 호출 결과
    console.log(`\\n📞 총 ${apiCalls.length}개 API 호출 감지`);
    
    // 스크린샷
    await page.screenshot({ 
      path: 'usage-dashboard-simple-test.png',
      fullPage: true 
    });
    console.log('\\n📸 스크린샷: usage-dashboard-simple-test.png');
    
  } catch (error) {
    console.error('❌ 테스트 오류:', error.message);
  } finally {
    await browser.close();
  }
}

testUsageSimple().catch(console.error);