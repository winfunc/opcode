# opcode 中文翻译项目 - 完整计划和规则文档

> **文档版本**: v1.0
> **创建日期**: 2025-12-01
> **项目状态**: 基础框架已完成，组件翻译进行中

## 📋 项目概览

### 目标
为 opcode 项目（Claude Code 的 GUI 管理工具）添加完整的中英文双语支持。

### 当前进度
- ✅ **已完成**: i18n 框架搭建（100%）
- ✅ **已完成**: 翻译文件准备（主要模块 180+ 字符串）
- ✅ **已完成**: 语言切换器实现
- ✅ **已完成**: 示例组件更新（CustomTitlebar）
- ⚠️ **待修复**: zh-CN.json 文件中的 JSON 语法错误
- ⏳ **进行中**: 更新其余 83 个组件

### 文件结构
```
opcode/
├── src/
│   ├── i18n.ts                           # ✅ i18n 配置文件
│   ├── main.tsx                          # ✅ 已导入 i18n
│   ├── locales/
│   │   ├── en.json                       # ✅ 英文翻译
│   │   └── zh-CN.json                    # ⚠️ 需修复语法错误
│   └── components/
│       ├── LanguageSwitcher.tsx          # ✅ 语言切换器
│       ├── CustomTitlebar.tsx            # ✅ 已完成翻译
│       ├── ProjectList.tsx               # ⏳ 待翻译
│       ├── SessionList.tsx               # ⏳ 待翻译
│       ├── Settings.tsx                  # ⏳ 待翻译
│       ├── CCAgents.tsx                  # ⏳ 待翻译
│       ├── UsageDashboard.tsx            # ⏳ 待翻译
│       ├── MCPManager.tsx                # ⏳ 待翻译
│       └── ... (共 84 个组件)
├── CHINESE_I18N_GUIDE.md                 # ✅ 实现指南
├── CHINESE_SUPPORT_TEST.md               # ✅ 测试说明
└── TRANSLATION_PLAN.md                   # 📄 本文档
```

---

## 🚨 紧急任务：修复 JSON 语法错误

### 问题描述
`src/locales/zh-CN.json` 文件中使用了**中文引号** `""`，必须替换为**英文引号** `""`。

### 需要修复的位置

#### 错误 1: 第 90 行
```json
// ❌ 错误
"label": "包含 "由 Claude 共同编写""

// ✅ 正确
"label": "包含 \"由 Claude 共同编写\""
```

#### 错误 2: 第 199 行
```json
// ❌ 错误
"exportSuccess": "代理 "{{name}}" 导出成功"

// ✅ 正确
"exportSuccess": "代理 \"{{name}}\" 导出成功"
```

#### 错误 3: 第 207 行
```json
// ❌ 错误
"description": "确定要删除代理 "{{name}}" 吗？"

// ✅ 正确
"description": "确定要删除代理 \"{{name}}\" 吗？"
```

#### 错误 4: 第 277 行（mcp 部分）
```json
// ❌ 错误
"serverRemoveSuccess": "服务器 "{{name}}" 删除成功！"

// ✅ 正确
"serverRemoveSuccess": "服务器 \"{{name}}\" 删除成功！"
```

### 修复方法
使用查找替换功能：
1. 打开 `src/locales/zh-CN.json`
2. 查找所有中文左引号 `"` 替换为 `\"`
3. 查找所有中文右引号 `"` 替换为 `\"`
4. 保存文件

---

## 📐 翻译规则

### 1. JSON 文件规则

#### ✅ 必须遵守
- **使用英文引号**: `"key": "value"`
- **转义内部引号**: `"text": "这是 \"引用\" 文本"`
- **保留占位符**: `{{variable}}` 不要翻译
- **保留 HTML 标签**: 如 `<strong>` 等
- **保留特殊符号**: `/`, `:`, `-` 等

#### ❌ 禁止事项
- 不使用中文引号 `""` 或 `''`
- 不翻译变量名 `{{name}}`, `{{count}}` 等
- 不翻译技术术语（见下方术语表）
- 不改变 JSON 结构

#### 示例
```json
{
  "good": {
    "title": "项目列表",
    "description": "选择一个项目以开始",
    "count": "共 {{count}} 个项目",
    "path": "路径: ~/.claude/projects"
  },
  "bad": {
    "title": "项目列表",  // ❌ 中文引号
    "description": "选择一个项目以开始",
    "count": "共 {{总数}} 个项目",  // ❌ 翻译了占位符
    "path": "路径: ~/克劳德/项目"  // ❌ 翻译了路径
  }
}
```

### 2. 技术术语表

以下术语**不翻译**，保持英文原文：

