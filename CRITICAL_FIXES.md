# 🔧 Correções Críticas - Exemplos de Código

Este documento fornece exemplos de código para implementar as correções críticas identificadas no plano de melhorias.

## 1. Correção da Configuração do PostHog

### Arquivo: `src/main.tsx`

**Problema atual (linha 23):**
```tsx
defaults: '2025-05-24',
```

**Correção:**
```tsx
// src/main.tsx
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <PostHogProvider
      apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY}
      options={{
        api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
        enabled: false, // Desabilitado por padrão até consentimento
        capture_exceptions: true,
        debug: import.meta.env.MODE === "development",
      }}
    >
      <ErrorBoundary>
        <AnalyticsErrorBoundary>
          <App />
        </AnalyticsErrorBoundary>
      </ErrorBoundary>
    </PostHogProvider>
  </React.StrictMode>,
);
```

## 2. Analytics com Consentimento

### Arquivo: `src/lib/analytics/index.ts`

**Adicionar verificação de consentimento:**
```typescript
export class Analytics {
  private hasUserConsent: boolean = false;

  async initialize() {
    // Verificar consentimento salvo
    const settings = await this.loadSettings();
    this.hasUserConsent = settings?.hasConsented || false;
    
    if (!this.hasUserConsent) {
      // Não inicializar analytics até consentimento
      return;
    }
    
    // Inicializar apenas após consentimento
    this.initializePostHog();
  }

  async enable() {
    this.hasUserConsent = true;
    await this.saveSettings({ hasConsented: true });
    this.initializePostHog();
  }

  async disable() {
    this.hasUserConsent = false;
    await this.saveSettings({ hasConsented: false });
    posthog.opt_out_capturing();
  }
}
```

## 3. Restrição de Permissões do Sistema de Arquivos

### Arquivo: `src-tauri/tauri.conf.json`

**Configuração atual (muito permissiva):**
```json
"fs": {
  "scope": ["$HOME/**"]
}
```

**Configuração recomendada:**
```json
"fs": {
  "scope": [
    "$HOME/.claude/**",
    "$HOME/.claudia/**",
    "$DOCUMENT/**",
    "$DESKTOP/**"
  ],
  "allow": [
    "readFile",
    "writeFile",
    "readDir",
    "exists"
  ],
  "deny": [
    "$HOME/.ssh/**",
    "$HOME/.gnupg/**",
    "$HOME/.aws/**",
    "$HOME/.config/gcloud/**"
  ]
}
```

## 4. Remover Flag Perigosa

### Arquivo: `src-tauri/src/commands/claude.rs`

**Código atual (linha 839):**
```rust
"--dangerously-skip-permissions".to_string(),
```

**Correção com confirmação do usuário:**
```rust
// Adicionar função para pedir confirmação
async fn request_user_permission(
    app: &AppHandle,
    operation: &str,
) -> Result<bool, String> {
    use tauri::api::dialog::{MessageDialogBuilder, MessageDialogKind};
    
    let result = MessageDialogBuilder::new(
        "Permissão Necessária",
        &format!("Claude Code precisa executar: {}\n\nDeseja permitir?", operation)
    )
    .kind(MessageDialogKind::Warning)
    .buttons(tauri::api::dialog::MessageDialogButtons::OkCancel)
    .show(|result| result);
    
    Ok(result)
}

// Modificar execute_claude_code
pub async fn execute_claude_code(
    app: AppHandle,
    project_path: String,
    prompt: String,
    model: String,
) -> Result<(), String> {
    // Pedir permissão ao usuário
    if !request_user_permission(&app, &format!("Executar Claude em {}", project_path)).await? {
        return Err("Operação cancelada pelo usuário".to_string());
    }
    
    let claude_path = find_claude_binary(&app)?;
    
    let args = vec![
        "-p".to_string(),
        prompt.clone(),
        "--model".to_string(),
        model.clone(),
        "--output-format".to_string(),
        "stream-json".to_string(),
        "--verbose".to_string(),
        // Removido: "--dangerously-skip-permissions"
    ];
    
    // ... resto do código
}
```

## 5. Melhorar Content Security Policy

### Arquivo: `src-tauri/tauri.conf.json`

**CSP atual (insegura):**
```json
"csp": "default-src 'self'; ... script-src 'self' 'unsafe-eval' ..."
```

