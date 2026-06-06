import { describe, it, expect } from 'vitest';
import { Game } from './Game';
import { cellCenter } from './Path';
import { TOWER_TYPES } from './towerTypes';
import { SELL_REFUND_RATE } from './constants';

// 下部パネルのボタン中心座標（Game 内のレイアウトに対応）
const PALETTE_CANNON = { x: 272, y: 1133 }; // paletteRect(1) の中心
const UPGRADE_BTN = { x: 183, y: 1226 }; // upgradeBtn の中心
const SELL_BTN = { x: 537, y: 1226 }; // sellBtn の中心
const START_BTN = { x: 360, y: 1226 }; // startBtn の中心

describe('Game', () => {
  it('初期状態が正しい', () => {
    const g = new Game();
    expect(g.state).toBe('ready');
    expect(g.lives).toBe(20);
    expect(g.money).toBe(150);
    expect(g.wave).toBe(0);
  });

  it('設置可能マスにタワー（ガン）を置くとゴールドが減る', () => {
    const g = new Game();
    g.handlePointer(cellCenter(3, 3));
    expect(g.money).toBe(150 - TOWER_TYPES.gun.cost);
  });

  it('経路マスにはタワーを置けない', () => {
    const g = new Game();
    g.handlePointer(cellCenter(4, 3)); // 経路上
    expect(g.money).toBe(150);
  });

  it('同じマスへの再タップは選択になり、二重設置にはならない', () => {
    const g = new Game();
    g.handlePointer(cellCenter(3, 3));
    g.handlePointer(cellCenter(3, 3));
    expect(g.money).toBe(150 - TOWER_TYPES.gun.cost);
  });

  it('パレットで種別を切り替えて建設できる（キャノン）', () => {
    const g = new Game();
    g.handlePointer(PALETTE_CANNON);
    g.handlePointer(cellCenter(3, 3));
    expect(g.money).toBe(150 - TOWER_TYPES.cannon.cost);
  });

  it('タワーを選択して強化するとゴールドが減る', () => {
    const g = new Game();
    g.handlePointer(cellCenter(3, 3)); // 建設（gun, money 100）
    g.handlePointer(cellCenter(3, 3)); // 選択
    g.handlePointer(UPGRADE_BTN); // 強化（gun Lv1->2 = round(50*0.8)=40）
    expect(g.money).toBe(100 - 40);
  });

  it('タワーを選択して売却するとゴールドが払い戻される', () => {
    const g = new Game();
    g.handlePointer(cellCenter(3, 3)); // 建設（invested 50, money 100）
    g.handlePointer(cellCenter(3, 3)); // 選択
    g.handlePointer(SELL_BTN); // 売却
    expect(g.money).toBe(100 + Math.round(TOWER_TYPES.gun.cost * SELL_REFUND_RATE));
  });

  it('ウェーブを開始し、更新を回すと最終的に完了して ready に戻る', () => {
    const g = new Game();
    g.handlePointer(cellCenter(3, 3));
    g.handlePointer(cellCenter(6, 4));
    g.handlePointer(cellCenter(6, 5));

    g.handlePointer(START_BTN);
    expect(g.state).toBe('wave');
    expect(g.wave).toBe(1);

    let t = 0;
    while (g.state === 'wave' && t < 90) {
      g.update(1 / 60);
      t += 1 / 60;
    }

    expect(g.state).toBe('ready');
    expect(g.lives).toBeGreaterThan(0);
  });
});
