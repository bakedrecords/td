// ゲームは「仮想解像度」720x1280 (縦長 9:16) で設計し、
// 実際の画面サイズには Viewport がレターボックスでスケールして合わせます。
// こうすることでスマホの様々な画面比でもレイアウトが崩れません。
export const VIRTUAL_W = 720;
export const VIRTUAL_H = 1280;

// マス目（グリッド）
export const TILE = 80;
export const COLS = 9; // 9 * 80 = 720
export const ROWS = 12; // 12 * 80 = 960

// 画面レイアウト（縦方向）
export const GRID_TOP = 160; // 上部 HUD の高さ
export const GRID_BOTTOM = GRID_TOP + ROWS * TILE; // = 1120
// 下部 1120..1280 はコントロールバー（ウェーブ開始ボタンなど）

// ゲームバランス
export const START_LIVES = 20;
export const START_MONEY = 150;
export const TOTAL_WAVES = 10;
export const TOWER_COST = 50;

// 配色（ダークテーマ）
export const COLORS = {
  bg: '#05070f',
  field: '#0b1020',
  gridLine: '#16203a',
  buildable: '#101a30',
  pathOuter: '#26324e',
  pathInner: '#33425f',
  panel: '#0e1730',
  panelLine: '#1d2c4f',
  text: '#e8eefc',
  textDim: '#8aa0c8',
  accent: '#46d3a3',
  accentDim: '#2a8d72',
  life: '#ff6b81',
  money: '#ffd35c',
  wave: '#7bb6ff',
  tower: '#5ad1c4',
  towerBase: '#27607a',
  enemy: '#ff7a5c',
  enemyDeep: '#c2452c',
  projectile: '#ffe27a',
  danger: '#ff4d6d',
} as const;
