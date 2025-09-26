import { Bot } from 'mineflayer';
import { BaseAction, BaseActionParams, ActionResult } from '../minecraft/ActionInterface.js';
import { z } from 'zod';
import { MovementUtils, GoalType } from '../utils/MovementUtils.js';
import { WeaponUtils } from '../utils/WeaponUtils.js';
import pathfinder from 'mineflayer-pathfinder-mai';

interface KillMobParams extends BaseActionParams {
  /** 生物名称，例如 "cow" */
  mob: string;
  /** 等待生物死亡的超时时间，秒，默认 300 */
  timeout?: number;
  /** 强制使用远程攻击，可选 */
  forceRanged?: boolean;
  /** 强制使用近战攻击，可选 */
  forceMelee?: boolean;
}

/**
 * KillMobAction - 击杀附近指定名称的生物。
 * 智能选择攻击方式：飞行生物使用远程攻击（hawkEye），地面生物装备最佳武器进行近战。
 * 若机器人已加载 pvp 插件则调用 pvp.attack，否则使用普通攻击。
 */
export class KillMobAction extends BaseAction<KillMobParams> {
  name = 'killMob';
  description = '击杀指定名称的生物';
  schema = z.object({
    mob: z.string().describe('目标生物名称 (字符串)'),
    timeout: z.number().int().positive().optional().describe('等待超时时间 (秒，可选，默认 300)'),
    forceRanged: z.boolean().optional().describe('强制使用远程攻击 (可选)'),
    forceMelee: z.boolean().optional().describe('强制使用近战攻击 (可选)'),
  });

  // 校验和参数描述由基类通过 schema 自动提供

  async execute(bot: Bot, params: KillMobParams): Promise<ActionResult> {
    try {
      const timeoutMs = (params.timeout ?? 300) * 1000;
      const startTime = Date.now();

      // 寻找最近目标生物
      const targetEntity = bot.nearestEntity((e: any) => e.name === params.mob && e.position.distanceTo(bot.entity.position) < 64);
      if (!targetEntity) {
        return this.createErrorResult(`附近未发现 ${params.mob}，请先探索或靠近目标`, 'MOB_NOT_FOUND');
      }

      this.logger.info(`发现目标生物 ${params.mob}，位置: ${targetEntity.position.x.toFixed(1)}, ${targetEntity.position.y.toFixed(1)}, ${targetEntity.position.z.toFixed(1)}`);

      // 装备护甲
      bot.armorManager.equipAll();

      // 决定攻击方式
      let useRangedAttack = false;
      
      if (params.forceRanged && params.forceMelee) {
        return this.createErrorResult('不能同时强制使用远程和近战攻击', 'INVALID_PARAMS');
      }
      
      if (params.forceRanged) {
        useRangedAttack = true;
        this.logger.info('强制使用远程攻击');
      } else if (params.forceMelee) {
        useRangedAttack = false;
        this.logger.info('强制使用近战攻击');
      } else {
        // 智能选择攻击方式
        useRangedAttack = WeaponUtils.shouldUseRangedAttack(bot, targetEntity);
        const attackType = useRangedAttack ? '远程' : '近战';
        const reason = WeaponUtils.isFlyingEntity(targetEntity) ? '(飞行生物)' : '(地面生物)';
        this.logger.info(`智能选择${attackType}攻击${reason}`);
      }

      // 执行攻击
      if (useRangedAttack) {
        return await this.executeRangedAttack(bot, targetEntity, timeoutMs, startTime, params);
      } else {
        return await this.executeMeleeAttack(bot, targetEntity, timeoutMs, startTime, params);
      }

    } catch (err) {
      return this.createExceptionResult(err, `击杀 ${params.mob} 失败`, 'KILL_FAILED');
    }
  }

