import { describe, it, expect } from 'vitest';
import { Game } from './Game';
import { cellCenter } from './Path';
import { TOWER_TYPES } from './towerTypes';
import { STAGES } from './stages';

// 下部パネルのボタン中心座標（Game 内のレイアウトに対応）
const PALETTE_CANNON = { x: 219, y: 1128 }; // paletteRect(1) の中心
const UPGRADE_BTN = { x: 183, y: 1225 };
const SKILL_BTN = { x: 537, y: 1225 }; // 旧 売却ボタンの位置
const MAIN_ACTION = { x: 263, y: 1225 }; // 開始 / 早出しボタン
const INFO_BTN = { x: 617, y: 1225 };

/** タワー無しでも敵がゴールに抜けて現ウェーブが終わるまで進める。 */
function runUntilNotWave(g: Game, maxSec = 150): void {
  let t = 0;
  while (g.state === 'wave' && t < maxSec) {
    g.update(1 / 60);
    t += 1 / 60;
  }
}

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
    g.handlePointer(cellCenter(4, 3));
    expect(g.money).toBe(150);
  });

  it('パレットで種別を切り替えて建設できる（キャノン）', () => {
    const g = new Game();
    g.handlePointer(PALETTE_CANNON);
    g.handlePointer(cellCenter(3, 3));
    expect(g.money).toBe(150 - TOWER_TYPES.cannon.cost);
  });

  it('同じ種別のタワーは 1 基しか置けない', () => {
    const g = new Game();
    g.handlePointer(cellCenter(3, 3)); // ガン設置（money 100）
    g.handlePointer(cellCenter(5, 1)); // もう 1 つガンを置こうとする → 不可
    expect(g.money).toBe(150 - TOWER_TYPES.gun.cost);
  });

  it('タワーを選択して強化するとゴールドが減る', () => {
    const g = new Game();
    g.handlePointer(cellCenter(3, 3)); // gun, money 100
    g.handlePointer(cellCenter(3, 3)); // 選択
    g.handlePointer(UPGRADE_BTN); // gun Lv1->2 = round(50*0.8)=40
    expect(g.money).toBe(100 - 40);
  });

  it('スキルボタンはゴールドを払い戻さない（売却は廃止）', () => {
    const g = new Game();
    g.handlePointer(cellCenter(3, 3)); // gun, money 100
    g.handlePointer(cellCenter(3, 3)); // 選択
    g.handlePointer(SKILL_BTN); // Matenrou スキル（全体攻撃）
    expect(g.money).toBe(150 - TOWER_TYPES.gun.cost); // 100 のまま（払い戻し無し）
  });

  it('メインボタンでウェーブを開始でき、完了すると ready に戻る', () => {
    const g = new Game();
    g.handlePointer(cellCenter(3, 3)); // gun
    g.handlePointer(PALETTE_CANNON);
    g.handlePointer(cellCenter(6, 4)); // cannon
    g.handlePointer(MAIN_ACTION); // 開始
    expect(g.state).toBe('wave');
    expect(g.wave).toBe(1);

    runUntilNotWave(g);
    expect(g.state).toBe('ready');
    expect(g.wave).toBe(1);
    expect(g.lives).toBeGreaterThan(0);
  });

  it('ウェーブ終了後、約5秒で自動的に次のウェーブが始まる', () => {
    const g = new Game();
    g.handlePointer(MAIN_ACTION); // wave1 開始（タワー無し）
    expect(g.state).toBe('wave');

    runUntilNotWave(g); // 敵が抜けて wave1 完了
    expect(g.state).toBe('ready');
    expect(g.wave).toBe(1);

    // 5 秒強ぶん進めると自動スタート
    for (let i = 0; i < 5 * 60 + 12; i++) g.update(1 / 60);
    expect(g.state).toBe('wave');
    expect(g.wave).toBe(2);
  });

  it('ウェーブ中にメインボタンで次のウェーブを早出しできる', () => {
    const g = new Game();
    g.handlePointer(MAIN_ACTION); // wave1
    expect(g.state).toBe('wave');
    expect(g.wave).toBe(1);

    g.update(1 / 60);
    g.handlePointer(MAIN_ACTION); // 早出し
    expect(g.wave).toBe(2);
    expect(g.state).toBe('wave');
  });

  it('ステータス一覧を開くとゲームが一時停止し、閉じると再開する', () => {
    const g = new Game();
    g.handlePointer(MAIN_ACTION); // wave1
    runUntilNotWave(g); // wave1 完了 → ready（自動カウントダウン開始）
    expect(g.state).toBe('ready');

    g.handlePointer(INFO_BTN); // 一覧を開く（一時停止）
    for (let i = 0; i < 6 * 60; i++) g.update(1 / 60);
    expect(g.state).toBe('ready'); // 停止中なので自動スタートしない
    expect(g.wave).toBe(1);

    g.handlePointer({ x: 360, y: 400 }); // どこかをタップして閉じる
    for (let i = 0; i < 6 * 60; i++) g.update(1 / 60);
    expect(g.state).toBe('wave'); // 再開して自動スタート
    expect(g.wave).toBe(2);
  });

  it('初期はステージ1で、開始値はステージ定義に従う', () => {
    const g = new Game();
    expect(g.stageIndex).toBe(0);
    expect(g.money).toBe(STAGES[0].startMoney);
    expect(g.lives).toBe(STAGES[0].startLives);
  });

  it('ステージクリアでタップすると次のステージへ進む', () => {
    const g = new Game();
    g.state = 'stageclear'; // クリア状態を再現
    g.handlePointer({ x: 360, y: 600 });
    expect(g.stageIndex).toBe(1);
    expect(g.state).toBe('ready');
    expect(g.money).toBe(STAGES[1].startMoney);
  });

  it('ゲームオーバーでタップすると同じステージを再挑戦（開始値リセット）', () => {
    const g = new Game();
    g.state = 'stageclear';
    g.handlePointer({ x: 360, y: 600 }); // → STAGE 2
    expect(g.stageIndex).toBe(1);
    g.money = 3;
    g.state = 'gameover';
    g.handlePointer({ x: 360, y: 600 });
    expect(g.stageIndex).toBe(1); // 同じステージ
    expect(g.state).toBe('ready');
    expect(g.money).toBe(STAGES[1].startMoney);
  });

  it('全ステージ制覇でタップすると最初のステージに戻る', () => {
    const g = new Game();
    g.stageIndex = STAGES.length - 1;
    g.state = 'victory';
    g.handlePointer({ x: 360, y: 600 });
    expect(g.stageIndex).toBe(0);
    expect(g.state).toBe('ready');
    expect(g.money).toBe(STAGES[0].startMoney);
  });
});
