import { Bot } from 'mineflayer';
import { GameAction, ActionResult, BaseActionParams } from '../minecraft/ActionInterface';

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
export class KillMobAction implements GameAction<KillMobParams> {
  name = 'killMob';
  description = '击杀指定名称的生物';

  validateParams(params: KillMobParams): boolean {
    return typeof params.mob === 'string' && params.mob.length > 0;
  }

  getParamsSchema(): Record<string, string> {
    return {
      mob: '目标生物名称 (字符串)',
      timeout: '等待超时时间 (秒，可选，默认 300)'
    };
  }

  async execute(bot: Bot, params: KillMobParams): Promise<ActionResult> {
    try {
      const timeoutMs = (params.timeout ?? 300) * 1000;
      const startTime = Date.now();

      // 寻找最近目标生物
      const targetEntity = bot.nearestEntity((e: any) => e.name === params.mob && e.position.distanceTo(bot.entity.position) < 64);
      if (!targetEntity) {
        return {
          success: false,
          message: `附近未发现 ${params.mob}，请先探索或靠近目标`,
          error: 'MOB_NOT_FOUND'
        };
      }

      // 攻击逻辑
      if (bot.pvp?.attack) {
        await bot.pvp.attack(targetEntity);
      } else {
        // 使用 simple attack：靠近然后 swingArm（简化处理）
        if (bot.pathfinder?.goto) {
          const { goals } = await import('mineflayer-pathfinder');
          const { GoalNear } = goals;
          const goal = new GoalNear(targetEntity.position.x, targetEntity.position.y, targetEntity.position.z, 2);
          await bot.pathfinder.goto(goal);
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
        return {
          success: false,
          message: `在 ${params.timeout ?? 300}s 内未能击杀 ${params.mob}`,
          error: 'TIMEOUT'
        };
      }

      return {
        success: true,
        message: `已成功击杀 ${params.mob}`
      };
    } catch (err) {
      return {
        success: false,
        message: `击杀 ${params.mob} 失败: ${err instanceof Error ? err.message : String(err)}`,
        error: 'KILL_FAILED'
      };
    }
  }
} 