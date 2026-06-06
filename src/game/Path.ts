import { TILE, GRID_TOP } from './constants';
import type { Vec2 } from './types';

// 敵が進む経路の曲がり角を「グリッド座標 (col, row)」で定義する。
// 連続する 2 点は必ず同じ col か同じ row（＝縦か横移動のみ）にすること。
// row が負 / ROWS 以上の点は画面外なので、敵は上部 HUD の裏から現れ、
// 下部バーの裏へ消えていくように見える。
const WAYPOINTS_GRID: ReadonlyArray<readonly [number, number]> = [
  [4, -3], // 画面上の外（出現位置）
  [4, 3],
  [7, 3],
  [7, 6],
  [1, 6],
  [1, 9],
  [7, 9],
  [7, 12], // 画面下の外（ゴール＝ライフが減る）
];

/** グリッドのマス (col,row) の中心ピクセル座標を返す。 */
export function cellCenter(col: number, row: number): Vec2 {
  return {
    x: col * TILE + TILE / 2,
    y: GRID_TOP + row * TILE + TILE / 2,
  };
}

/** 経路の曲がり角をピクセル座標で並べたもの（敵・描画が参照）。 */
export const WAYPOINTS: ReadonlyArray<Vec2> = WAYPOINTS_GRID.map(([c, r]) =>
  cellCenter(c, r),
);

/** 経路が通るマスの集合（"col,row" 文字列）。タワー設置可否の判定に使う。 */
const PATH_CELLS: ReadonlySet<string> = (() => {
  const set = new Set<string>();
  for (let i = 0; i < WAYPOINTS_GRID.length - 1; i++) {
    const [c0, r0] = WAYPOINTS_GRID[i];
    const [c1, r1] = WAYPOINTS_GRID[i + 1];
    const dc = Math.sign(c1 - c0);
    const dr = Math.sign(r1 - r0);
    let c = c0;
    let r = r0;
    set.add(`${c},${r}`);
    while (c !== c1 || r !== r1) {
      c += dc;
      r += dr;
      set.add(`${c},${r}`);
    }
  }
  return set;
})();

/** 指定マスが経路上か（＝タワーを置けない）。 */
export function isPathCell(col: number, row: number): boolean {
  return PATH_CELLS.has(`${col},${row}`);
}

/** 経路の総延長（ピクセル）。バランス調整やテストの参考値。 */
export function pathLength(): number {
  let len = 0;
  for (let i = 0; i < WAYPOINTS.length - 1; i++) {
    const a = WAYPOINTS[i];
    const b = WAYPOINTS[i + 1];
    len += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return len;
}
