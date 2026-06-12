#!/bin/bash
echo "🧹 清理旧的构建文件..."

# 删除 dist 目录中的所有文件
rm -rf dist/*

echo "✅ 清理完成"
echo ""
echo "🔨 开始构建..."

# 运行构建
npm run electron:build

echo ""
echo "📦 构建完成！"
echo ""
echo "安装包位置："
ls -lh dist/*.exe dist/*.zip 2>/dev/null || echo "未找到安装包"
