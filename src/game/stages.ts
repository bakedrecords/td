import type { WaveDef } from './waves';

export interface Stage {
  name: string;
  /** 経路の曲がり角（グリッド座標）。連続点は縦か横移動のみ。 */
  waypointsGrid: ReadonlyArray<readonly [number, number]>;
  waves: WaveDef[];
  startMoney: number;
  startLives: number;
}

export const STAGES: Stage[] = [
  // ── STAGE 1：やさしい蛇行 ──
  {
    name: 'みどりの小道',
    waypointsGrid: [
      [4, -3],
      [4, 3],
      [7, 3],
      [7, 6],
      [1, 6],
      [1, 9],
      [7, 9],
      [7, 12],
    ],
    startMoney: 150,
    startLives: 20,
    waves: [
      { groups: [{ type: 'normal', count: 5, interval: 0.9 }] },
      { groups: [{ type: 'normal', count: 6, interval: 0.8 }, { type: 'fast', count: 3, interval: 0.5 }] },
      { groups: [{ type: 'swarm', count: 10, interval: 0.35 }, { type: 'normal', count: 4, interval: 0.7 }] },
      { groups: [{ type: 'fast', count: 8, interval: 0.5 }, { type: 'tank', count: 2, interval: 1.2 }] },
      { groups: [{ type: 'tank', count: 3, interval: 1.3 }, { type: 'normal', count: 6, interval: 0.6 }, { type: 'fast', count: 4, interval: 0.45 }] },
      { groups: [{ type: 'tank', count: 3, interval: 1.2 }, { type: 'fast', count: 8, interval: 0.4 }, { type: 'boss', count: 1, interval: 0.5 }] },
    ],
  },

  // ── STAGE 2：左右に大きく折り返す ──
  {
    name: 'まわり道',
    waypointsGrid: [
      [4, -3],
      [4, 2],
      [1, 2],
      [1, 5],
      [7, 5],
      [7, 8],
      [2, 8],
      [2, 12],
    ],
    startMoney: 190,
    startLives: 20,
    waves: [
      { groups: [{ type: 'fast', count: 6, interval: 0.5 }, { type: 'normal', count: 4, interval: 0.7 }] },
      { groups: [{ type: 'swarm', count: 14, interval: 0.3 }, { type: 'fast', count: 4, interval: 0.45 }] },
      { groups: [{ type: 'tank', count: 3, interval: 1.2 }, { type: 'normal', count: 8, interval: 0.6 }] },
      { groups: [{ type: 'fast', count: 12, interval: 0.38 }, { type: 'swarm', count: 10, interval: 0.3 }] },
      { groups: [{ type: 'tank', count: 4, interval: 1.1 }, { type: 'fast', count: 8, interval: 0.4 }, { type: 'normal', count: 6, interval: 0.6 }] },
      { groups: [{ type: 'swarm', count: 18, interval: 0.26 }, { type: 'tank', count: 4, interval: 1.0 }] },
      { groups: [{ type: 'tank', count: 4, interval: 1.0 }, { type: 'fast', count: 10, interval: 0.36 }, { type: 'boss', count: 1, interval: 0.5 }] },
    ],
  },

  // ── STAGE 3：長くて急なジグザグ ──
  {
    name: '九十九折り',
    waypointsGrid: [
      [1, -3],
      [1, 2],
      [7, 2],
      [7, 4],
      [2, 4],
      [2, 6],
      [7, 6],
      [7, 8],
      [2, 8],
      [2, 10],
      [8, 10],
      [8, 12],
    ],
    startMoney: 240,
    startLives: 22,
    waves: [
      { groups: [{ type: 'fast', count: 8, interval: 0.45 }, { type: 'tank', count: 2, interval: 1.2 }] },
      { groups: [{ type: 'swarm', count: 18, interval: 0.26 }, { type: 'fast', count: 6, interval: 0.4 }] },
      { groups: [{ type: 'tank', count: 5, interval: 1.0 }, { type: 'normal', count: 8, interval: 0.55 }] },
      { groups: [{ type: 'fast', count: 14, interval: 0.34 }, { type: 'tank', count: 4, interval: 1.0 }] },
      { groups: [{ type: 'swarm', count: 22, interval: 0.24 }, { type: 'tank', count: 4, interval: 1.0 }, { type: 'fast', count: 6, interval: 0.4 }] },
      { groups: [{ type: 'tank', count: 6, interval: 0.9 }, { type: 'fast', count: 12, interval: 0.34 }] },
      { groups: [{ type: 'boss', count: 1, interval: 0.5 }, { type: 'tank', count: 4, interval: 1.0 }, { type: 'fast', count: 10, interval: 0.36 }] },
      { groups: [{ type: 'boss', count: 2, interval: 2.0 }, { type: 'tank', count: 5, interval: 1.0 }, { type: 'fast', count: 12, interval: 0.34 }, { type: 'swarm', count: 16, interval: 0.26 }] },
    ],
  },
];
