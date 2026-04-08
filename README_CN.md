# opcode - 中文本地化版

[![GitHub stars](https://img.shields.io/github/stars/getAsterisk/opcode)](https://github.com/getAsterisk/opcode)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue)](LICENSE)
[![中文](https://img.shields.io/badge/语言-中文-red)](README_CN.md)

> 🌐 **中文本地化版本** | [English](README.md)

一个强大的 Claude Code GUI 应用程序和工具包，现已支持中文界面！

![opcode 界面预览](https://github.com/getAsterisk/opcode/raw/main/.github/assets/screenshot.png)

## ✨ 功能特性

### 🗂️ 项目与会话管理
- 📁 可视化项目浏览器
- 📝 会话历史记录
- 🔍 智能搜索功能
- 📊 会话元数据查看

### 🤖 CC 代理系统
- 🎯 自定义 AI 代理
- 📚 代理库管理
- ⚡ 后台执行
- 📈 执行历史追踪

### 📊 使用分析仪表板
- 💰 成本追踪
- 🔢 令牌分析
- 📉 可视化图表
- 📤 数据导出

### 🔌 MCP 服务器管理
- 🖥️ 服务器注册表
- ⚙️ 简单配置
- 🔗 连接测试
- 📥 配置导入

### ⏰ 时间线与检查点
- 🔄 会话版本控制
- 🌳 可视化时间线
- ⏪ 即时恢复
- 🌿 会话分支

### 🌐 中文本地化
- ✅ 完整中文界面
- 🔄 双语切换
- 📝 中文文档
- 🎨 优化中文显示

## 🚀 快速开始

### 下载安装

#### 方式一：MSI 安装包（推荐）
```bash
# 下载并运行
opcode_0.2.0_x64_en-US.msi
```

#### 方式二：便携版
```bash
# 下载后直接运行
opcode.exe
```

### 切换中文

1. 打开应用
2. 点击右上角 ⚙️ **设置**
3. 选择"常规" → "语言"
4. 选择"中文"
5. 设置自动保存

### 配置 Claude Code

1. 确保已安装 [Claude Code CLI](https://claude.ai/code)
2. 在设置中配置 API 密钥
3. 开始使用！

## 📖 使用指南

### 项目管理
```
项目 → 选择项目 → 查看会话 → 恢复或新建
```

### 创建代理
```
代理 → 创建代理 → 配置 → 执行
```

### 查看使用情况
```
菜单 → 使用情况 → 查看分析
```

## 🛠️ 从源码构建

### 环境要求
- Node.js 18+
- Rust 1.70+
- Windows 10/11

### 构建步骤

```bash
# 1. 克隆仓库
git clone https://github.com/getAsterisk/opcode.git
cd opcode

# 2. 安装依赖
npm install

# 3. 构建前端
npm run build

# 4. 构建 Windows 应用
npm run tauri build
```

### 输出文件
- `src-tauri/target/release/opcode.exe` - 可执行文件
- `src-tauri/target/release/bundle/msi/` - MSI 安装包
- `src-tauri/target/release/bundle/nsis/` - NSIS 安装包

## 📁 项目结构

```
opcode/
├── src/                    # React 前端
│   ├── components/         # UI 组件
│   ├── i18n/              # 国际化文件
│   │   ├── locales/
│   │   │   ├── en.json    # 英文翻译
│   │   │   └── zh.json    # 中文翻译
│   └── lib/               # 工具库
├── src-tauri/             # Rust 后端
│   └── src/
└── cc_agents/             # 代理配置
```

## 🌐 国际化

本项目使用 `react-i18next` 实现国际化支持。

### 添加新语言

1. 在 `src/i18n/locales/` 创建新的 JSON 文件
2. 复制 `en.json` 的内容并翻译
3. 在 `src/i18n/index.ts` 中导入新语言

### 翻译文件示例

```json
{
  "welcome": {
    "title": "欢迎使用 opcode",
    "projects": "项目"
  }
}
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 贡献步骤

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 AGPL-3.0 许可证 - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- 原作者：[getAsterisk](https://github.com/getAsterisk)
- 原项目：[opcode](https://github.com/getAsterisk/opcode)
- Claude Code by [Anthropic](https://www.anthropic.com/)

## 📞 联系方式

- GitHub Issues: [提交问题](https://github.com/getAsterisk/opcode/issues)
- 原项目地址：https://github.com/getAsterisk/opcode

## 📝 更新日志

### v0.2.0 (2026-04-09)
- ✅ 添加完整中文本地化支持
- ✅ 实现语言切换功能
- ✅ 汉化所有 UI 组件
- ✅ 添加 Windows 安装包
- ✅ 优化中文显示效果

---

**注意**：本项目基于 opcode 原版进行本地化，所有版权归原作者所有。

**免责声明**：本项目与 Anthropic 无关，Claude 是 Anthropic 的商标。