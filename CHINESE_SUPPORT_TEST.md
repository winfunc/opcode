# opcode 中文支持 - 测试和使用指南

## ✅ 已完成的工作

恭喜！opcode 项目的中文支持基础框架已经构建完成！

### 已创建/修改的文件

1. **依赖安装**
   - ✅ i18next
   - ✅ react-i18next
   - ✅ i18next-browser-languagedetector

2. **核心文件**
   - ✅ `src/i18n.ts` - i18n 配置
   - ✅ `src/locales/en.json` - 英文翻译（180+ 字符串）
   - ✅ `src/locales/zh-CN.json` - 中文翻译（180+ 字符串）
   - ✅ `src/components/LanguageSwitcher.tsx` - 语言切换组件

3. **已更新的组件**
   - ✅ `src/main.tsx` - 已导入 i18n
   - ✅ `src/components/CustomTitlebar.tsx` - 完全国际化并集成语言切换器

## 🚀 如何测试

### 方法 1：开发模式测试（推荐）

```bash
cd C:\Users\zhu\opcode
"$HOME/.bun/bin/bun.exe" run tauri dev
```

### 方法 2：生产构建测试

```bash
cd C:\Users\zhu\opcode

# 构建前端
"$HOME/.bun/bin/bun.exe" run build

# 构建 Tauri 应用
cargo build --release --manifest-path src-tauri/Cargo.toml

# 运行应用
./src-tauri/target/release/opcode.exe
```

## 🎯 测试要点

### 1. 语言切换器位置

打开应用后，你会在**标题栏右上角**看到一个地球图标 (🌐) 和当前语言名称。

### 2. 切换语言

1. 点击语言切换器按钮
2. 在下拉菜单中选择：
   - "English" - 切换到英文
   - "简体中文" - 切换到中文

### 3. 已国际化的 UI 元素（标题栏）

以下元素已支持中英文切换：

| 英文 | 中文 |
|------|------|
| Close | 关闭 |
| Minimize | 最小化 |
| Maximize | 最大化 |
| Agents | 代理 |
| Usage Dashboard | 使用情况 |
| Settings | 设置 |
| More options | 更多选项 |
| CLAUDE.md | CLAUDE.md |
| MCP Servers | MCP 服务器 |
| About | 关于 |

### 4. 测试步骤

1. **启动应用**
   ```bash
   cd C:\Users\zhu\opcode
   "$HOME/.bun/bin/bun.exe" run tauri dev
   ```

2. **检查默认语言**
   - 应用应该根据你的系统语言自动选择（中文系统显示中文）
   - 或者使用之前保存的语言设置

3. **测试语言切换**
   - 点击右上角的语言切换器
   - 选择"简体中文"
   - 观察标题栏文本是否变成中文
   - 再切换回"English"
   - 观察文本是否恢复英文

4. **测试持久化**
   - 切换到中文
   - 关闭应用
   - 重新打开应用
   - 应该仍然显示中文

## 📱 当前已翻译的模块

目前已为以下模块准备了完整的翻译：

✅ **标题栏 (CustomTitlebar)** - 已完全实现
⏳ **项目列表 (ProjectList)** - 翻译已准备，待更新组件
⏳ **会话列表 (SessionList)** - 翻译已准备，待更新组件
⏳ **设置页面 (Settings)** - 翻译已准备，待更新组件
⏳ **代理管理 (CCAgents)** - 翻译已准备，待更新组件
⏳ **使用情况 (UsageDashboard)** - 翻译已准备，待更新组件
⏳ **MCP 管理器 (MCPManager)** - 翻译已准备，待更新组件

## 🔧 如何继续完善

### 快速更新其他组件

参考 `CHINESE_I18N_GUIDE.md` 文件中的详细说明，按以下模式更新其他组件：

```typescript
// 1. 导入 hook
import { useTranslation } from 'react-i18next';

// 2. 在组件中使用
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

### 推荐更新顺序

建议按使用频率依次更新：

1. **CustomTitlebar.tsx** ✅ 已完成
2. **ProjectList.tsx** - 用户最常看到的页面
3. **Settings.tsx** - 设置页面
4. **CCAgents.tsx** - 代理管理
5. **UsageDashboard.tsx** - 使用情况
6. 其他组件...

## 🐛 常见问题排查

### 问题 1: 语言切换器不显示

**解决方法:**
```bash
# 检查组件是否导出
ls src/components/LanguageSwitcher.tsx

# 重新构建
cd opcode
"$HOME/.bun/bin/bun.exe" run build
```

### 问题 2: 翻译不生效

**可能原因:**
1. i18n 未在 main.tsx 中导入
2. 翻译键不存在
3. 组件未使用 useTranslation hook

**检查方法:**
```javascript
// 在浏览器控制台运行
console.log(window.i18n?.language); // 检查当前语言
console.log(window.i18n?.t('titlebar.settings')); // 测试翻译
```

### 问题 3: 语言切换后需要刷新

这是正常行为。一些未更新的组件可能需要刷新才能看到新语言。
逐步更新所有组件后，所有文本都会实时切换。

## 📊 项目进度

- **已完成**: 20%
  - ✅ i18n 框架搭建
  - ✅ 翻译文件创建（180+ 字符串）
  - ✅ 语言切换器实现
  - ✅ 标题栏组件国际化

- **待完成**: 80%
  - ⏳ 更新其余 83 个组件文件
  - ⏳ 添加更多翻译字符串（估计还需 500+）
  - ⏳ 测试所有页面的中文显示

## 💡 下一步建议

### 方案 A：逐步完善（推荐）

1. 先测试当前实现的功能
2. 确认标题栏中文切换正常
3. 根据使用频率逐个更新其他组件
4. 每更新几个组件就测试一次

### 方案 B：批量更新

如果你想快速看到效果，可以：
1. 使用 AI 工具批量更新多个文件
2. 使用查找替换功能批量处理
3. 按模块（如所有按钮、所有标题）批量更新

## 📚 参考文档

- **实现指南**: `CHINESE_I18N_GUIDE.md`
- **翻译文件**:
  - `src/locales/en.json`
  - `src/locales/zh-CN.json`
- **示例组件**: `src/components/CustomTitlebar.tsx`

## 🎉 结语

恭喜！你的 opcode 应用已经具备了中英文双语支持的基础框架！

现在你可以：
1. ✅ 在标题栏切换语言
2. ✅ 看到标题栏的中文文本
3. ✅ 设置会持久化保存

继续按照 `CHINESE_I18N_GUIDE.md` 的指导，逐步更新其他组件，最终实现完整的中文支持！

---

**需要帮助？** 查看 `CHINESE_I18N_GUIDE.md` 获取详细的实现说明和示例代码。