#### 品牌和产品名
- `Claude`
- `Claude Code`
- `opcode`
- `Anthropic`
- `GitHub`
- `Tauri`
- `MCP` (Model Context Protocol)

#### 技术术语
- `API`
- `JSON`
- `OAuth`
- `WebView`
- `token` (令牌上下文可翻译为"令牌")
- `cache`
- `session`
- `bash`
- `npm`
- `git`

#### 文件和路径
- `~/.claude`
- `CLAUDE.md`
- `.opcode.json`
- `package.json`
- `settings.json`

#### 代码相关
- `hex`, `rgb`, `oklch` (颜色格式)
- `true`, `false`, `null`
- `import`, `export`

### 3. 翻译风格指南

#### 语气和用词
- ✅ **使用简洁明了的中文**
- ✅ **保持友好、专业的语气**
- ✅ **使用"您"而非"你"**（更正式）
- ✅ **动词在前，更直接**: "保存设置" 而非 "设置保存"

#### 标点符号
- 使用中文标点：`，。？！：`
- 英文缩写后使用英文标点: `API。`
- 省略号使用: `...` 或 `……`

#### 常见翻译对照

| 英文 | 中文 | 备注 |
|------|------|------|
| Settings | 设置 | |
| Save | 保存 | |
| Cancel | 取消 | |
| Delete | 删除 | |
| Edit | 编辑 | |
| Create | 创建 | |
| Import | 导入 | |
| Export | 导出 | |
| Loading... | 加载中... | 保留省略号 |
| Failed to... | ...失败 | |
| Successfully... | ...成功 | |
| Are you sure? | 确定吗？ | |
| Dashboard | 仪表板/概览 | 根据上下文 |
| Usage | 使用情况 | |
| Project | 项目 | |
| Session | 会话 | |
| Agent | 代理 | |
| Permission | 权限 | |
| Environment | 环境 | |
| Advanced | 高级 | |
| General | 通用/常规 | |

---

## 📝 组件翻译工作流程

### 阶段一：准备工作（已完成 ✅）
- [x] 安装 i18n 依赖
- [x] 创建 i18n 配置文件
- [x] 创建翻译文件（en.json, zh-CN.json）
- [x] 实现语言切换器组件
- [x] 更新 main.tsx 导入 i18n

### 阶段二：修复语法错误（待完成 ⚠️）
- [ ] 修复 zh-CN.json 中的中文引号
- [ ] 验证 JSON 文件格式正确
- [ ] 测试构建是否成功

### 阶段三：组件翻译（进行中 ⏳）

#### 优先级 P0（最常用，优先翻译）
1. [ ] **CustomTitlebar.tsx** ✅ 已完成
2. [ ] **ProjectList.tsx** - 项目列表页
3. [ ] **SessionList.tsx** - 会话列表
4. [ ] **Settings.tsx** - 设置页面
5. [ ] **StartupIntro.tsx** - 启动欢迎页

#### 优先级 P1（核心功能）
6. [ ] **CCAgents.tsx** - 代理管理主页
7. [ ] **CreateAgent.tsx** - 创建代理
8. [ ] **AgentExecution.tsx** - 代理执行
9. [ ] **UsageDashboard.tsx** - 使用情况仪表板
10. [ ] **MCPManager.tsx** - MCP 服务器管理

#### 优先级 P2（次要功能）
11. [ ] **ClaudeCodeSession.tsx** - 会话详情
12. [ ] **MarkdownEditor.tsx** - Markdown 编辑器
13. [ ] **FilePicker.tsx** - 文件选择器
14. [ ] **TabManager.tsx** - 标签管理
15. [ ] **ProjectSettings.tsx** - 项目设置

#### 优先级 P3（其他组件）
- 剩余 69 个组件按需翻译

---

## 🔧 组件更新标准流程

### 步骤 1: 识别需要翻译的文本
在组件中查找所有硬编码的用户可见文本：
- 按钮标签
- 标题和描述
- 占位符文本
- 错误/成功消息
- 工具提示
- 对话框内容

### 步骤 2: 添加翻译键到 JSON
如果翻译键不存在，添加到 `en.json` 和 `zh-CN.json`：

```json
// en.json
{
  "projects": {
    "newKey": "New text in English"
  }
}

// zh-CN.json
{
  "projects": {
    "newKey": "新的中文文本"
  }
}
```

### 步骤 3: 更新组件代码

#### 3.1 导入 useTranslation
```typescript
import { useTranslation } from 'react-i18next';
```

#### 3.2 在组件中使用
```typescript
export const MyComponent = () => {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t('projects.title')}</h1>
      <p>{t('projects.description')}</p>
    </div>
  );
};
```

