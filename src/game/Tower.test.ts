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
});
