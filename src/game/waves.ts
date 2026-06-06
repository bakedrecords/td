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

// ステージごとの難易度補正
const STAGE_HP_MUL = [1, 1.55, 2.25];
const STAGE_SPEED_ADD = [0, 8, 16];

/**
 * ウェーブ番号（1 始まり）とステージ番号（0 始まり）から敵の基準 HP・速度を返す。
 * 種別ごとの倍率はこれに乗算される。
 */
export function enemyBaseStats(wave: number, stageIndex = 0): { hp: number; speed: number } {
  const hpMul = STAGE_HP_MUL[stageIndex] ?? STAGE_HP_MUL[STAGE_HP_MUL.length - 1];
  const speedAdd = STAGE_SPEED_ADD[stageIndex] ?? STAGE_SPEED_ADD[STAGE_SPEED_ADD.length - 1];
  return {
    hp: Math.round((20 + wave * 9) * hpMul),
    speed: 60 + wave * 3 + speedAdd,
  };
}
