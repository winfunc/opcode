# Claudia 亮色主题备份

这个目录包含了 Claudia 应用的亮色主题配置文件和恢复脚本。

## 文件说明

- `styles.css` - 亮色主题的样式配置
- `claudeSyntaxTheme.ts` - 亮色主题的语法高亮配置  
- `apply-light-theme.sh` - 一键恢复亮色主题的脚本
- `dark-styles.css.backup` - 原始暗色主题样式备份
- `dark-claudeSyntaxTheme.ts.backup` - 原始暗色主题语法高亮备份

## 快速使用

1. 确保你在 claudia 项目根目录
2. 运行恢复脚本：
   ```bash
   cd light-theme-backup
   ./apply-light-theme.sh
   ```
3. 重新构建应用：
   ```bash
   cd ..
   bun run tauri build
   ```

## 注意事项

- 每次应用更新后，如果主题被重置，可以使用这个备份快速恢复
- 脚本会自动备份当前主题到 `current-*.backup` 文件
- 如果需要回到暗色主题，可以使用 `dark-*.backup` 文件手动恢复

## 主题特色

- 清爽的白色/亮色界面
- 优化的对比度，确保文字清晰可读
- 保持代码块的深色背景以便阅读
- 按钮和控件的高对比度设计
