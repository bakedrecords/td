// ゲームは「仮想解像度」720x1280 (縦長 9:16) で設計し、
// 実際の画面サイズには Viewport がレターボックスでスケールして合わせます。
export const VIRTUAL_W = 720;
export const VIRTUAL_H = 1280;

// マス目（グリッド）
export const TILE = 80;
export const COLS = 9; // 9 * 80 = 720
export const ROWS = 12; // 12 * 80 = 960

// 画面レイアウト（縦方向）
export const GRID_TOP = 120; // 上部 HUD の高さ
export const GRID_BOTTOM = GRID_TOP + ROWS * TILE; // = 1080
// 下部 1080..1280（高さ 200）はコントロールパネル
// （タワー選択パレット / ウェーブ開始 / 強化・売却）

// ゲームバランス
export const START_LIVES = 20;
export const START_MONEY = 150;
export const TOTAL_WAVES = 10;

// アップグレード
export const MAX_TOWER_LEVEL = 3;
export const SELL_REFUND_RATE = 0.7; // 投資総額の何割を払い戻すか

// 配色（ダークテーマ）
export const COLORS = {
  bg: '#05070f',
  field: '#0b1020',
  buildable: '#101a30',
  buildableHi: '#16264a', // 設置可能マスのハイライト（建設プレビュー）
  pathOuter: '#26324e',
  pathInner: '#33425f',
  panel: '#0e1730',
  panelLine: '#1d2c4f',
  btn: '#16223f',
  btnSel: '#26406e',
  text: '#e8eefc',
  textDim: '#8aa0c8',
  accent: '#46d3a3',
  accentDim: '#2a8d72',
  life: '#ff6b81',
  money: '#ffd35c',
  wave: '#7bb6ff',
  towerBase: '#22304e',
  projectile: '#ffe27a',
  selected: '#ffe27a',
  sell: '#ff9f6b',
  danger: '#ff4d6d',
  hpFull: '#46d3a3',
  hpLow: '#ff6b81',
} as const;
