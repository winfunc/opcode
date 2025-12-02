# opcode 中文化项目 - 文档导航

> **项目目标**: 为 opcode (Claude Code GUI) 添加完整的中英文双语支持
> **当前状态**: 基础框架已完成，组件翻译进行中
> **总体进度**: 1/84 组件完成 (1.2%)

---

## 🚀 快速开始

### 新手入门（3 步）

1. **阅读紧急修复指南** → `FIX_JSON_ERRORS.md`
   - ⚠️ 必须先修复 JSON 语法错误才能继续

2. **阅读实现指南** → `CHINESE_I18N_GUIDE.md`
   - 了解如何更新组件

3. **开始翻译** → 从 P0 优先级组件开始
   - 参考 `TRANSLATION_PROGRESS.md` 选择任务

### 老手继续（直接开始）

```bash
# 1. 检查当前进度
cat TRANSLATION_PROGRESS.md

# 2. 选择下一个组件
# 当前: ProjectList.tsx (P0 优先级)

# 3. 更新组件（参考 CustomTitlebar.tsx 示例）

# 4. 测试
cd C:\Users\zhu\opcode
"$HOME/.bun/bin/bun.exe" run tauri dev
```

---

## 📚 文档结构

### 🔴 紧急文档

#### [FIX_JSON_ERRORS.md](FIX_JSON_ERRORS.md) ⚠️
**必读！阻塞问题修复指南**
- 修复 zh-CN.json 中的中文引号
- 4 处错误的精确位置
- 详细修复步骤
- 验证方法

---

### 📖 核心文档

#### [TRANSLATION_PLAN.md](TRANSLATION_PLAN.md) 📋
**完整项目规划和规则**
- 项目概览和文件结构
- 详细的翻译规则
- 技术术语表
- 组件更新标准流程
- 质量检查标准

**适用于**: 所有参与者必读

---

#### [CHINESE_I18N_GUIDE.md](CHINESE_I18N_GUIDE.md) 🔧
**实现指南和技术文档**
- 如何在组件中使用 i18n
- 带变量的翻译示例
- 添加语言切换器的方法
- 更新组件的详细步骤
- 常见问题解答

**适用于**: 开发者和翻译者

---

#### [TRANSLATION_PROGRESS.md](TRANSLATION_PROGRESS.md) 📊
**进度追踪表**
- 实时更新的翻译进度
- 优先级分组
- 每日进度更新
- 完整的 84 个组件列表
- 贡献者签到

**适用于**: 所有人（查看进度和认领任务）

---

### 🧪 测试文档

#### [CHINESE_SUPPORT_TEST.md](CHINESE_SUPPORT_TEST.md) ✅
**测试和使用说明**
- 如何测试语言切换
- 当前已翻译的功能
- 测试步骤
- 如何继续完善
- 常见问题排查

**适用于**: 测试人员和用户

---

## 🎯 工作流程

### 标准翻译流程

```
1. 查看进度表 (TRANSLATION_PROGRESS.md)
   ↓
2. 选择一个待翻译组件
   ↓
3. 查看翻译规则 (TRANSLATION_PLAN.md)
   ↓
4. 参考实现指南更新组件 (CHINESE_I18N_GUIDE.md)
   ↓
5. 测试功能 (CHINESE_SUPPORT_TEST.md)
   ↓
6. 更新进度表 ✅
```

### 第一次参与？

1. ✅ **先修复阻塞问题**: 阅读 `FIX_JSON_ERRORS.md`
2. 📖 **了解规则**: 阅读 `TRANSLATION_PLAN.md`（20分钟）
3. 🔧 **学习方法**: 阅读 `CHINESE_I18N_GUIDE.md`（15分钟）
4. 👀 **查看示例**: 打开 `src/components/CustomTitlebar.tsx`
5. 🎯 **选择任务**: 从 `TRANSLATION_PROGRESS.md` 选择 P0 组件
6. 💻 **开始翻译**: 更新你的第一个组件！

---

## 📂 项目文件位置

### 文档文件
```
opcode/
├── FIX_JSON_ERRORS.md           # 🔴 紧急修复指南
├── TRANSLATION_PLAN.md          # 📋 完整规划
├── CHINESE_I18N_GUIDE.md        # 🔧 实现指南
├── TRANSLATION_PROGRESS.md      # 📊 进度追踪
├── CHINESE_SUPPORT_TEST.md      # ✅ 测试说明
└── TRANSLATION_INDEX.md         # 📚 本文档
```

### 源代码文件
```
opcode/src/
├── i18n.ts                      # ✅ i18n 配置
├── main.tsx                     # ✅ 已导入 i18n
├── locales/
│   ├── en.json                  # ✅ 英文翻译
│   └── zh-CN.json               # ⚠️ 待修复语法错误
└── components/
    ├── LanguageSwitcher.tsx     # ✅ 语言切换器
    ├── CustomTitlebar.tsx       # ✅ 已完成示例
    └── ... (83 个待翻译)
```

---

## ⚡ 快速参考

### 当前状态速览

