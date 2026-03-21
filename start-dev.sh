#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
CONDA_ENV_NAME="ai-video-creation"
BACKEND_PORT="8085"
POETRY_VERSION_SPEC="poetry>=1.8.5"

log() {
  printf '[start-dev] %s\n' "$1"
}

fail() {
  printf '[start-dev] ERROR: %s\n' "$1" >&2
  exit 1
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "缺少命令: $1"
  fi
}

ensure_poetry() {
  if python -m poetry --version >/dev/null 2>&1; then
    return
  fi

  log "当前 conda 环境缺少 Poetry，正在安装"
  python -m pip install "$POETRY_VERSION_SPEC"

  python -m poetry --version >/dev/null 2>&1 || fail "当前 conda 环境中的 python 无法执行 poetry 模块"
}

bootstrap_conda() {
  if command -v conda >/dev/null 2>&1; then
    local conda_base
    conda_base="$(conda info --base 2>/dev/null || true)"
    if [[ -n "$conda_base" && -f "$conda_base/etc/profile.d/conda.sh" ]]; then
      # shellcheck disable=SC1090
      source "$conda_base/etc/profile.d/conda.sh"
      return
    fi
  fi

  for candidate in \
    "$HOME/miniconda3/etc/profile.d/conda.sh" \
    "$HOME/anaconda3/etc/profile.d/conda.sh" \
    "/opt/homebrew/Caskroom/miniconda/base/etc/profile.d/conda.sh"
  do
    if [[ -f "$candidate" ]]; then
      # shellcheck disable=SC1090
      source "$candidate"
      return
    fi
  done

  fail "找不到 conda 初始化脚本，请先确认 conda 已安装"
}

cleanup() {
  local exit_code=$?

  if [[ -n "${BACKEND_PID:-}" ]] && kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
  fi

  if [[ -n "${FRONTEND_PID:-}" ]] && kill -0 "$FRONTEND_PID" >/dev/null 2>&1; then
    kill "$FRONTEND_PID" >/dev/null 2>&1 || true
  fi

  exit "$exit_code"
}

trap cleanup EXIT INT TERM

bootstrap_conda

if ! conda env list | awk '{print $1}' | grep -qx "$CONDA_ENV_NAME"; then
  fail "未找到 conda 环境: $CONDA_ENV_NAME"
fi

log "激活 conda 环境: $CONDA_ENV_NAME"
conda activate "$CONDA_ENV_NAME"

require_cmd python
require_cmd npm
require_cmd pip
ensure_poetry
POETRY=(python -m poetry)

log "当前 Python: $(python --version 2>&1)"
log "当前 Node: $(node --version 2>/dev/null || echo '未检测到')"
log "当前 npm: $(npm --version 2>/dev/null || echo '未检测到')"
log "当前 Poetry: $("${POETRY[@]}" --version 2>&1)"

if [[ ! -f "$BACKEND_DIR/.env" ]]; then
  log "backend/.env 不存在，正在从 .env.example 创建"
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
fi

log "安装后端依赖"
(
  cd "$BACKEND_DIR"
  log "同步后端锁文件"
  "${POETRY[@]}" lock
  POETRY_VIRTUALENVS_CREATE=false "${POETRY[@]}" install --no-root
)

log "安装前端依赖"
(
  cd "$FRONTEND_DIR"
  npm install
)

log "启动后端服务: http://localhost:$BACKEND_PORT"
(
  cd "$BACKEND_DIR"
  POETRY_VIRTUALENVS_CREATE=false "${POETRY[@]}" run python run.py
) &
BACKEND_PID=$!

log "等待后端启动"
for _ in $(seq 1 30); do
  if curl -s "http://localhost:$BACKEND_PORT/workspace/config" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

log "启动前端开发服务"
(
  cd "$FRONTEND_DIR"
  npm start
) &
FRONTEND_PID=$!

log "前后端都已启动。按 Ctrl+C 可一起停止。"
wait "$BACKEND_PID" "$FRONTEND_PID"