  /**
   * 执行远程攻击
   */
  private async executeRangedAttack(bot: Bot, targetEntity: any, timeoutMs: number, startTime: number, params: KillMobParams): Promise<ActionResult> {
    // 装备最佳远程武器
    const weaponResult = await WeaponUtils.equipBestRangedWeapon(bot);
    if (!weaponResult.success) {
      this.logger.warn(`装备远程武器失败: ${weaponResult.message}，尝试近战攻击`);
      return await this.executeMeleeAttack(bot, targetEntity, timeoutMs, startTime, params);
    }

    this.logger.info(weaponResult.message);

    // 检查是否需要弹药
    if (WeaponUtils.needsAmmo(weaponResult.weapon.name) && !WeaponUtils.hasAmmo(bot, weaponResult.weapon.name)) {
      this.logger.warn('没有足够的弹药，切换到近战攻击');
      return await this.executeMeleeAttack(bot, targetEntity, timeoutMs, startTime, params);
    }

    // 使用hawkEye进行精确攻击
    this.logger.info('使用hawkEye进行精确远程攻击');
    
    // 保持攻击距离
    const attackDistance = WeaponUtils.getAttackDistance(targetEntity, true);
    const currentDistance = targetEntity.position.distanceTo(bot.entity.position);
    
    if (currentDistance > attackDistance + 5) {
      // 太远了，需要靠近一些
      const moveResult = await MovementUtils.moveTo(bot, {
        type: 'entity',
        entity: params.mob,
        distance: attackDistance,
        maxDistance: 50,
        goalType: GoalType.GoalFollow
      });
      
      if (!moveResult.success) {
        this.logger.warn(`移动到攻击距离失败: ${moveResult.error}`);
      }
    }

    // 开始hawkEye自动攻击
    bot.hawkEye.autoAttack(targetEntity, weaponResult.weapon.name);

    // 等待生物死亡
    await this.waitForMobDeath(bot, targetEntity, timeoutMs, startTime);

    // 停止hawkEye攻击
    bot.hawkEye.stop();

    const stillExists = bot.entities[targetEntity.id];
    if (stillExists) {
      return this.createErrorResult(`在 ${params.timeout ?? 300}s 内未能击杀 ${params.mob}`, 'TIMEOUT');
    }

    return this.createSuccessResult(`已成功使用hawkEye远程攻击击杀 ${params.mob}`);
  }


  /**
   * 执行近战攻击
   */
  private async executeMeleeAttack(bot: Bot, targetEntity: any, timeoutMs: number, startTime: number, params: KillMobParams): Promise<ActionResult> {
    // 装备最佳近战武器
    const weaponResult = await WeaponUtils.equipBestMeleeWeapon(bot);
    if (weaponResult.success) {
      this.logger.info(weaponResult.message);
    } else {
      this.logger.warn(`装备近战武器失败: ${weaponResult.message}，使用默认武器`);
    }

    // 使用现有的攻击逻辑
    if (bot.pvp?.attack) {
      this.logger.info('使用PVP插件进行近战攻击');
      await bot.pvp.attack(targetEntity);
    } else {
      this.logger.info('使用简单近战攻击');
      // 移动到目标附近
      const moveResult = await MovementUtils.moveTo(bot, {
        type: 'entity',
        entity: params.mob,
        distance: 2,
        maxDistance: 50,
        goalType: GoalType.GoalFollow
      });
      
      if (!moveResult.success) {
        this.logger.warn(`移动到目标实体失败: ${moveResult.error}，尝试直接攻击`);
      }
      
      await bot.attack(targetEntity);
    }

    // 等待生物死亡
    await this.waitForMobDeath(bot, targetEntity, timeoutMs, startTime);

    const stillExists = bot.entities[targetEntity.id];
    if (stillExists) {
      return this.createErrorResult(`在 ${params.timeout ?? 300}s 内未能击杀 ${params.mob}`, 'TIMEOUT');
    }

    return this.createSuccessResult(`已成功使用近战攻击击杀 ${params.mob}`);
  }


  /**
   * 等待生物死亡
   */
  private async waitForMobDeath(bot: Bot, targetEntity: any, timeoutMs: number, startTime: number): Promise<void> {
    return new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        const stillAlive = bot.entities[targetEntity.id];
        const elapsed = Date.now() - startTime;
        if (!stillAlive || elapsed > timeoutMs) {
          clearInterval(interval);
          resolve();
        }
      }, 1000);
    });
  }

  // MCP 工具由基类根据 schema 自动暴露（tool: kill_mob）
} 