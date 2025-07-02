#!/bin/bash

# Claudia 启动脚本
echo "🚀 启动 Claudia - Claude Code GUI 应用程序"
echo "=================================="

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "📁 当前工作目录: $PWD"

# 设置环境变量
export CC=/usr/bin/clang
export CXX=/usr/bin/clang++
source "$HOME/.cargo/env"

# 检查依赖
echo "检查依赖..."
if ! command -v claude &> /dev/null; then
    echo "❌ Claude CLI 未找到，请先安装 Claude Code CLI"
    exit 1
fi

if ! command -v bun &> /dev/null; then
    echo "❌ Bun 未找到，请先安装 Bun"
    exit 1
fi

if ! command -v cargo &> /dev/null; then
    echo "❌ Rust/Cargo 未找到，请先安装 Rust"
    exit 1
fi

# 检查是否在正确的项目目录
if [ ! -f "package.json" ]; then
    echo "❌ 未找到 package.json，请确保在 Claudia 项目目录中运行此脚本"
    exit 1
fi

echo "✅ 所有依赖检查通过"
echo ""

# 启动开发服务器
echo "🔄 启动 Claudia 开发服务器..."
echo "注意：首次启动可能需要几分钟来编译 Rust 代码"
echo ""

bun run tauri dev 