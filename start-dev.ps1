#Requires -Version 5.1
<#
.SYNOPSIS
    启动 ai-video-creation 前后端开发环境（Windows / PowerShell 版）
.DESCRIPTION
    等价于 start-dev.sh，支持 Windows 11 + Conda + Poetry + npm。
    使用方法：
      powershell -ExecutionPolicy Bypass -File .\start-dev.ps1
#>

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ROOT_DIR        = Split-Path -Parent $MyInvocation.MyCommand.Path
$BACKEND_DIR     = Join-Path $ROOT_DIR  "backend"
$FRONTEND_DIR    = Join-Path $ROOT_DIR  "frontend"
$CONDA_ENV_NAME  = "ai-video-creation"
$BACKEND_PORT    = "8085"
$POETRY_VERSION_SPEC = "poetry>=1.8.5"

$script:BackendProcess  = $null
$script:FrontendProcess = $null

# ---------------------------------------------------------------------------
# 工具函数
# ---------------------------------------------------------------------------
function Write-Log  { param([string]$Msg) Write-Host "[start-dev] $Msg" }
function Write-Fail { param([string]$Msg) Write-Error "[start-dev] ERROR: $Msg"; exit 1 }

function Test-Cmd {
    param([string]$Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Require-Cmd {
    param([string]$Name)
    if (-not (Test-Cmd $Name)) { Write-Fail "缺少命令: $Name" }
}

# ---------------------------------------------------------------------------
# 查找并初始化 conda（把 Scripts/condabin 加入 PATH）
# ---------------------------------------------------------------------------
function Initialize-Conda {
    if (Test-Cmd "conda") { return }

    $candidates = @(
        "$env:USERPROFILE\miniconda3",
        "$env:USERPROFILE\anaconda3",
        "$env:LOCALAPPDATA\miniconda3",
        "$env:LOCALAPPDATA\anaconda3",
        "C:\ProgramData\miniconda3",
        "C:\ProgramData\anaconda3",
        "C:\tools\miniconda3",
        "C:\tools\anaconda3"
    )

    foreach ($base in $candidates) {
        $exe = Join-Path $base "Scripts\conda.exe"
        if (Test-Path $exe) {
            $env:PATH = "$base;$base\Scripts;$base\condabin;$env:PATH"
            Write-Log "找到 conda: $base"
            return
        }
    }

    Write-Fail "找不到 conda，请先安装 Miniconda/Anaconda 并添加到 PATH"
}

# ---------------------------------------------------------------------------
# 激活 conda 环境（通过直接修改 PATH，不依赖 conda hook）
# ---------------------------------------------------------------------------
function Enable-CondaEnv {
    param([string]$EnvName)

    $condaBase = (& conda info --base 2>$null | Out-String).Trim()
    if (-not $condaBase) { Write-Fail "无法获取 conda base 路径" }

    # 检查环境是否存在
    $envList = & conda env list 2>$null | Out-String
    if ($envList -notmatch "(?m)^$([regex]::Escape($EnvName))[\s/\\]") {
        Write-Fail "未找到 conda 环境: $EnvName（请先运行 conda env create）"
    }

    $envDir     = Join-Path $condaBase "envs\$EnvName"
    $envScripts = Join-Path $envDir    "Scripts"
    $envLib     = Join-Path $envDir    "Library\bin"

    $env:PATH                = "$envDir;$envScripts;$envLib;$env:PATH"
    $env:CONDA_DEFAULT_ENV   = $EnvName
    $env:CONDA_PREFIX        = $envDir
    $env:CONDA_PROMPT_MODIFIER = "($EnvName) "

    Write-Log "激活 conda 环境: $EnvName ($envDir)"
}

# ---------------------------------------------------------------------------
# 确保 Poetry 可用
# ---------------------------------------------------------------------------
function Ensure-Poetry {
    $out = & python -m poetry --version 2>&1
    if ($LASTEXITCODE -eq 0) { return }

    Write-Log "当前 conda 环境缺少 Poetry，正在安装 ($POETRY_VERSION_SPEC)"
    & python -m pip install $POETRY_VERSION_SPEC

    $out = & python -m poetry --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "当前 conda 环境中的 python 无法执行 poetry 模块"
    }
}

# ---------------------------------------------------------------------------
# 清理子进程
# ---------------------------------------------------------------------------
function Start-Cleanup {
    if ($script:BackendProcess -and -not $script:BackendProcess.HasExited) {
        Write-Log "停止后端进程 (PID $($script:BackendProcess.Id))..."
        Stop-Process -Id $script:BackendProcess.Id -Force -ErrorAction SilentlyContinue
    }
    if ($script:FrontendProcess -and -not $script:FrontendProcess.HasExited) {
        Write-Log "停止前端进程 (PID $($script:FrontendProcess.Id))..."
        Stop-Process -Id $script:FrontendProcess.Id -Force -ErrorAction SilentlyContinue
    }
}

# 注册退出事件
$null = Register-EngineEvent -SourceIdentifier ([System.Management.Automation.PsEngineEvent]::Exiting) `
        -Action { Start-Cleanup }

# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------
try {
    Initialize-Conda
    Enable-CondaEnv -EnvName $CONDA_ENV_NAME

    Require-Cmd "python"
    Require-Cmd "npm"
    Require-Cmd "pip"
    Ensure-Poetry

    Write-Log "当前 Python : $(& python --version 2>&1)"
    Write-Log "当前 Node   : $(node --version 2>$null | Select-Object -First 1 | ForEach-Object { if ($_) { $_ } else { '未检测到' } })"
    Write-Log "当前 npm    : $(npm  --version 2>$null | Select-Object -First 1 | ForEach-Object { if ($_) { $_ } else { '未检测到' } })"
    Write-Log "当前 Poetry : $(& python -m poetry --version 2>&1)"

    # .env
    if (-not (Test-Path "$BACKEND_DIR\.env")) {
        Write-Log "backend/.env 不存在，正在从 .env.example 创建"
        Copy-Item "$BACKEND_DIR\.env.example" "$BACKEND_DIR\.env"
    }

    # 安装后端依赖
    Write-Log "安装后端依赖"
    Push-Location $BACKEND_DIR
    try {
        Write-Log "同步后端锁文件"
        & python -m poetry lock
        $env:POETRY_VIRTUALENVS_CREATE = "false"
        & python -m poetry install --no-root
    } finally { Pop-Location }

    # 安装前端依赖
    Write-Log "安装前端依赖"
    Push-Location $FRONTEND_DIR
    try { & npm install } finally { Pop-Location }

    # 启动后端（后台，继承当前控制台输出）
    Write-Log "启动后端服务: http://localhost:$BACKEND_PORT"
    $backendEnv = [System.Collections.Generic.Dictionary[string,string]]::new()
    $backendEnv["POETRY_VIRTUALENVS_CREATE"] = "false"
    $script:BackendProcess = Start-Process `
        -FilePath   "python" `
        -ArgumentList "-m", "poetry", "run", "python", "run.py" `
        -WorkingDirectory $BACKEND_DIR `
        -PassThru `
        -NoNewWindow

    # 等待后端就绪（最多 30 秒）
    # 注意：与 bash curl 保持一致——任何 HTTP 响应（含 404）都说明服务已启动；
    # 只有连接被拒绝 / 超时才继续等待。
    Write-Log "等待后端启动..."
    for ($i = 0; $i -lt 30; $i++) {
        try {
            Invoke-WebRequest `
                -Uri            "http://localhost:$BACKEND_PORT/workspace/config" `
                -UseBasicParsing `
                -TimeoutSec     2 `
                -ErrorAction    Stop | Out-Null
            break  # 200 系列响应，直接跳出
        } catch {
            # 只要 Exception.Response 不为空，说明服务端已返回 HTTP 响应（如 404），服务已就绪
            if ($_.Exception.Response -ne $null) { break }
            # 否则是连接被拒绝或超时，继续等待
        }
        Start-Sleep -Seconds 1
    }

    # 启动前端（后台，继承当前控制台输出）
    Write-Log "启动前端开发服务"
    $script:FrontendProcess = Start-Process `
        -FilePath         "npm" `
        -ArgumentList     "start" `
        -WorkingDirectory $FRONTEND_DIR `
        -PassThru `
        -NoNewWindow

    Write-Log "前后端都已启动。按 Ctrl+C 可一起停止。"

    # 阻塞，直到任一子进程退出
    while (-not $script:BackendProcess.HasExited -and -not $script:FrontendProcess.HasExited) {
        Start-Sleep -Milliseconds 500
    }

} finally {
    Start-Cleanup
}
