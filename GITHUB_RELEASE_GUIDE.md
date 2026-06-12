# GitHub Release 发布指南

## 📦 方法一：GitHub Releases（推荐）

### 步骤 1：创建 Release

1. 访问你的 GitHub 仓库：https://github.com/CuiKuLaXiua/TokenUsage
2. 点击右侧的 **"Releases"** 链接
3. 点击 **"Create a new release"** 按钮

### 步骤 2：填写 Release 信息

**Tag version**: `v1.0.0`
**Release title**: `Token Usage v1.0.0`
**Description**:

```markdown
## 🎉 Token Usage v1.0.0

桌面端模型 Token 用量及额度展示工具

### ✨ 主要功能
- 📊 Token 用量统计和可视化
- 💰 账户余额监控
- 🔔 智能提醒和通知
- 🎨 现代化 UI 设计（玻璃态风格）
- 🌙 深色/浅色主题切换
- 📱 系统托盘支持

### 🔧 技术栈
- Electron 28
- Vue 3 + TypeScript
- Element Plus
- ECharts

### 📥 下载
- **Windows**: `Token-Usage-Setup-1.0.0.exe`
- **macOS**: `Token-Usage-1.0.0.dmg`
- **Linux**: `Token-Usage-1.0.0.AppImage`

### 🐛 Bug 反馈
如有问题，请提交 [Issue](https://github.com/CuiKuLaXiua/TokenUsage/issues)
```

### 步骤 3：上传安装包

1. 在 Release 页面底部，找到 **"Attach binaries"** 区域
2. 将构建好的安装包拖拽到该区域：
   - `dist/Token Usage Setup 1.0.0.exe` (Windows)
   - `dist/Token-Usage-1.0.0.dmg` (macOS)
   - `dist/Token-Usage-1.0.0.AppImage` (Linux)

3. 点击 **"Publish release"** 按钮

---

## 🚀 方法二：使用 Git LFS（大文件存储）

如果需要将安装包存储在 Git 仓库中：

### 安装 Git LFS

```bash
# 安装 Git LFS
git lfs install

# 跟踪 exe 文件
git lfs track "*.exe"
git lfs track "*.dmg"
git lfs track "*.AppImage"

# 添加 .gitattributes
git add .gitattributes
git commit -m "chore: 配置 Git LFS 跟踪安装包"
```

### 提交安装包

```bash
# 添加安装包
git add dist/*.exe
git add dist/*.dmg
git add dist/*.AppImage

# 提交
git commit -m "release: 添加 v1.0.0 安装包"

# 推送
git push origin release/v1.0.0
```

---

## 🤖 方法三：GitHub Actions 自动化（推荐用于持续发布）

创建 `.github/workflows/release.yml`:

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run electron:build

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: release-${{ matrix.os }}
          path: |
            dist/*.exe
            dist/*.dmg
            dist/*.AppImage

  release:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - name: Download artifacts
        uses: actions/download-artifact@v4
        with:
          path: artifacts

      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            artifacts/**/*.exe
            artifacts/**/*.dmg
            artifacts/**/*.AppImage
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## 📋 快速命令参考

### 查看构建产物

```bash
# 查看构建目录
ls -lh dist/

# 查看文件大小
du -sh dist/*.exe
```

### 创建 Git Tag

```bash
# 创建 tag
git tag -a v1.0.0 -m "release: v1.0.0"

# 推送 tag
git push origin v1.0.0
```

### 使用 GitHub CLI 创建 Release

```bash
# 安装 GitHub CLI
# https://cli.github.com/

# 创建 release 并上传文件
gh release create v1.0.0 \
  --title "Token Usage v1.0.0" \
  --notes-file RELEASE_NOTES.md \
  dist/*.exe
```

---

## 💡 最佳实践建议

1. **使用 Releases** - 最专业的分发方式
2. **编写详细的 Release Notes** - 帮助用户了解更新内容
3. **提供多个平台的安装包** - Windows/macOS/Linux
4. **使用 Git Tag** - 标记版本号
5. **自动化构建** - 使用 GitHub Actions 提高效率

选择最适合你的方式！推荐使用 **方法一（GitHub Releases）** 作为首选。
