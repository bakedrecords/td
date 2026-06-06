import type { EnemyTypeId } from './enemyTypes';

/** ウェーブ内で連続して湧く敵のまとまり。 */
export interface SpawnGroup {
  type: EnemyTypeId;
  count: number;
  interval: number; // 1 体ごとの間隔（秒）
}

export interface WaveDef {
  groups: SpawnGroup[];
}

/**
 * 各ウェーブの構成。グループは記述順に湧く。
 * 個々の敵の HP・速度は enemyBaseStats(wave) × 敵種別の倍率で決まる。
 */
export const WAVES: WaveDef[] = [
  { groups: [{ type: 'normal', count: 5, interval: 0.9 }] },
  {
    groups: [
      { type: 'normal', count: 8, interval: 0.8 },
      { type: 'fast', count: 3, interval: 0.5 },
    ],
  },
  {
    groups: [
      { type: 'swarm', count: 10, interval: 0.35 },
      { type: 'normal', count: 5, interval: 0.7 },
    ],
  },
  {
    groups: [
      { type: 'fast', count: 8, interval: 0.5 },
      { type: 'normal', count: 6, interval: 0.7 },
    ],
  },
  {
    groups: [
      { type: 'tank', count: 3, interval: 1.4 },
      { type: 'normal', count: 8, interval: 0.6 },
    ],
  },
  {
    groups: [
      { type: 'swarm', count: 16, interval: 0.3 },
      { type: 'fast', count: 6, interval: 0.45 },
    ],
  },
  {
    groups: [
      { type: 'tank', count: 4, interval: 1.2 },
      { type: 'fast', count: 10, interval: 0.4 },
    ],
  },
  {
    groups: [
      { type: 'normal', count: 10, interval: 0.6 },
      { type: 'swarm', count: 16, interval: 0.28 },
      { type: 'tank', count: 3, interval: 1.2 },
    ],
  },
  {
    groups: [
      { type: 'fast', count: 14, interval: 0.4 },
      { type: 'tank', count: 5, interval: 1.0 },
      { type: 'normal', count: 8, interval: 0.6 },
    ],
  },
  {
    groups: [
      { type: 'tank', count: 4, interval: 1.0 },
      { type: 'fast', count: 12, interval: 0.4 },
      { type: 'boss', count: 1, interval: 0.5 },
    ],
  },
];

/** ウェーブ番号（1 始まり）から敵の基準 HP・速度を返す。 */
export function enemyBaseStats(wave: number): { hp: number; speed: number } {
  return {
    hp: 20 + wave * 9,
    speed: 60 + wave * 3,
  };
}