#### 3.3 处理动态内容
```typescript
// 简单变量
<span>{t('projects.count', { count: projectCount })}</span>

// 多个变量
<p>{t('usage.showing', { start: 1, end: 10, total: 100 })}</p>

// 日期
<time>{t('sessions.sessionOn', { date: formattedDate })}</time>
```

### 步骤 4: 测试
```bash
# 开发模式测试
cd opcode
"$HOME/.bun/bin/bun.exe" run tauri dev

# 测试语言切换
# 1. 点击标题栏的语言切换器
# 2. 切换到中文
# 3. 验证更新的组件显示中文
# 4. 切换回英文确认正常
```

---

## 📋 组件翻译检查清单

为每个组件创建类似的清单：

### 组件: ProjectList.tsx

#### 需要翻译的元素
- [ ] 页面标题: "Projects"
- [ ] 描述文本: "Select a project..."
- [ ] 按钮: "Open Project"
- [ ] 章节标题: "Recent Projects"
- [ ] 链接: "View all", "View less"
- [ ] 空状态标题: "No recent projects"
- [ ] 空状态描述: "Open a project to..."
- [ ] 空状态按钮: "Open Your First Project"

#### 翻译键映射
| 原文 | 翻译键 | 中文 |
|------|--------|------|
| Projects | `projects.title` | 项目 |
| Select a project... | `projects.description` | 选择一个项目... |
| ... | ... | ... |

#### 代码位置
- 文件: `src/components/ProjectList.tsx`
- 行号: 待确认
- 状态: ⏳ 待开始

---

## 🎯 质量检查标准

### 编译检查
```bash
# 运行 TypeScript 检查
cd opcode
bun run build

# 应该没有错误
# ✅ 成功: 无 TS 错误
# ❌ 失败: 修复所有错误后再继续
```

### 功能检查
- [ ] 语言切换器可见且可点击
- [ ] 切换到中文，所有更新的文本显示中文
- [ ] 切换到英文，所有文本显示英文
- [ ] 重启应用，语言设置保持
- [ ] 动态内容（如计数、日期）正确显示

### 翻译质量检查
- [ ] 所有技术术语保持英文
- [ ] 占位符 `{{variable}}` 未被翻译
- [ ] 中文语句通顺、符合习惯
- [ ] 标点符号使用正确
- [ ] 无错别字

---

## 📦 交接信息

### 当前状态
- ✅ 基础框架：100% 完成
- ⚠️ JSON 语法：需要修复 4 处中文引号
- ⏳ 组件翻译：1/84 完成（CustomTitlebar）

### 下一步行动
1. **立即任务**: 修复 `zh-CN.json` 的语法错误
2. **短期目标**: 完成 P0 优先级的 5 个组件
3. **中期目标**: 完成 P1 优先级的 10 个组件
4. **长期目标**: 完成所有 84 个组件

### 需要的技能
- JSON 格式理解
- React 和 TypeScript 基础
- i18next 使用经验（有指南）
- 中英文翻译能力

### 预估工作量
- 修复 JSON 错误: 10 分钟
- 每个简单组件: 15-30 分钟
- 每个复杂组件: 30-60 分钟
- 总计 84 个组件: 约 40-60 小时

### 重要文件
- **规则文档**: `TRANSLATION_PLAN.md`（本文件）
- **实现指南**: `CHINESE_I18N_GUIDE.md`
- **测试说明**: `CHINESE_SUPPORT_TEST.md`
- **英文翻译**: `src/locales/en.json`
- **中文翻译**: `src/locales/zh-CN.json`
- **示例组件**: `src/components/CustomTitlebar.tsx`

---

## 📞 支持和参考

### 相关文档
1. [i18next 官方文档](https://www.i18next.com/)
2. [react-i18next 文档](https://react.i18next.com/)
3. [opcode GitHub 仓库](https://github.com/winfunc/opcode)

### 常见问题
参见 `CHINESE_I18N_GUIDE.md` 的"常见问题"章节

### 测试命令
```bash
# 开发模式
cd C:\Users\zhu\opcode
"$HOME/.bun/bin/bun.exe" run tauri dev

# 构建生产版
cd C:\Users\zhu\opcode
"$HOME/.bun/bin/bun.exe" run build
cargo build --release --manifest-path src-tauri/Cargo.toml
```

---

## ✅ 完成标准

项目完成当满足以下条件：

1. ✅ 所有 JSON 文件格式正确，无语法错误
2. ✅ 所有 84 个组件已更新
3. ✅ 所有翻译已审核，无错别字
4. ✅ 应用可以正常构建
5. ✅ 语言切换功能正常
6. ✅ 所有页面的中文显示正确
7. ✅ 测试文档已更新

---

**文档维护者**: 请在完成任务后更新此文档的进度部分。

**最后更新**: 2025-12-01