| 项目 | 状态 | 位置 |
|------|------|------|
| i18n 框架 | ✅ 完成 | `src/i18n.ts` |
| 英文翻译 | ✅ 完成 | `src/locales/en.json` |
| 中文翻译 | ⚠️ 有错误 | `src/locales/zh-CN.json` |
| 语言切换器 | ✅ 完成 | `src/components/LanguageSwitcher.tsx` |
| 示例组件 | ✅ 完成 | `src/components/CustomTitlebar.tsx` |
| 组件翻译 | ⏳ 1/84 | 见进度表 |

### 下一步行动

1. ⚠️ **紧急**: 修复 `zh-CN.json` 语法错误
2. ⏳ **P0**: 翻译 `ProjectList.tsx`
3. ⏳ **P0**: 翻译 `SessionList.tsx`
4. ⏳ **P0**: 翻译 `Settings.tsx`
5. ⏳ **P0**: 翻译 `StartupIntro.tsx`

### 关键规则（记住这些）

✅ **必须做**:
- 使用英文引号 `"key": "value"`
- 转义内部引号 `"包含 \"引用\" 文本"`
- 保留占位符 `{{variable}}`
- 保持技术术语英文（Claude, API, JSON 等）

❌ **禁止做**:
- 使用中文引号 `""`
- 翻译占位符 `{{名称}}`
- 翻译路径 `~/.claude`
- 翻译代码 `import`, `export`

---

## 🎓 学习路径

### 初级（0-1小时）
- [ ] 阅读 `FIX_JSON_ERRORS.md`
- [ ] 修复 JSON 错误
- [ ] 阅读 `TRANSLATION_PLAN.md` 的"翻译规则"部分
- [ ] 查看 `CustomTitlebar.tsx` 示例

### 中级（1-3小时）
- [ ] 完整阅读 `CHINESE_I18N_GUIDE.md`
- [ ] 翻译第一个简单组件（ProjectList）
- [ ] 测试语言切换
- [ ] 更新进度表

### 高级（3+小时）
- [ ] 翻译复杂组件（Settings, UsageDashboard）
- [ ] 添加新的翻译字符串
- [ ] 优化翻译质量
- [ ] 帮助审核其他翻译

---

## 🤝 贡献指南

### 认领任务

1. 打开 `TRANSLATION_PROGRESS.md`
2. 找到状态为 ⏳ 的组件
3. 在表格中填写你的名字
4. 更新状态为 🔄
5. 开始翻译！

### 完成任务

1. 更新组件代码
2. 测试功能正常
3. 更新 `TRANSLATION_PROGRESS.md`
4. 标记状态为 ✅
5. 填写完成日期

### 质量标准

- [ ] 代码可以构建
- [ ] 语言切换正常
- [ ] 中文翻译准确
- [ ] 遵守翻译规则
- [ ] 更新了进度表

---

## 💡 提示和技巧

### 提高效率
- 使用 VS Code 的多光标功能批量替换
- 使用 i18n Ally 插件预览翻译
- 先翻译简单的组件建立信心
- 参考已完成的 CustomTitlebar.tsx

### 避免常见错误
- 先验证 JSON 格式再提交
- 翻译前先阅读完整的组件代码
- 注意复数形式和动态变量
- 保持翻译一致性（使用术语表）

### 遇到问题？
1. 检查 `CHINESE_I18N_GUIDE.md` 的常见问题
2. 对比 `CustomTitlebar.tsx` 的实现
3. 验证 JSON 文件格式
4. 运行构建查看错误信息

---

## 📞 支持和资源

### 相关链接
- [opcode GitHub](https://github.com/winfunc/opcode)
- [i18next 文档](https://www.i18next.com/)
- [react-i18next 文档](https://react.i18next.com/)

### 测试命令
```bash
# 开发模式
cd C:\Users\zhu\opcode
"$HOME/.bun/bin/bun.exe" run tauri dev

# 构建生产版
"$HOME/.bun/bin/bun.exe" run build
cargo build --release --manifest-path src-tauri/Cargo.toml
```

---

## 📊 项目统计

- **总组件数**: 84
- **已完成**: 1 (CustomTitlebar + LanguageSwitcher)
- **进行中**: 0
- **待开始**: 83
- **翻译字符串**: 180+ (主要模块)
- **预计总工时**: 40-60 小时
- **预计完成**: 根据参与人数

---

## ✨ 里程碑

- ✅ **M1**: 基础框架完成 (2025-12-01)
- ⏳ **M2**: 修复阻塞问题
- ⏳ **M3**: P0 组件完成 (5个)
- ⏳ **M4**: P1 组件完成 (10个)
- ⏳ **M5**: P2 组件完成 (15个)
- ⏳ **M6**: 全部组件完成 (84个)

---

## 🎉 致谢

感谢所有参与 opcode 中文化项目的贡献者！

**当前贡献者**:
- Claude v1 (2025-12-01): 基础框架 + CustomTitlebar

---

**最后更新**: 2025-12-01
**文档维护**: 请在完成重要工作后更新本文档
