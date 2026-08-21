@echo off
chcp 65001 >nul
echo ========================================
echo   钓场预约系统 - 一键部署到 GitHub
echo ========================================
echo.

cd /d "%~dp0"

where git >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Git，请先安装：https://git-scm.com/download/win
    pause
    exit /b 1
)

set /p username=请输入你的 GitHub 用户名: 
if "%username%"=="" (
    echo [错误] 用户名不能为空
    pause
    exit /b 1
)

echo.
echo 正在初始化仓库...
git init
git add .
git commit -m "钓场预约系统 v1.0" 2>nul
git branch -M main

echo.
echo 正在推送到 GitHub...
git remote remove origin 2>nul
git remote add origin https://github.com/%username%/fishing-venue.git
git push -u origin main

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   推送成功！
    echo ========================================
    echo.
    echo 下一步：
    echo   1. 打开 https://render.com
    echo   2. 用 GitHub 登录
    echo   3. New - Web Service - 选 fishing-venue
    echo   4. Runtime 选 Docker，点 Create
    echo   5. 等待 2-3 分钟
    echo.
    echo 你的网址将是：https://fishing-venue.onrender.com
    echo.
) else (
    echo.
    echo [提示] 如果推送失败，请先在 GitHub 上创建名为 fishing-venue 的空仓库
    echo        然后重新运行此脚本
    echo.
)

pause
