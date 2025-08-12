# Maicraft npm发布脚本 (Windows PowerShell)

param(
    [switch]$Force
)

Write-Host "🚀 开始发布 Maicraft 到 npm..." -ForegroundColor Green

# 检查是否已登录npm
try {
    $null = npm whoami 2>$null
} catch {
    Write-Host "❌ 请先登录npm: npm login" -ForegroundColor Red
    exit 1
}

# 检查是否有未提交的更改
$gitStatus = git status --porcelain 2>$null
if ($gitStatus) {
    Write-Host "❌ 有未提交的更改，请先提交或暂存" -ForegroundColor Red
    Write-Host $gitStatus
    exit 1
}

# 检查当前分支
$currentBranch = git branch --show-current 2>$null
if ($currentBranch -ne "main" -and $currentBranch -ne "master") {
    Write-Host "⚠️  当前分支不是 main/master: $currentBranch" -ForegroundColor Yellow
    if (-not $Force) {
        $response = Read-Host "是否继续? (y/N)"
        if ($response -notmatch "^[Yy]$") {
            Write-Host "❌ 取消发布" -ForegroundColor Red
            exit 1
        }
    }
}

# 运行测试
Write-Host "🧪 运行测试..." -ForegroundColor Cyan
pnpm test

# 运行代码检查
Write-Host "🔍 运行代码检查..." -ForegroundColor Cyan
pnpm lint

# 清理并构建
Write-Host "🔨 清理并构建..." -ForegroundColor Cyan
pnpm clean
pnpm build

# 检查构建产物
if (-not (Test-Path "dist/main.js")) {
    Write-Host "❌ 构建失败，dist/main.js 不存在" -ForegroundColor Red
    exit 1
}

# 显示将要发布的文件
Write-Host "📦 将要发布的文件:" -ForegroundColor Cyan
npm pack --dry-run

# 确认发布
if (-not $Force) {
    $response = Read-Host "确认发布到npm? (y/N)"
    if ($response -notmatch "^[Yy]$") {
        Write-Host "❌ 取消发布" -ForegroundColor Red
        exit 1
    }
}

# 发布到npm
Write-Host "📤 发布到npm..." -ForegroundColor Cyan
npm publish

Write-Host "✅ 发布成功!" -ForegroundColor Green

# 显示包信息
Write-Host "📋 包信息:" -ForegroundColor Cyan
npm view maicraft

Write-Host "🎉 发布完成!" -ForegroundColor Green
