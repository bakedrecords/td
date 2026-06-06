# Tower Defense 🗼

スマホのブラウザで遊べる、シンプルなタワーディフェンスゲームです。
**TypeScript + Vite + HTML5 Canvas** 製で、インストール不要・URL を開くだけで遊べます。

タッチ操作前提のモバイルファースト設計（縦持ち 9:16）。仮想解像度 720×1280 で作り、
どんな画面比でもレターボックスで自動フィットします。

---

## 遊び方

- **空きマスをタップ** → タワーを設置（1 基 50 ゴールド）
- タワーは射程内の敵を自動で狙って攻撃します
- 敵を倒すとゴールド獲得、貯めて増設・防衛
- 敵が経路の終点に到達すると**ライフが減少**、0 でゲームオーバー
- 下部の「**WAVE ◯ スタート**」ボタンでウェーブ開始（合計 10 ウェーブ）
- 全ウェーブ防衛でクリア。ゲームオーバー／クリア後は**タップでリスタート**

> ヒント: ウェーブの合間だけでなく、戦闘中でもゴールドがあればタワーを増設できます。

---

## 必要環境

- Node.js 20 以上（推奨 22）

## セットアップ

```bash
npm install
```

## 開発サーバーを起動

```bash
npm run dev
```

表示された URL（例 `http://localhost:5173`）をブラウザで開きます。

### 📱 スマホ実機で試す（同じ Wi-Fi）

`vite.config.ts` で `server.host` を有効にしてあるので、`npm run dev` 実行時に
`Network:` として LAN の URL（例 `http://192.168.x.x:5173`）が表示されます。
スマホを同じ Wi-Fi に接続し、その URL を開けば実機で遊べます。

## ビルド / プレビュー

```bash
npm run build     # 型チェック + 本番ビルド（dist/ を生成）
npm run preview   # ビルド結果をローカルで確認
```

## テスト / 型チェック

```bash
npm test          # vitest（コアロジックの単体・統合テスト）
npm run typecheck # tsc による型チェック
```

---

## ディレクトリ構成

```
.
├── index.html               # エントリ HTML
├── src/
│   ├── main.ts              # 起動・リサイズ・入力・描画ループ
│   ├── style.css            # 全画面・タッチ最適化のスタイル
│   └── game/
│       ├── constants.ts     # 画面サイズ・グリッド・バランス・配色
│       ├── types.ts         # 共有型
│       ├── Viewport.ts      # 仮想解像度⇄実画面のスケール変換・座標変換
│       ├── Path.ts          # 敵の経路（曲がり角）と設置可否判定
│       ├── Enemy.ts         # 敵（経路移動・HP）
│       ├── Tower.ts         # タワー（索敵・発射）
│       ├── Projectile.ts    # 弾（追尾・命中）
│       ├── Game.ts          # ゲーム全体の状態・更新・描画
│       └── *.test.ts        # 各種テスト
├── .github/workflows/deploy.yml   # GitHub Pages へ自動デプロイ
└── .claude/                 # Claude Code on the web 用のセッション設定
```

設計の要点:

- **更新（`update`）と描画（`render`）を分離**。ロジックは DOM 非依存なので Node 上の
  テストでウェーブ進行まで丸ごと検証できます。
- 座標はすべて**仮想座標系（720×1280）**で考え、実画面へのスケールは `Viewport` に集約。
- 入力は `pointerdown` で統一（マウス・タッチ・ペン共通）。

---

## 拡張のヒント

- **タワーの種類を増やす**: `Tower` は `TowerStats`（射程・威力・連射）を受け取ります。
  `DEFAULT_TOWER_STATS` を複製して別パラメータのタワーを定義し、設置時に選べるよう
  `Game` に種類選択 UI を足すのが入口です。
- **敵の種類を増やす**: `Enemy` のコンストラクタ（HP・速度・報酬）に加え、見た目や
  特性（飛行・装甲など）を足せます。
- **ウェーブを編集**: `Game.startWave()` のスケーリング式、または配列でウェーブ定義を
  外出しすると調整が楽になります。
- **経路を変える**: `Path.ts` の `WAYPOINTS_GRID` を編集（連続する点は必ず縦か横）。
- **バランス調整**: `constants.ts` の `START_LIVES` / `START_MONEY` / `TOWER_COST` など。

---

## 📱 GitHub Pages で公開してスマホから遊ぶ

`main` ブランチへの push で自動デプロイされます（`.github/workflows/deploy.yml`）。

初回のみリポジトリで設定が必要です:

1. リポジトリの **Settings → Pages**
2. **Build and deployment → Source** を **「GitHub Actions」** に変更
3. `main` に push（または Actions タブから手動実行）

公開後の URL は `https://<ユーザー名>.github.io/td/` です。スマホのブラウザでこの URL を
開けば、インストール不要でそのまま遊べます。

---

## Claude Code on the web について

`.claude/` に、Web セッション開始時に依存関係を自動インストールする **SessionStart
フック**を用意しています。これにより、Web 上のセッションでも `npm test` /
`npm run typecheck` / `npm run build` がすぐ実行できます。
この設定を**デフォルトブランチへマージすると、以降のすべての Web セッションで有効**になります。
