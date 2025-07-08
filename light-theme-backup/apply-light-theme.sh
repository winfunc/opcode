#!/bin/bash

echo "🎨 正在应用 Claudia 亮色主题..."

# 检查是否在正确的目录
if [ ! -d "src" ]; then
    echo "❌ 错误：请在 claudia 项目根目录运行此脚本"
    exit 1
fi

# 备份当前的暗色主题文件（如果需要恢复）
echo "📦 备份当前主题文件..."
cp src/styles.css light-theme-backup/dark-styles.css.backup 2>/dev/null || true
cp src/lib/claudeSyntaxTheme.ts light-theme-backup/dark-claudeSyntaxTheme.ts.backup 2>/dev/null || true

# 应用亮色主题文件
echo "✨ 应用亮色主题配置..."
cp light-theme-backup/styles.css src/styles.css
cp light-theme-backup/claudeSyntaxTheme.ts src/lib/claudeSyntaxTheme.ts

# 修改组件文件的颜色模式
echo "🔧 更新组件颜色模式..."
sed -i '' 's/data-color-mode="dark"/data-color-mode="light"/g' src/components/*.tsx 2>/dev/null || true

# 显示完成信息
echo ""
echo "✅ 亮色主题应用成功！"
echo ""
echo "📋 接下来的步骤："
echo "1. 运行 'bun run tauri build' 重新构建应用"
echo "2. 启动新构建的应用即可享受亮色主题"
echo ""
echo "💡 提示：如需恢复暗色主题，备份文件保存在 light-theme-backup/ 目录中"
echo ""
