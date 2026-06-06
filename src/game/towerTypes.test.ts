import { describe, it, expect } from 'vitest';
import {
  TOWER_TYPES,
  TOWER_TYPE_LIST,
  towerStatsAt,
  upgradeCost,
} from './towerTypes';
import { MAX_TOWER_LEVEL } from './constants';

describe('towerTypes', () => {
  it('パレットに全種別が含まれる', () => {
    expect(TOWER_TYPE_LIST.length).toBe(Object.keys(TOWER_TYPES).length);
  });

  it('レベルが上がるほど威力が増える', () => {
    const g = TOWER_TYPES.gun;
    expect(towerStatsAt(g, 2).damage).toBeGreaterThan(towerStatsAt(g, 1).damage);
    expect(towerStatsAt(g, 3).damage).toBeGreaterThan(towerStatsAt(g, 2).damage);
  });

  it('最大レベルでは強化費用が null、それ以外は正の値', () => {
    expect(upgradeCost(TOWER_TYPES.gun, MAX_TOWER_LEVEL)).toBeNull();
    expect(upgradeCost(TOWER_TYPES.gun, 1)).toBeGreaterThan(0);
  });
});