**CSP recomendada:**
```json
"csp": {
  "default-src": ["'self'"],
  "img-src": ["'self'", "asset:", "https://asset.localhost", "blob:", "data:"],
  "style-src": ["'self'", "'nonce-{NONCE}'"],
  "script-src": ["'self'", "'nonce-{NONCE}'", "https://app.posthog.com"],
  "connect-src": [
    "'self'",
    "ipc:",
    "https://ipc.localhost",
    "https://app.posthog.com",
    "https://*.posthog.com"
  ],
  "font-src": ["'self'"],
  "media-src": ["'self'"]
}
```

**Adicionar geração de nonce no backend:**
```rust
// src-tauri/src/main.rs
use base64::{engine::general_purpose, Engine};
use rand::Rng;

fn generate_csp_nonce() -> String {
    let random_bytes: [u8; 16] = rand::thread_rng().gen();
    general_purpose::STANDARD.encode(random_bytes)
}

// Injetar nonce no HTML
fn inject_nonce_to_html(html: &str, nonce: &str) -> String {
    html.replace("{NONCE}", nonce)
}
```

## 6. Melhorar ErrorBoundary

### Arquivo: `src/components/ErrorBoundary.tsx`

**Adicionar captura de stack trace completo:**
```tsx
interface ErrorInfo {
  componentStack: string;
  digest?: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Capturar informações detalhadas
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      digest: errorInfo.digest,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };
    
    // Log detalhado
    console.error("Error caught by boundary:", errorDetails);
    
    // Enviar para sistema de monitoramento (se consentido)
    if (analytics.hasConsent()) {
      analytics.trackError(errorDetails);
    }
    
    // Salvar localmente para debugging
    this.saveErrorToLocalStorage(errorDetails);
  }
  
  private saveErrorToLocalStorage(error: any) {
    try {
      const errors = JSON.parse(localStorage.getItem('claudia_errors') || '[]');
      errors.push(error);
      // Manter apenas últimos 10 erros
      if (errors.length > 10) errors.shift();
      localStorage.setItem('claudia_errors', JSON.stringify(errors));
    } catch (e) {
      console.error('Failed to save error:', e);
    }
  }
}
```

## 7. Validação de Input

### Exemplo de validação para comandos

```typescript
// src/lib/validation.ts
import { z } from 'zod';

// Schema para validar caminhos de arquivo
const FilePathSchema = z.string()
  .min(1, "Path cannot be empty")
  .refine((path) => !path.includes('..'), "Path traversal not allowed")
  .refine((path) => !path.includes('\0'), "Null bytes not allowed");

// Schema para comandos
const CommandSchema = z.object({
  projectPath: FilePathSchema,
  prompt: z.string().max(10000, "Prompt too long"),
  model: z.enum(['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku']),
});

// Função de validação
export function validateCommand(data: unknown) {
  try {
    return CommandSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
}
```

## 8. Rate Limiting

### Implementar rate limiting básico

```rust
// src-tauri/src/rate_limit.rs
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

pub struct RateLimiter {
    requests: Mutex<HashMap<String, Vec<Instant>>>,
    max_requests: usize,
    window: Duration,
}

impl RateLimiter {
    pub fn new(max_requests: usize, window: Duration) -> Self {
        Self {
            requests: Mutex::new(HashMap::new()),
            max_requests,
            window,
        }
    }
    
    pub fn check_rate_limit(&self, key: &str) -> Result<(), String> {
        let mut requests = self.requests.lock().unwrap();
        let now = Instant::now();
        
        let user_requests = requests.entry(key.to_string()).or_insert_with(Vec::new);
        
        // Remove requisições antigas
        user_requests.retain(|&instant| now.duration_since(instant) < self.window);
        
        if user_requests.len() >= self.max_requests {
            return Err("Rate limit exceeded".to_string());
        }
        
        user_requests.push(now);
        Ok(())
    }
}
```

## Implementação Prioritária

1. **Imediato**: Corrigir configuração PostHog e analytics
2. **Próxima semana**: Implementar restrições de permissões
3. **Duas semanas**: Remover flags perigosas e melhorar CSP
4. **Contínuo**: Adicionar validações e melhorar tratamento de erros

Essas correções devem ser implementadas e testadas cuidadosamente antes do próximo release.