export type EnemyTypeId = 'normal' | 'fast' | 'tank' | 'swarm' | 'boss';

export interface EnemyType {
  id: EnemyTypeId;
  name: string;
  color: string;
  innerColor: string;
  radius: number;
  hpMul: number; // ウェーブ基準 HP への倍率
  speedMul: number; // ウェーブ基準速度への倍率
  reward: number; // 撃破報酬の基本値
  armor: number; // 1 発ごとのダメージから差し引く固定値
}

export const ENEMY_TYPES: Record<EnemyTypeId, EnemyType> = {
  normal: {
    id: 'normal',
    name: 'ノーマル',
    color: '#ff7a5c',
    innerColor: '#c2452c',
    radius: 22,
    hpMul: 1,
    speedMul: 1,
    reward: 4,
    armor: 0,
  },
  fast: {
    id: 'fast',
    name: 'ファスト',
    color: '#ffd35c',
    innerColor: '#c79520',
    radius: 17,
    hpMul: 0.6,
    speedMul: 1.9,
    reward: 5,
    armor: 0,
  },
  tank: {
    id: 'tank',
    name: 'タンク',
    color: '#b07bff',
    innerColor: '#6f3fb8',
    radius: 28,
    hpMul: 3.2,
    speedMul: 0.65,
    reward: 9,
    armor: 4,
  },
  swarm: {
    id: 'swarm',
    name: 'スウォーム',
    color: '#7bff9f',
    innerColor: '#2fae5a',
    radius: 13,
    hpMul: 0.35,
    speedMul: 1.2,
    reward: 3,
    armor: 0,
  },
  boss: {
    id: 'boss',
    name: 'ボス',
    color: '#ff4d6d',
    innerColor: '#a31230',
    radius: 36,
    hpMul: 8,
    speedMul: 0.6,
    reward: 60,
    armor: 8,
  },
};

/** 一覧表示などで使う敵種別の並び順。 */
export const ENEMY_TYPE_LIST: EnemyType[] = [
  ENEMY_TYPES.normal,
  ENEMY_TYPES.fast,
  ENEMY_TYPES.tank,
  ENEMY_TYPES.swarm,
  ENEMY_TYPES.boss,
];
