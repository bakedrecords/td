import { MAX_TOWER_LEVEL } from './constants';

export type TowerTypeId = 'gun' | 'cannon' | 'frost' | 'sniper' | 'support';

/** レベルごとの性能・特殊効果。Lv で挙動が変化するタワーに対応する。 */
export interface TowerLevel {
  name?: string; // そのレベルの呼び名（任意）
  range: number;
  damage: number;
  fireRate: number; // 1 秒あたりの発射数
  splashRadius?: number; // 範囲攻撃の半径（任意）
  slowFactor?: number; // 命中した敵の速度に掛ける係数 0..1（任意）
  slowDuration?: number; // スロー持続秒数（任意）
  projectileColor?: string; // レベル別の弾の色（任意）
  supportFireRateMul?: number; // 補助塔: 周囲タワーの連射倍率
}

export interface TowerType {
  id: TowerTypeId;
  name: string;
  cost: number;
  color: string;
  projectileSpeed: number;
  projectileColor: string;
  isSupport?: boolean; // 補助塔（攻撃しない）
  levels: TowerLevel[]; // Lv1..Lv3
  desc: string; // 一覧に表示する役割・進化の説明
}

export const TOWER_TYPES: Record<TowerTypeId, TowerType> = {
  // Matenrou: ガン → マシンガン（連射UP）→ ファイア（範囲攻撃）
  gun: {
    id: 'gun',
    name: 'Matenrou',
    cost: 50,
    color: '#5ad1c4',
    projectileSpeed: 660,
    projectileColor: '#ffe27a',
    levels: [
      { name: 'ガン', range: 170, damage: 12, fireRate: 2.2 },
      { name: 'マシンガン', range: 185, damage: 16, fireRate: 3.4 },
      { name: 'ファイア', range: 195, damage: 22, fireRate: 3.0, splashRadius: 62, projectileColor: '#ff8a3c' },
    ],
    desc: 'Lv2 マシンガンで連射UP / Lv3 ファイアで範囲攻撃',
  },
  // Sae: 近距離・高火力。Lv で射程と威力が少しずつ上がる
  cannon: {
    id: 'cannon',
    name: 'Sae',
    cost: 90,
    color: '#ff9f43',
    projectileSpeed: 620,
    projectileColor: '#ffb86b',
    levels: [
      { name: '近距離', range: 110, damage: 40, fireRate: 1.1 },
      { range: 128, damage: 62, fireRate: 1.2 },
      { range: 148, damage: 92, fireRate: 1.35 },
    ],
    desc: '近距離・高火力。Lvで射程と威力UP',
  },
  // Eita: 減速。Lv3 で範囲攻撃＋範囲減速になる
  frost: {
    id: 'frost',
    name: 'Eita',
    cost: 70,
    color: '#7bb6ff',
    projectileSpeed: 560,
    projectileColor: '#bfe0ff',
    levels: [
      { name: 'フロスト', range: 160, damage: 6, fireRate: 1.4, slowFactor: 0.45, slowDuration: 1.4 },
      { range: 172, damage: 9, fireRate: 1.5, slowFactor: 0.4, slowDuration: 1.6 },
      { name: 'フロスト範囲', range: 184, damage: 12, fireRate: 1.5, slowFactor: 0.35, slowDuration: 1.8, splashRadius: 78 },
    ],
    desc: '減速。Lv3 で範囲攻撃＆範囲減速',
  },
  // Tsukahara: 長射程・高威力（射程は以前より控えめ）
  sniper: {
    id: 'sniper',
    name: 'Tsukahara',
    cost: 110,
    color: '#b07bff',
    projectileSpeed: 1150,
    projectileColor: '#d6bcff',
    levels: [
      { range: 250, damage: 64, fireRate: 0.5 },
      { range: 268, damage: 98, fireRate: 0.55 },
      { range: 286, damage: 150, fireRate: 0.6 },
    ],
    desc: '長射程・高威力の狙撃（連射は遅い）',
  },
  // ayase: 補助塔。周囲タワーの連射速度を上げる
  support: {
    id: 'support',
    name: 'ayase',
    cost: 80,
    color: '#ff7bd5',
    projectileSpeed: 0,
    projectileColor: '#ff7bd5',
    isSupport: true,
    levels: [
      { range: 150, damage: 0, fireRate: 0, supportFireRateMul: 1.3 },
      { range: 160, damage: 0, fireRate: 0, supportFireRateMul: 1.45 },
      { range: 170, damage: 0, fireRate: 0, supportFireRateMul: 1.6 },
    ],
    desc: '補助。周囲タワーの連射速度UP（攻撃しない）',
  },
};

/** パレット表示順 */
export const TOWER_TYPE_LIST: TowerType[] = [
  TOWER_TYPES.gun,
  TOWER_TYPES.cannon,
  TOWER_TYPES.frost,
  TOWER_TYPES.sniper,
  TOWER_TYPES.support,
];

export interface ComputedTowerStats {
  range: number;
  damage: number;
  fireRate: number;
}

const clampLevel = (type: TowerType, level: number): TowerLevel =>
  type.levels[Math.max(1, Math.min(level, type.levels.length)) - 1];

/** タワー種別とレベルから実効ステータスを返す。 */
export function towerStatsAt(type: TowerType, level: number): ComputedTowerStats {
  const lv = clampLevel(type, level);
  return { range: lv.range, damage: lv.damage, fireRate: lv.fireRate };
}

/** 補助塔の連射倍率（レベル依存）。補助塔でなければ 1。 */
export function supportFireRateMulAt(type: TowerType, level: number): number {
  return clampLevel(type, level).supportFireRateMul ?? 1;
}

/** 現在 level から level+1 へ強化するための費用。最大レベルなら null。 */
export function upgradeCost(type: TowerType, currentLevel: number): number | null {
  if (currentLevel >= MAX_TOWER_LEVEL) return null;
  return Math.round(type.cost * (0.8 + 0.5 * (currentLevel - 1)));
}
