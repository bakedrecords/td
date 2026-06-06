import { describe, it, expect } from 'vitest';
import { Tower } from './Tower';
import { Enemy } from './Enemy';
import { Projectile } from './Projectile';
import { TOWER_TYPES } from './towerTypes';
import { ENEMY_TYPES } from './enemyTypes';

describe('Tower', () => {
  it('射程内の敵に向けて弾を撃つ', () => {
    const e = new Enemy(ENEMY_TYPES.normal, 100, 0, 5); // 速度 0 でスポーン地点に静止
    const tower = new Tower({ x: e.pos.x + 30, y: e.pos.y }, TOWER_TYPES.gun, '0,0');
    const projectiles: Projectile[] = [];

    tower.update(1 / 60, [e], projectiles);

    expect(projectiles.length).toBe(1);
  });

  it('射程外の敵には撃たない', () => {
    const e = new Enemy(ENEMY_TYPES.normal, 100, 0, 5);
    const tower = new Tower({ x: e.pos.x + 5000, y: e.pos.y }, TOWER_TYPES.gun, '0,0');
    const projectiles: Projectile[] = [];

    tower.update(1 / 60, [e], projectiles);

    expect(projectiles.length).toBe(0);
  });

  it('アップグレードで威力・射程・連射が上がり、投資額が増える', () => {
    const tower = new Tower({ x: 0, y: 0 }, TOWER_TYPES.gun, '0,0');
    const d0 = tower.damage;
    const r0 = tower.range;
    const f0 = tower.fireRate;

    tower.applyUpgrade(40);

    expect(tower.level).toBe(2);
    expect(tower.damage).toBeGreaterThan(d0);
    expect(tower.range).toBeGreaterThan(r0);
    expect(tower.fireRate).toBeGreaterThan(f0);
    expect(tower.totalInvested).toBe(TOWER_TYPES.gun.cost + 40);
  });

  it('補助塔は攻撃せず、強化で連射倍率が上がる', () => {
    const e = new Enemy(ENEMY_TYPES.normal, 100, 0, 5);
    const sup = new Tower({ x: e.pos.x + 10, y: e.pos.y }, TOWER_TYPES.support, '0,0');
    const projectiles: Projectile[] = [];

    for (let i = 0; i < 60; i++) sup.update(1 / 60, [e], projectiles);

    expect(sup.isSupport).toBe(true);
    expect(projectiles.length).toBe(0); // 攻撃しない
    expect(sup.supportFireRateMul).toBeCloseTo(1.3);

    sup.applyUpgrade(50);
    expect(sup.supportFireRateMul).toBeGreaterThan(1.3);

    const gun = new Tower({ x: 0, y: 0 }, TOWER_TYPES.gun, '1,0');
    expect(gun.isSupport).toBe(false);
    expect(gun.supportFireRateMul).toBe(1);
  });

  it('連射バフ（buffMultiplier）があると発射数が増える', () => {
    const e = new Enemy(ENEMY_TYPES.normal, 100_000, 0, 5); // 大量 HP で死なない
    const pos = { x: e.pos.x + 20, y: e.pos.y };

    const buffed = new Tower(pos, TOWER_TYPES.gun, '0,0');
    buffed.buffMultiplier = 3;
    const pa: Projectile[] = [];
    for (let i = 0; i < 600; i++) buffed.update(1 / 600, [e], pa);

    const plain = new Tower(pos, TOWER_TYPES.gun, '1,0');
    const pb: Projectile[] = [];
    for (let i = 0; i < 600; i++) plain.update(1 / 600, [e], pb);

    expect(pa.length).toBeGreaterThan(pb.length);
  });

  it('Matenrou は Lv で名前が変わり、Lv3 で範囲攻撃になる', () => {
    const t = new Tower({ x: 0, y: 0 }, TOWER_TYPES.gun, '0,0');
    expect(t.levelName).toBe('ガン');
    expect(t.splashRadius).toBeUndefined();
    t.applyUpgrade(40);
    expect(t.levelName).toBe('マシンガン');
    t.applyUpgrade(65);
    expect(t.level).toBe(3);
    expect(t.levelName).toBe('ファイア');
    expect(t.splashRadius).toBeGreaterThan(0); // Lv3 で範囲化
  });

  it('Sae は近距離で、Lv で射程と威力が上がる', () => {
    const t = new Tower({ x: 0, y: 0 }, TOWER_TYPES.cannon, '0,0');
    expect(t.range).toBeLessThan(TOWER_TYPES.gun.levels[0].range); // ガンより短射程
    expect(t.splashRadius).toBeUndefined(); // 範囲攻撃は持たない
    const r1 = t.range;
    const d1 = t.damage;
    t.applyUpgrade(72);
    expect(t.range).toBeGreaterThan(r1);
    expect(t.damage).toBeGreaterThan(d1);
  });

  it('Eita は Lv3 で範囲化しても減速を保持する', () => {
    const t = new Tower({ x: 0, y: 0 }, TOWER_TYPES.frost, '0,0');
    expect(t.slowFactor).toBeGreaterThan(0);
    expect(t.slowFactor).toBeLessThan(1);
    expect(t.splashRadius).toBeUndefined();
    t.applyUpgrade(56);
    t.applyUpgrade(91);
    expect(t.level).toBe(3);
    expect(t.splashRadius).toBeGreaterThan(0); // 範囲化
    expect(t.slowFactor).toBeGreaterThan(0); // 減速も維持
  });

  it('Tsukahara の射程は控えめ（300 未満）', () => {
    expect(TOWER_TYPES.sniper.levels[0].range).toBeLessThan(300);
  });

  it('Sae は近接で、射程内の敵全員に当たる（弾は出ない）', () => {
    const e1 = new Enemy(ENEMY_TYPES.normal, 100, 0, 5);
    const e2 = new Enemy(ENEMY_TYPES.normal, 100, 0, 5);
    e1.pos.x = 100; e1.pos.y = 100;
    e2.pos.x = 140; e2.pos.y = 100;
    const sae = new Tower({ x: 100, y: 100 }, TOWER_TYPES.cannon, '0,0');
    const projectiles: Projectile[] = [];

    sae.update(0.001, [e1, e2], projectiles);

    expect(sae.isMelee).toBe(true);
    expect(projectiles.length).toBe(0); // 近接：弾を撃たない
    expect(e1.hp).toBeLessThan(100);
    expect(e2.hp).toBeLessThan(100);
  });

  it('攻撃力バフ（damageBuffMultiplier）で与ダメージが増える', () => {
    const e = new Enemy(ENEMY_TYPES.normal, 1000, 0, 5);
    const sae = new Tower({ x: e.pos.x, y: e.pos.y }, TOWER_TYPES.cannon, '0,0');
    sae.damageBuffMultiplier = 2;
    sae.update(0.001, [e], []);
    const base = TOWER_TYPES.cannon.levels[0].damage;
    expect(e.hp).toBe(1000 - Math.round(base * 2));
  });

  it('disableAttack 中は攻撃しない', () => {
    const e = new Enemy(ENEMY_TYPES.normal, 1000, 0, 5);
    const t = new Tower({ x: e.pos.x + 20, y: e.pos.y }, TOWER_TYPES.gun, '0,0');
    t.disableAttack(3);
    const projectiles: Projectile[] = [];
    for (let i = 0; i < 60; i++) t.update(1 / 60, [e], projectiles);
    expect(t.attackDisabled).toBe(true);
    expect(projectiles.length).toBe(0);
  });

  it('startFireBurst でバースト中は多く撃ち、終了後は攻撃不能になる', () => {
    const e = new Enemy(ENEMY_TYPES.normal, 100_000, 0, 5);
    const pos = { x: e.pos.x + 20, y: e.pos.y };

    const t = new Tower(pos, TOWER_TYPES.gun, '0,0');
    t.startFireBurst(3, 1, 5); // 1 秒×3、その後 5 秒攻撃不能
    const pa: Projectile[] = [];
    for (let i = 0; i < 60; i++) t.update(1 / 60, [e], pa);

    const plain = new Tower(pos, TOWER_TYPES.gun, '1,0');
    const pb: Projectile[] = [];
    for (let i = 0; i < 60; i++) plain.update(1 / 60, [e], pb);

    expect(pa.length).toBeGreaterThan(pb.length); // バーストで多く撃つ
    expect(t.attackDisabled).toBe(true); // バースト後は攻撃不能
    const after = pa.length;
    for (let i = 0; i < 60; i++) t.update(1 / 60, [e], pa);
    expect(pa.length).toBe(after); // 攻撃不能中は撃たない
  });

  it('moveTo で位置とセルキーが変わる', () => {
    const t = new Tower({ x: 10, y: 20 }, TOWER_TYPES.sniper, '1,1');
    t.moveTo({ x: 50, y: 60 }, '2,2');
    expect(t.cellKey).toBe('2,2');
    expect(t.pos.x).toBe(50);
    expect(t.pos.y).toBe(60);
  });
});
