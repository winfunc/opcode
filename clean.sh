#!/bin/bash

# Claudia 项目清理脚本
# 用于清理编译缓存和临时文件

echo "🧹 开始清理 Claudia 项目..."

# 清理 Rust 编译产物
if [ -d "src-tauri" ]; then
    echo "清理 Rust 编译缓存..."
    cd src-tauri && cargo clean && cd ..
fi

# 清理前端构建产物
if [ -d "dist" ]; then
    echo "清理前端构建文件..."
    rm -rf dist
fi

# 清理 .DS_Store 文件
echo "清理 .DS_Store 文件..."
find . -name ".DS_Store" -type f -delete

# 清理日志文件
echo "清理日志文件..."
find . -name "*.log" -type f -delete

# 清理临时文件
echo "清理临时文件..."
find . -name "*.tmp" -type f -delete
find . -name "*.temp" -type f -delete

# 可选：清理 node_modules（需要重新安装）
read -p "是否清理 node_modules？这需要重新运行 npm install (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "清理 node_modules..."
    rm -rf node_modules
fi

echo "✅ 清理完成！"

# 显示当前磁盘使用情况
echo ""
echo "📊 当前项目大小："
du -sh .