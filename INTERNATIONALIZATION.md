# 🌍 Internationalization (i18n) Guide

opcode 支持多语言界面，使全球用户都能以母语使用应用程序。本指南说明了项目的国际化架构以及如何为其他语言做出贡献。

## 📊 当前语言支持状态

| 语言 | 代码 | 覆盖率 | 状态 | 贡献者 |
|------|------|--------|------|--------|
| 🇺🇸 英语 | `en` | 100% | ✅ 完成 | 官方 |
| 🇨🇳 简体中文 | `zh-CN` | 93%+ | ✅ 完成 | 贡献者 |
| 🇭🇰 繁体中文 | `zh-TW` | - | 📋 计划中 | - |
| 🇯🇵 日语 | `ja-JP` | - | 📋 计划中 | - |
| 🇰🇷 韩语 | `ko-KR` | - | 📋 计划中 | - |
| 🇪🇸 西班牙语 | `es-ES` | - | 📋 计划中 | - |
| 🇫🇷 法语 | `fr-FR` | - | 📋 计划中 | - |
| 🇩🇪 德语 | `de-DE` | - | 📋 计划中 | - |
| 🇷🇺 俄语 | `ru-RU` | - | 📋 计划中 | - |

## 🏗️ 国际化架构

### 技术栈
- **库**: [react-i18next](https://react.i18next.com/) - React 的强大 i18n 框架
- **格式**: JSON - 易于编辑和维护的翻译文件
- **检测**: 自动浏览器语言检测 + localStorage 持久化
- **切换**: 应用内实时语言切换器

### 文件结构

```
src/
├── locales/                    # 翻译文件目录
│   ├── en.json                # 英语翻译 (377 行，100% 覆盖)
│   ├── zh-CN.json             # 简体中文翻译 (629 行，93%+ 覆盖)
│   ├── ja-JP.json             # 日语翻译 (待创建)
│   └── [其他语言].json         # 其他语言翻译
├── components/
│   ├── LanguageSwitcher.tsx    # 语言切换组件
│   ├── [56+ 已本地化组件]      # 支持 i18n 的组件
│   └── ...
└── i18n.ts                    # i18n 配置文件
```

## 📝 翻译文件结构

### JSON 格式规范

翻译文件使用嵌套 JSON 结构，按功能/组件组织：

```json
{
  "brand": {
    "name": "opcode"
  },
  "common": {
    "cancel": "取消",
    "next": "下一页",
    "save": "保存",
    "delete": "删除"
  },
  "projectSettings": {
    "title": "项目设置",
    "projectSlashCommands": "项目斜杠命令",
    "save": "保存"
  },
  "toolWidgets": {
    "title": "工具小部件",
    "close": "关闭"
  }
  // ... 更多部分
}
```

### 命名约定

- **键名**: 使用 camelCase (例如: `projectSettings`, `failedToLoadHistory`)
- **值**: 中文、日语等目标语言文本
- **结构**: 按组件/功能逻辑分组，而非按字母顺序

### 当前翻译覆盖

**总计**: 56+ 个组件，319+ 个翻译键

#### 组件分类

**P1 - 高频使用 (100% 完成)**
- ErrorBoundary：错误处理
- Topbar：顶部导航栏

**P2 - 核心功能 (100% 完成)**
- ClaudeCodeSession：Claude Code 会话管理
- FilePicker：文件选择器
- StreamMessage：流式消息显示

**P3 - 重要功能 (100% 完成)**
- Agents：代理管理
- AgentRunOutputViewer：代理输出查看器
- SlashCommandPicker：斜杠命令选择器
- ExecutionControlBar：执行控制栏

**P4 - 其他组件 (100% 完成)**
- ProjectSettings、ProxySettings、HooksEditor、MCPServerList
- TabManager、TimelineNavigator、SessionOutputViewer、StorageTab
- FloatingPromptInput (1337 行)、ToolWidgets (3001 行)
- 以及 30+ 个其他组件

## 🚀 为新语言做出贡献

添加新语言的步骤非常简单：

### 第 1 步：复制翻译模板

```bash
# 以日语为例
cp src/locales/en.json src/locales/ja-JP.json
```

### 第 2 步：翻译所有值

编辑 `src/locales/ja-JP.json`，将所有英文翻译为目标语言：

```json
{
  "brand": {
    "name": "opcode"  // 品牌名保持不变
  },
  "common": {
    "cancel": "キャンセル",
    "next": "次へ",
    "save": "保存する",
    "delete": "削除",
    // ... 翻译所有键
  },
  // ... 翻译所有其他部分
}
```

**翻译要点**：
- 保持 JSON 结构完全相同
- 只翻译值（`:` 右侧），不翻译键
- 保留 `{{variable}}` 占位符不变
- 对于有特殊含义的术语，保持与英文版本的一致性

### 第 3 步：验证 JSON 格式

确保 JSON 语法正确（无多余逗号、引号匹配等）：

```bash
# 使用 Node.js 验证
node -e "const json = require('./src/locales/ja-JP.json'); console.log('✓ JSON 格式正确')"
```

### 第 4 步：注册新语言

编辑 `src/i18n.ts`，添加新语言的导入和配置：

```typescript
import en from './locales/en.json';
import zhCN from './locales/zh-CN.json';
import jaJP from './locales/ja-JP.json';  // 新增

const resources = {
  'en': { translation: en },
  'zh-CN': { translation: zhCN },
  'ja-JP': { translation: jaJP },        // 新增
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    // ... 其他配置
  });
```

### 第 5 步：测试语言

1. 启动开发服务器：
```bash
bun run tauri dev
```

2. 点击应用右上角的语言切换器
3. 选择新语言并验证所有翻译都正确显示
4. 检查 UI 布局是否正确（某些语言可能导致文本长度变化）

### 第 6 步：提交 PR

```bash
git checkout -b feat/add-japanese-i18n
git add src/locales/ja-JP.json src/i18n.ts
git commit -m "feat: Add Japanese (ja-JP) language support

- Added complete Japanese translation (ja-JP.json)
- Registered ja-JP in i18n configuration
- Covers 319+ translation keys across 56+ components
- 100% coverage for all current UI elements"
git push origin feat/add-japanese-i18n
```

然后在 GitHub 上创建 Pull Request。

## 💡 最佳实践

### 翻译质量

1. **一致性**: 相同的英文术语应该有一致的翻译
2. **自然性**: 翻译应该听起来自然，而不是机器翻译
3. **完整性**: 翻译所有 319+ 个键，不要留空
4. **审核**: 邀请原生使用者审核翻译

### 术语表

某些技术术语可能需要保持英文或选择标准化的翻译：

| 英文术语 | 中文 | 日语 | 说明 |
|---------|------|------|------|
| Agent | 代理 | エージェント | AI 代理概念 |
| Claude Code | Claude Code | Claude Code | 产品名称，保持原样 |
| Checkpoint | 检查点 | チェックポイント | 会话版本控制 |
| Token | 令牌 | トークン | API 使用单位 |
| MCP Server | MCP 服务器 | MCP サーバー | Model Context Protocol |
| Slash Command | 斜杠命令 | スラッシュコマンド | `/` 开头的命令 |

### 文本长度考虑

不同语言的文本长度差异很大：
- 英语: 基准
- 中文: 通常更短 (60-80%)
- 日语: 中等 (80-120%)
- 德语: 通常更长 (120-150%)
- 俄语: 可能更短 (70-100%)

某些 UI 元素可能需要调整以容纳较长的翻译文本。

## 🔄 翻译维护

### 添加新功能时

1. **更新 JSON 文件**: 将新的翻译键添加到所有语言文件
2. **保持同步**: 确保所有语言文件具有相同的键结构
3. **测试**: 用所有支持的语言测试新功能

### 翻译更新流程

```
开发新功能 → 添加英文翻译 → 提交 PR 前翻译其他语言 → 合并
```

不要合并添加了新 UI 文本但还未翻译的 PR。

## 📊 翻译统计

### 简体中文 (zh-CN) - 完成

- **行数**: 629 行
- **翻译键**: 319+ 个
- **覆盖率**: 93%+
- **组件**: 56 个
- **完成日期**: 2024 年 12 月

### 翻译历史

| Commit | 变更 | 描述 |
|--------|------|------|
| b3a77c0 | +35 键 | P1 高优先级组件 |
| b127bfc | +55 键 | P2 核心功能组件 |
| ed8e7a4 | +50 键 | P3 重要功能组件 |
| 5245101 | +180 键 | P4 剩余组件 (37 个) |

## 🤝 贡献指南

### 翻译贡献者所需技能

- ✅ 目标语言的流利使用者
- ✅ 基本的 JSON 文件编辑能力
- ✅ Git 和 GitHub 的基本了解
- ✅ (可选) 技术术语的理解

### 贡献流程

1. **Fork** 项目到你的 GitHub 账户
2. **创建分支**: `git checkout -b feat/add-[language]-i18n`
3. **添加翻译**: 复制 `en.json` 并翻译
4. **验证**: 确保 JSON 格式正确，在应用中测试
5. **提交 PR**: 描述你的翻译工作和任何特殊考虑

### PR 模板

```markdown
## 添加 [语言] 语言支持

### 完成情况
- [ ] JSON 文件已创建和翻译
- [ ] JSON 格式已验证
- [ ] 已在 i18n.ts 中注册
- [ ] 已在应用中测试所有语言选项
- [ ] 翻译质量已审核

### 统计
- 语言代码: `[xx-XX]`
- 翻译键数: 319+
- 原生使用者审核: [是/否]

### 特殊注意事项
[任何特殊的翻译决定或需要讨论的问题]
```

## 🚀 使用国际化功能

### 作为用户

1. **自动检测**: 应用会自动检测你的浏览器语言
2. **手动切换**: 点击右上角的语言切换器选择其他语言
3. **持久化**: 你的语言选择会被保存到本地存储

### 作为开发者

在组件中使用翻译：

```typescript
import { useTranslation } from 'react-i18next';

export const MyComponent = () => {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t('myComponent.title')}</h1>
      <button>{t('common.save')}</button>
      <p>{t('myComponent.description', { name: 'opcode' })}</p>
    </div>
  );
};
```

### 翻译键命名规范

```typescript
// ✅ 好的：按组件/功能分组
t('projectSettings.title')
t('filePicker.noFilesFound')
t('streamMessage.executionComplete')

// ❌ 不好的：不一致或过于简洁
t('title')
t('noFiles')
t('complete')
```

## 📚 参考资源

- [react-i18next 文档](https://react.i18next.com/)
- [i18next 完整指南](https://www.i18next.com/)
- [JSON 格式验证](https://jsonlint.com/)
- [翻译最佳实践](https://www.w3.org/International/questions/qa-what-is-i18n)

## ❓ 常见问题

### Q: 翻译需要多长时间？
**A**: 翻译 319+ 个键通常需要 2-4 小时，取决于你的翻译速度和语言熟悉程度。

### Q: 我不是原生使用者，可以翻译吗？
**A**: 可以，但建议让原生使用者审核你的翻译以确保质量。

### Q: 如何处理特殊字符和符号？
**A**: 保持原样，JSON 格式支持所有 Unicode 字符。

### Q: 如果某个词在我的语言中没有对应的译法怎么办？
**A**: 可以创建符合你的语言文化的等效表达，或在 PR 中讨论。

### Q: 我是否需要更新 README 或其他文档？
**A**: 是的，请在 INTERNATIONALIZATION.md 的语言表中添加你的语言。

## 🎯 未来计划

- [ ] 添加更多语言支持（日语、韩语、西班牙语等）
- [ ] 实现社区翻译平台集成（如 Crowdin）
- [ ] 添加日期/时间本地化
- [ ] 支持右到左 (RTL) 语言
- [ ] 创建翻译风格指南
- [ ] 建立翻译团队

## 📞 联系方式

有关国际化的问题？

- 📧 通过 GitHub Issues 提出问题
- 💬 加入 [Discord 社区](https://discord.com/invite/KYwhHVzUsY)
- 🤝 参与讨论和贡献

---

感谢所有为 opcode 的国际化做出贡献的人！🌍
