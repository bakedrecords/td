import { describe, it, expect } from 'vitest';
import { Game } from './Game';
import { cellCenter } from './Path';

describe('Game', () => {
  it('初期状態が正しい', () => {
    const g = new Game();
    expect(g.state).toBe('ready');
    expect(g.lives).toBe(20);
    expect(g.money).toBe(150);
    expect(g.wave).toBe(0);
  });

  it('設置可能マスにタワーを置くとゴールドが減る', () => {
    const g = new Game();
    g.handlePointer(cellCenter(3, 3)); // 経路に隣接する設置可能マス
    expect(g.money).toBe(100);
  });

  it('経路マスにはタワーを置けない', () => {
    const g = new Game();
    g.handlePointer(cellCenter(4, 3)); // 経路上
    expect(g.money).toBe(150);
  });

  it('同じマスに二重設置できない', () => {
    const g = new Game();
    g.handlePointer(cellCenter(3, 3));
    g.handlePointer(cellCenter(3, 3));
    expect(g.money).toBe(100); // 1 基ぶんだけ
  });

  it('ウェーブを開始し、更新を回すと最終的に完了して ready に戻る', () => {
    const g = new Game();
    g.handlePointer(cellCenter(3, 3));
    g.handlePointer(cellCenter(6, 4));
    g.handlePointer(cellCenter(6, 5));

    // 下部のスタートボタン中心をタップ
    g.handlePointer({ x: 360, y: 1208 });
    expect(g.state).toBe('wave');
    expect(g.wave).toBe(1);

    // 最大 60 秒ぶん（1/60 刻み）回す
    let t = 0;
    while (g.state === 'wave' && t < 60) {
      g.update(1 / 60);
      t += 1 / 60;
    }

    expect(g.state).toBe('ready'); // WAVE 1 完了
    expect(g.lives).toBeGreaterThan(0);
  });
});
