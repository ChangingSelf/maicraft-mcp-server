#!/bin/bash

# Maicraft npm发布脚本

set -e

echo "🚀 开始发布 Maicraft 到 npm..."

# 检查是否已登录npm
if ! npm whoami &> /dev/null; then
    echo "❌ 请先登录npm: npm login"
    exit 1
fi

# 检查是否有未提交的更改
if [[ -n $(git status --porcelain) ]]; then
    echo "❌ 有未提交的更改，请先提交或暂存"
    git status --porcelain
    exit 1
fi

# 检查当前分支
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "main" && "$CURRENT_BRANCH" != "master" ]]; then
    echo "⚠️  当前分支不是 main/master: $CURRENT_BRANCH"
    read -p "是否继续? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 运行测试
echo "🧪 运行测试..."
pnpm test

# 运行代码检查
echo "🔍 运行代码检查..."
pnpm lint

# 清理并构建
echo "🔨 清理并构建..."
pnpm clean
pnpm build

# 检查构建产物
if [[ ! -f "dist/main.js" ]]; then
    echo "❌ 构建失败，dist/main.js 不存在"
    exit 1
fi

# 显示将要发布的文件
echo "📦 将要发布的文件:"
npm pack --dry-run

# 确认发布
read -p "确认发布到npm? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 取消发布"
    exit 1
fi

# 发布到npm
echo "📤 发布到npm..."
npm publish

echo "✅ 发布成功!"

# 显示包信息
echo "📋 包信息:"
npm view maicraft

echo "🎉 发布完成!"
