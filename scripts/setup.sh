#!/bin/bash
set -e

echo "=== claude-pilot setup ==="

# 프로젝트 루트로 이동
cd "$(dirname "$0")/.."

# 사전 조건 체크
echo "Checking prerequisites..."

if ! command -v node &> /dev/null; then
  echo "ERROR: Node.js is required. Install via: brew install node"
  exit 1
fi

if ! command -v gh &> /dev/null; then
  echo "ERROR: GitHub CLI (gh) is required. Install via: brew install gh"
  exit 1
fi

if ! gh auth status &> /dev/null; then
  echo "ERROR: GitHub CLI is not authenticated. Run: gh auth login"
  exit 1
fi

if ! command -v claude &> /dev/null; then
  echo "ERROR: Claude Code CLI is required. Install via: npm install -g @anthropic-ai/claude-code"
  exit 1
fi

echo "All prerequisites met."

# 의존성 설치
echo "Installing dependencies..."
npm install

# data 디렉토리 생성
mkdir -p data

echo ""
echo "=== Setup complete ==="
echo ""
echo "Edit config.yaml to set your repos and preferences."
echo "Then run: npm start"
