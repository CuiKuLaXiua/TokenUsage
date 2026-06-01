@echo off
:: 以管理员身份运行 electron-builder 打包
echo ============================================================
echo   Token Usage - 打包 EXE 安装程序
echo ============================================================
echo.

cd /d "%~dp0"

echo [1/3] 编译 Electron 主进程...
call npm run build:electron
if errorlevel 1 (
    echo 编译失败！
    pause
    exit /b 1
)

echo [2/3] 构建前端资源...
call npx vite build
if errorlevel 1 (
    echo 前端构建失败！
    pause
    exit /b 1
)

echo [3/3] 打包 EXE 安装程序...
call npx electron-builder --config electron-builder.yml
if errorlevel 1 (
    echo 打包失败！请确保以管理员身份运行。
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   打包完成！安装包位于 dist 目录
echo ============================================================
pause
