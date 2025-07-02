#!/bin/bash

# Claudia 中文化分支同步脚本
# 用于同步原仓库的更新并合并到中文化分支

set -e

echo "🔄 开始同步 Claudia 原仓库更新..."

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误：请在 Claudia 项目根目录运行此脚本"
    exit 1
fi

# 检查是否有未提交的更改
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  警告：有未提交的更改，请先提交或暂存"
    echo "运行 'git status' 查看详情"
    exit 1
fi

# 获取当前分支
current_branch=$(git branch --show-current)
echo "📍 当前分支：$current_branch"

# 切换到 main 分支
echo "🔄 切换到 main 分支..."
git checkout main

# 从上游仓库获取最新更新
echo "📥 从原仓库获取最新更新..."
git fetch upstream

# 合并上游 main 分支到本地 main 分支
echo "🔀 合并上游更新到本地 main 分支..."
git merge upstream/main

# 推送更新到您的 Fork 仓库
echo "📤 推送更新到您的 Fork 仓库..."
git push origin main

# 切换到中文化分支
echo "🌏 切换到中文化分支..."
git checkout chinese-localization

# 合并 main 分支的更新到中文化分支
echo "🔀 合并 main 分支更新到中文化分支..."
if git merge main --no-edit; then
    echo "✅ 合并成功！"
else
    echo "⚠️  合并时出现冲突，请手动解决冲突后运行："
    echo "   git add ."
    echo "   git commit -m 'resolve merge conflicts'"
    echo "   git push origin chinese-localization"
    exit 1
fi

# 推送更新的中文化分支
echo "📤 推送更新的中文化分支..."
git push origin chinese-localization

# 切换回原来的分支
if [ "$current_branch" != "chinese-localization" ]; then
    echo "🔄 切换回原分支：$current_branch"
    git checkout "$current_branch"
fi

echo "🎉 同步完成！"
echo ""
echo "📋 同步摘要："
echo "   ✅ 已从原仓库获取最新更新"
echo "   ✅ 已更新本地 main 分支"
echo "   ✅ 已将更新合并到中文化分支"
echo "   ✅ 已推送到您的 Fork 仓库"
echo ""
echo "🔍 如果需要检查更新内容，请运行："
echo "   git log --oneline -10"
echo ""
echo "🚀 现在可以测试应用程序以确保中文化功能正常工作" 