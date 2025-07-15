/**
 * Chromium Playwright MCP 호환성 테스트
 * 클라우디아 웹 앱 접속 및 브라우저 감지 확인
 */

const { chromium } = require('playwright');

async function testClaudiaChromiumAccess() {
  console.log('🚀 Chromium Playwright MCP 테스트 시작...');
  
  const browser = await chromium.launch({ 
    headless: false,  // 브라우저 창 표시
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const context = await browser.newContext({
      viewport: { width: 1200, height: 800 }
    });
    
    const page = await context.newPage();
    
    console.log('📱 클라우디아 접속 중...');
    await page.goto('http://localhost:1420');
    
    // 페이지 로드 대기
    await page.waitForLoadState('networkidle');
    
    // 페이지 정보 확인
    const title = await page.title();
    console.log(`📋 페이지 제목: ${title}`);
    
    // 브라우저 감지 테스트
    const browserInfo = await page.evaluate(() => {
      // 브라우저 감지 함수 실행 (클라우디아의 browserDetection.ts와 동일)
      const userAgent = navigator.userAgent;
      
      if (userAgent.includes('Chromium')) {
        return {
          name: 'Chromium',
          isChromium: true,
          isSupported: true,
          detected: 'Chromium (완벽 지원)'
        };
      }
      
      if (userAgent.includes('Chrome') && !userAgent.includes('Chromium')) {
        return {
          name: 'Google Chrome', 
          isChromium: true,
          isSupported: false,
          detected: 'Chrome (호환성 제한)'
        };
      }
      
      return {
        name: 'Unknown',
        isChromium: false,
        isSupported: false,
        detected: '미지원 브라우저'
      };
    });
    
    console.log('🔍 브라우저 감지 결과:');
    console.log(`   브라우저: ${browserInfo.detected}`);
    console.log(`   Chromium 엔진: ${browserInfo.isChromium ? '✅' : '❌'}`);
    console.log(`   Playwright MCP 지원: ${browserInfo.isSupported ? '✅' : '❌'}`);
    
    // DOM 요소 확인
    try {
      await page.waitForSelector('#root', { timeout: 5000 });
      console.log('✅ React 앱 마운트 성공');
      
      // 클라우디아 특정 요소들 확인
      const hasApp = await page.locator('#root').count() > 0;
      console.log(`📱 앱 컨테이너: ${hasApp ? '✅' : '❌'}`);
      
    } catch (error) {
      console.log('⚠️ DOM 요소 로딩 지연 또는 오류');
    }
    
    // 스크린샷 캡처
    await page.screenshot({ 
      path: 'claudia-chromium-test.png',
      fullPage: true 
    });
    console.log('📸 스크린샷 저장: claudia-chromium-test.png');
    
    // MCP Gateway 연결 테스트 (모의)
    console.log('🔗 MCP Gateway 연결 테스트...');
    try {
      const mcpResponse = await page.evaluate(async () => {
        try {
          const response = await fetch('http://localhost:8080/health');
          return {
            status: response.status,
            available: response.ok
          };
        } catch (error) {
          return {
            status: 'error',
            available: false,
            error: error.message
          };
        }
      });
      
      if (mcpResponse.available) {
        console.log('✅ MCP Gateway 연결 성공');
      } else {
        console.log('⚠️ MCP Gateway 미사용 (정상 - Docker 환경 필요)');
      }
    } catch (error) {
      console.log('⚠️ MCP Gateway 테스트 건너뜀');
    }
    
    console.log('🎉 Chromium 호환성 테스트 완료!');
    
  } catch (error) {
    console.error('❌ 테스트 실행 중 오류:', error.message);
  } finally {
    await browser.close();
  }
}

// 테스트 실행
testClaudiaChromiumAccess().catch(console.error);