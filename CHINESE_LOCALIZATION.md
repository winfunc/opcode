# 中文本地化说明 (Chinese Localization)

## 概述

本项目为 opcode 添加了完整的中文本地化支持，让中文用户能够更方便地使用这个强大的 Claude Code GUI 工具。

## 功能特性

### 🌐 双语支持
- **英文** (English) - 默认语言
- **中文** (Chinese) - 完整汉化

### 📦 新增内容

1. **国际化架构**
   - 使用 `react-i18next` 和 `i18next` 实现
   - 支持动态语言切换
   - 自动检测系统语言

2. **汉化组件**
   - 欢迎页面 (`Welcome`)
   - 项目列表 (`ProjectList`)
   - 设置页面 (`Settings`)
   - 标题栏 (`CustomTitlebar`)
   - 所有 UI 组件和提示信息

3. **语言文件**
   - `src/i18n/locales/en.json` - 英文翻译
   - `src/i18n/locales/zh.json` - 中文翻译

4. **语言选择器**
   - 在设置页面添加语言切换功能
   - 支持实时切换，无需重启应用
   - 自动保存语言偏好

## 安装使用

### 方式一：直接运行
```bash
# 下载后双击运行
opcode.exe
```

### 方式二：安装版
```bash
# MSI 安装包（推荐）
opcode_0.2.0_x64_en-US.msi

# 或 NSIS 安装包
opcode_0.2.0_x64-setup.exe
```

## 切换语言

1. 打开应用后点击右上角的 **⚙️ 设置** 按钮
2. 在"常规"标签页找到"语言"选项
3. 选择"中文"或"English"
4. 设置会自动保存并立即生效

## 构建说明

### 环境要求
- Node.js 18+
- Rust 1.70+
- Windows 10/11

### 构建步骤

```bash
# 1. 安装依赖
npm install

# 2. 构建前端
npm run build

# 3. 构建 Windows 应用
npm run tauri build
```

### 输出文件
构建完成后，文件位于：
- `src-tauri/target/release/opcode.exe` - 可执行文件
- `src-tauri/target/release/bundle/msi/` - MSI 安装包
- `src-tauri/target/release/bundle/nsis/` - NSIS 安装包

## 技术细节

### 依赖项
```json
{
  "i18next": "^26.0.4",
  "react-i18next": "^17.0.2"
}
```

### 文件结构
```
src/
├── i18n/
│   ├── index.ts              # i18n 配置
│   └── locales/
│       ├── en.json           # 英文翻译
│       └── zh.json           # 中文翻译
├── components/
│   ├── LanguageSelector.tsx  # 语言选择器组件
│   └── ...                   # 其他已汉化组件
```

### 配置修改

1. **tauri.conf.json** - 添加 Windows 构建目标
```json
{
  "bundle": {
    "targets": ["msi", "nsis"]
  }
}
```

2. **package.json** - 添加 i18n 依赖
```json
{
  "dependencies": {
    "i18next": "^26.0.4",
    "react-i18next": "^17.0.2"
  }
}
```

## 贡献指南

如果你想改进中文翻译：

1. 编辑 `src/i18n/locales/zh.json`
2. 遵循 JSON 格式规范
3. 保持键名与英文版本一致
4. 提交 Pull Request

## 致谢

- 原作者：[getAsterisk](https://github.com/getAsterisk)
- 原项目：[opcode](https://github.com/getAsterisk/opcode)
- 本地化贡献者：社区开发者

## 许可证

与原项目保持一致：AGPL-3.0

## 更新日志

### v0.2.0 (2026-04-09)
- ✅ 添加完整中文本地化支持
- ✅ 实现语言切换功能
- ✅ 汉化所有 UI 组件
- ✅ 添加 Windows 安装包构建
- ✅ 优化中文显示效果

## 联系方式

如有问题或建议，欢迎提交 Issue 或 Pull Request。

---

**注意**：本项目基于 opcode 原版进行本地化，所有版权归原作者所有。