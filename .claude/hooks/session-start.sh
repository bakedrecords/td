#!/bin/bash
set -euo pipefail

# Claude Code on the web（リモート環境）でのセッション開始時に依存関係を用意するフック。
# これにより npm test / npm run typecheck / npm run build がそのまま実行できる。

# リモート環境でのみ実行する（ローカルの通常セッションでは何もしない）
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# リポジトリのルートへ移動（CLAUDE_PROJECT_DIR が無い場合はスクリプト位置から推定）
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$PROJECT_DIR"

# 依存関係をインストール。
# コンテナ状態はフック完了後にキャッシュされるため、lockfile 厳格な npm ci ではなく
# 冪等で差分更新が効く npm install を使う。
npm install --no-audit --no-fund
