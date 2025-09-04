import { Bot } from 'mineflayer';
import { BaseAction, BaseActionParams, ActionResult } from '../minecraft/ActionInterface.js';
import { z } from 'zod';
import { MovementUtils, GoalType } from '../utils/MovementUtils.js';
import pathfinder from 'mineflayer-pathfinder';

interface KillMobParams extends BaseActionParams {
  /** 生物名称，例如 "cow" */
  mob: string;
  /** 等待生物死亡的超时时间，秒，默认 300 */
  timeout?: number;
}

/**
 * KillMobAction - 击杀附近指定名称的生物。
 * 若机器人已加载 pvp 插件则调用 pvp.attack，否则使用普通攻击。
 */
export class KillMobAction extends BaseAction<KillMobParams> {
  name = 'killMob';
  description = '击杀指定名称的生物';
  schema = z.object({
    mob: z.string().describe('目标生物名称 (字符串)'),
    timeout: z.number().int().positive().optional().describe('等待超时时间 (秒，可选，默认 300)'),
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

      // 攻击逻辑
      if (bot.pvp?.attack) {
        await bot.pvp.attack(targetEntity);
      } else {
        // 使用 simple attack：靠近然后 swingArm（简化处理）
        // 使用统一的移动工具类移动到目标实体附近，使用 GoalFollow 目标类型
        const moveResult = await MovementUtils.moveTo(
          bot,
          {
            type: 'entity',
            entity: params.mob,
            distance: 2, // 到达距离
            maxDistance: 50, // 最大移动距离
            goalType: GoalType.GoalFollow // 使用跟随目标类型
          }
        );
        if (!moveResult.success) {
          this.logger.warn(`移动到目标实体失败: ${moveResult.error}，尝试直接攻击`);
        }
        await bot.attack(targetEntity);
      }

      // 等待生物死亡
      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          const stillAlive = bot.entities[targetEntity.id];
          const elapsed = Date.now() - startTime;
          if (!stillAlive || elapsed > timeoutMs) {
            clearInterval(interval);
            resolve();
          }
        }, 1000);
      });

      const stillExists = bot.entities[targetEntity.id];
      if (stillExists) {
        return this.createErrorResult(`在 ${params.timeout ?? 300}s 内未能击杀 ${params.mob}`, 'TIMEOUT');
      }

      return this.createSuccessResult(`已成功击杀 ${params.mob}`);
    } catch (err) {
      return this.createExceptionResult(err, `击杀 ${params.mob} 失败`, 'KILL_FAILED');
    }
  }

  // MCP 工具由基类根据 schema 自动暴露（tool: kill_mob）
} 