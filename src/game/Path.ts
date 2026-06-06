import { TILE, GRID_TOP } from './constants';
import type { Vec2 } from './types';

/** グリッドのマス (col,row) の中心ピクセル座標。 */
export function cellCenter(col: number, row: number): Vec2 {
  return {
    x: col * TILE + TILE / 2,
    y: GRID_TOP + row * TILE + TILE / 2,
  };
}

/** あるステージの経路（曲がり角・通過マス判定・総延長）。 */
export interface GamePath {
  /** 曲がり角のピクセル座標（敵・描画が参照）。 */
  waypoints: Vec2[];
  /** 指定マスが経路上か（＝タワーを置けない）。 */
  isPathCell(col: number, row: number): boolean;
  /** 経路の総延長（ピクセル）。 */
  length: number;
}

/**
 * グリッド座標の曲がり角リストから経路を組み立てる。
 * 連続する 2 点は必ず同じ col か同じ row（縦か横移動のみ）であること。
 * row が負 / ROWS 以上の点は画面外（敵の出現・退場位置）。
 */
export function buildPath(grid: ReadonlyArray<readonly [number, number]>): GamePath {
  const waypoints = grid.map(([c, r]) => cellCenter(c, r));

  const cells = new Set<string>();
  for (let i = 0; i < grid.length - 1; i++) {
    const [c0, r0] = grid[i];
    const [c1, r1] = grid[i + 1];
    const dc = Math.sign(c1 - c0);
    const dr = Math.sign(r1 - r0);
    let c = c0;
    let r = r0;
    cells.add(`${c},${r}`);
    while (c !== c1 || r !== r1) {
      c += dc;
      r += dr;
      cells.add(`${c},${r}`);
    }
  }

  let length = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    length += Math.hypot(b.x - a.x, b.y - a.y);
  }

  return {
    waypoints,
    isPathCell: (col, row) => cells.has(`${col},${row}`),
    length,
  };
}
