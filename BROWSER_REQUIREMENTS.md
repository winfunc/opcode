# 🌐 Claudia Browser Requirements

## ⚠️ **중요: 브라우저 호환성**

### 🎯 **필수 브라우저: Chromium만 사용**

Claudia를 브라우저에서 사용할 때는 **반드시 Chromium만 사용해야 합니다**:

- ✅ **Chromium** (유일한 지원 브라우저)

### ❌ **지원되지 않는 브라우저**

다음 브라우저들은 **사용할 수 없습니다**:

- ❌ **Google Chrome** (혼잡 가능성)
- ❌ Safari
- ❌ Firefox  
- ❌ Microsoft Edge
- ❌ Brave Browser
- ❌ 기타 모든 브라우저

## 🤖 **Playwright MCP 통합**

### 왜 Chromium이 필요한가?

1. **Playwright MCP 의존성**: Claudia의 핵심 기능인 186개 MCP 도구 중 Playwright가 Chromium 엔진을 사용
2. **브라우저 자동화**: CC Agents가 웹 페이지와 상호작용할 때 Chromium 기반 엔진 필요
3. **완전한 기능**: 모든 MCP 도구가 정상 작동하려면 Chromium 환경 필수

### 🚨 **중요 안내**

```
⚠️  Safari나 Firefox에서 Claudia를 열면:
   - 기본 UI는 보이지만
   - Playwright MCP 기능이 작동하지 않습니다
   - CC Agents 테스트가 실패할 수 있습니다
   - 브라우저 자동화 기능이 제한됩니다
```

## 🔧 **설정 가이드**

### 🎯 Chromium 설치 및 사용법

```bash
# macOS에서 Chromium 설치
brew install --cask chromium

# Chromium으로 Claudia 열기
open -a "Chromium" http://localhost:1420
```

**설정 단계**:
1. Chromium 다운로드 및 설치
2. Chromium으로만 http://localhost:1420 접속
3. 다른 브라우저는 사용 금지

## 🧪 **호환성 테스트**

브라우저 호환성을 확인하려면:

1. http://localhost:1420/sync-test.html 접속
2. "Test CC Agents" 버튼 클릭
3. Playwright MCP 기능 정상 작동 확인

### 정상 작동 시 표시되는 메시지:
```
✅ Found X CC Agents
✅ Playwright MCP tests passed
✅ Browser automation ready
```

### 호환되지 않는 브라우저에서의 메시지:
```
❌ Playwright MCP not available
❌ Browser automation limited
⚠️  Please use Chrome/Chromium
```

## 📱 **모바일 및 태블릿**

- **iOS Safari**: 제한적 기능만 지원
- **Android Chrome**: 대부분의 기능 지원
- **모바일 권장사항**: 데스크톱 Chromium 사용 권장

## 🔗 **관련 링크**

- [Google Chrome 다운로드](https://www.google.com/chrome/)
- [Chromium 다운로드](https://www.chromium.org/getting-involved/download-chromium/)
- [Playwright 브라우저 지원](https://playwright.dev/docs/browsers)

---

## 💡 **요약**

**🎯 핵심 메시지**: Claudia의 모든 기능을 사용하려면 반드시 **Google Chrome 또는 Chromium 기반 브라우저**를 사용하세요!

```
데스크톱 앱 = 모든 브라우저 지원 ✅
웹 버전 = Chrome/Chromium만 지원 ⚠️
```