# Release Notes - Chinese Localization v0.2.0

## 🎉 中文本地化版本发布

我们很高兴发布 opcode 的中文本地化版本！这个版本为中文用户提供了完整的中文界面支持。

## ✨ 主要更新

### 🌐 国际化支持
- **双语界面** - 支持中文和英文无缝切换
- **自动语言检测** - 根据系统语言自动选择默认语言
- **实时切换** - 无需重启应用即可切换语言

### 📦 安装包
- **MSI 安装包** - 标准 Windows 安装程序
- **NSIS 安装包** - 快速安装程序
- **便携版** - 单文件可执行程序

### 📝 汉化内容
- 欢迎页面
- 项目列表
- 会话管理
- 代理系统
- 设置页面
- 所有 UI 组件和提示信息

## 📥 下载链接

| 文件 | 大小 | 说明 |
|------|------|------|
| `opcode_0.2.0_x64_en-US.msi` | ~7 MB | MSI 安装包（推荐） |
| `opcode_0.2.0_x64-setup.exe` | ~5.5 MB | NSIS 安装包 |
| `opcode.exe` | ~14.6 MB | 便携版可执行文件 |

## 🚀 快速开始

### 安装步骤

1. **下载安装包**
   - 推荐下载 MSI 版本进行标准安装
   - 或下载便携版直接运行

2. **切换语言**
   - 打开应用
   - 点击右上角 ⚙️ 设置
   - 选择"语言" → "中文"
   - 设置自动保存

3. **开始使用**
   - 创建或打开项目
   - 配置 Claude Code
   - 享受中文界面体验

## 🛠️ 系统要求

- **操作系统**: Windows 10/11 (64位)
- **内存**: 4GB 或更高
- **存储**: 100MB 可用空间
- **依赖**: Claude Code CLI

## 🔧 构建说明

### 环境要求
- Node.js 18+
- Rust 1.70+
- Windows SDK

### 构建命令
```bash
# 安装依赖
npm install

# 构建前端
npm run build

# 构建 Windows 应用
npm run tauri build
```

## 🐛 已知问题

- 首次启动可能需要几秒钟加载
- 某些系统可能需要安装 WebView2 运行时

## 📝 更新日志

### v0.2.0 (2026-04-09)
- ✅ 添加完整中文本地化
- ✅ 实现语言切换功能
- ✅ 汉化所有 UI 组件
- ✅ 添加 Windows 安装包
- ✅ 优化构建流程

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来改进中文翻译。

### 翻译文件位置
- `src/i18n/locales/zh.json` - 中文翻译
- `src/i18n/locales/en.json` - 英文翻译

## 📄 许可证

AGPL-3.0 License - 与原项目保持一致

## 🙏 致谢

- 感谢 [getAsterisk](https://github.com/getAsterisk) 创建优秀的 opcode 项目
- 感谢所有贡献者的支持

---

**完整文档**: [CHINESE_LOCALIZATION.md](./CHINESE_LOCALIZATION.md)

**原项目**: https://github.com/getAsterisk/opcode