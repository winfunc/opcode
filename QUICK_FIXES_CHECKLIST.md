# ✅ Checklist de Correções Rápidas

## 🚨 Correções Imediatas (< 1 hora cada)

### 1. Bug do PostHog (5 minutos)
- [ ] Abrir `src/main.tsx`
- [ ] Linha 23: Remover `defaults: '2025-05-24',`
- [ ] Substituir por `enabled: false,`
- [ ] Testar inicialização

### 2. Analytics após Consentimento (30 minutos)
- [ ] Modificar `src/main.tsx` para não chamar `analytics.initialize()` automaticamente
- [ ] Mover inicialização para após consentimento em `AnalyticsConsent.tsx`
- [ ] Testar fluxo de consentimento

### 3. Melhorar ErrorBoundary (20 minutos)
- [ ] Adicionar captura de `error.stack` no `componentDidCatch`
- [ ] Adicionar timestamp aos erros
- [ ] Implementar botão "Copiar detalhes do erro"

### 4. Adicionar Validação Básica (45 minutos)
- [ ] Instalar zod: `bun add zod`
- [ ] Criar `src/lib/validation.ts`
- [ ] Validar inputs em `execute_claude_code`
- [ ] Validar paths de arquivo

### 5. Limpar Imports Não Usados (15 minutos)
- [ ] Rodar análise de imports não usados
- [ ] Remover dependências não utilizadas
- [ ] Atualizar package.json

## 🔧 Correções de 1-2 Horas

### 6. Restringir Permissões FS (1 hora)
- [ ] Modificar `tauri.conf.json`
- [ ] Limitar scope para diretórios específicos
- [ ] Adicionar deny list para diretórios sensíveis
- [ ] Testar acesso a arquivos

### 7. Remover Flag Perigosa dos Testes (1 hora)
- [ ] Buscar todos usos de `--dangerously-skip-permissions`
- [ ] Implementar alternativa segura
- [ ] Atualizar testes
- [ ] Verificar se testes ainda passam

### 8. Adicionar Loading States (1.5 horas)
- [ ] Identificar componentes sem loading states
- [ ] Adicionar skeleton screens
- [ ] Melhorar feedback visual
- [ ] Testar UX

## 📊 Melhorias de Performance Rápidas

### 9. React.memo em Componentes (30 minutos)
- [ ] Adicionar React.memo em:
  - [ ] ProjectList
  - [ ] SessionList
  - [ ] FileEntry
  - [ ] AgentCard

### 10. Lazy Loading de Modais (45 minutos)
- [ ] Converter imports para dynamic imports:
  - [ ] AgentsModal
  - [ ] NFOCredits
  - [ ] ClaudeBinaryDialog
  - [ ] Settings

## 🧹 Limpeza de Código

### 11. Remover Código Morto (20 minutos)
- [ ] Remover componentes não utilizados
- [ ] Limpar funções comentadas
- [ ] Remover logs de debug em produção

### 12. Consistência de Tipos (30 minutos)
- [ ] Verificar any types
- [ ] Adicionar tipos faltantes
- [ ] Usar tipos do Tauri onde apropriado

## 🔍 Verificações de Qualidade

### 13. Lint e Format (10 minutos)
```bash
# Rodar em sequência:
bun run check
cd src-tauri && cargo fmt
cd src-tauri && cargo clippy
```

### 14. Build de Produção (15 minutos)
```bash
# Testar build completo:
bun run build
bun run tauri build --debug
```

### 15. Testes Básicos (20 minutos)
- [ ] Testar fluxo de criar novo projeto
- [ ] Testar execução de agente
- [ ] Testar navegação entre views
- [ ] Verificar console por erros

## 📝 Documentação Rápida

### 16. Adicionar Comentários (30 minutos)
- [ ] Documentar funções complexas
- [ ] Adicionar JSDoc em funções públicas
- [ ] Comentar lógica não óbvia

### 17. README de Desenvolvimento (20 minutos)
- [ ] Criar DEVELOPMENT.md
- [ ] Documentar setup local
- [ ] Listar comandos comuns
- [ ] Adicionar troubleshooting

## 🎯 Ordem de Prioridade Sugerida

1. **Crítico** (fazer hoje):
   - Items 1, 2, 3, 4

2. **Importante** (fazer esta semana):
   - Items 6, 7, 11, 13

3. **Melhorias** (próxima semana):
   - Items 8, 9, 10, 12

4. **Nice to have** (quando possível):
   - Items 5, 14, 15, 16, 17

## 💡 Dicas para Implementação

- Fazer commits pequenos e específicos
- Testar cada mudança isoladamente
- Criar branch para cada grupo de correções
- Usar mensagens de commit descritivas
- Rodar testes após cada mudança

## 🚀 Resultado Esperado

Após completar este checklist:
- App mais estável e seguro
- Melhor performance
- Código mais limpo e maintível
- Menos bugs em produção
- Melhor experiência do usuário

---

**Tempo total estimado**: ~10 horas de trabalho focado
**Impacto**: Alto - corrige problemas críticos e melhora qualidade geral