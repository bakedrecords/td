import { MAX_TOWER_LEVEL } from './constants';

export type TowerTypeId = 'gun' | 'cannon' | 'frost' | 'sniper';

export interface TowerType {
  id: TowerTypeId;
  name: string;
  cost: number;
  color: string;
  range: number;
  damage: number;
  fireRate: number; // 1 秒あたりの発射数
  projectileSpeed: number;
  projectileColor: string;
  /** 着弾点の周囲にも当たる範囲攻撃の半径（任意） */
  splashRadius?: number;
  /** 命中した敵の移動速度に掛ける係数 0..1（任意） */
  slowFactor?: number;
  /** スロー効果の持続秒数（任意） */
  slowDuration?: number;
  desc: string;
}

export const TOWER_TYPES: Record<TowerTypeId, TowerType> = {
  gun: {
    id: 'gun',
    name: 'ガン',
    cost: 50,
    color: '#5ad1c4',
    range: 170,
    damage: 12,
    fireRate: 2.2,
    projectileSpeed: 660,
    projectileColor: '#ffe27a',
    desc: 'バランス型・安価な連射砲',
  },
  cannon: {
    id: 'cannon',
    name: 'キャノン',
    cost: 90,
    color: '#ff9f43',
    range: 150,
    damage: 38,
    fireRate: 0.75,
    projectileSpeed: 480,
    projectileColor: '#ffb86b',
    splashRadius: 70,
    desc: '高威力・範囲ダメージ（群れに強い）',
  },
  frost: {
    id: 'frost',
    name: 'フロスト',
    cost: 70,
    color: '#7bb6ff',
    range: 160,
    damage: 6,
    fireRate: 1.4,
    projectileSpeed: 560,
    projectileColor: '#bfe0ff',
    slowFactor: 0.45,
    slowDuration: 1.4,
    desc: '低威力だが命中した敵を減速',
  },
  sniper: {
    id: 'sniper',
    name: 'スナイパー',
    cost: 110,
    color: '#b07bff',
    range: 330,
    damage: 64,
    fireRate: 0.5,
    projectileSpeed: 1150,
    projectileColor: '#d6bcff',
    desc: '超長射程・高威力だが連射が遅い',
  },
};

/** パレット表示順 */
export const TOWER_TYPE_LIST: TowerType[] = [
  TOWER_TYPES.gun,
  TOWER_TYPES.cannon,
  TOWER_TYPES.frost,
  TOWER_TYPES.sniper,
];

export interface ComputedTowerStats {
  range: number;
  damage: number;
  fireRate: number;
}

/** タワー種別とレベルから実効ステータスを計算する。 */
export function towerStatsAt(type: TowerType, level: number): ComputedTowerStats {
  const d = Math.pow(1.5, level - 1); // 威力 +50%/Lv
  const r = Math.pow(1.1, level - 1); // 射程 +10%/Lv
  const f = Math.pow(1.15, level - 1); // 連射 +15%/Lv
  return {
    range: Math.round(type.range * r),
    damage: Math.round(type.damage * d),
    fireRate: type.fireRate * f,
  };
}

/** 現在 level から level+1 へ強化するための費用。最大レベルなら null。 */
export function upgradeCost(type: TowerType, currentLevel: number): number | null {
  if (currentLevel >= MAX_TOWER_LEVEL) return null;
  return Math.round(type.cost * (0.8 + 0.5 * (currentLevel - 1)));
}
