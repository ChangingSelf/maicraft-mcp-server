import { Bot } from 'mineflayer';
import { BaseAction, BaseActionParams } from '../minecraft/ActionInterface.js';

interface FollowPlayerParams extends BaseActionParams {
  /** 目标玩家名称 */
  player: string;
  /** 跟随距离 (格)，默认 3 */
  distance?: number;
  /** 超时时间 (秒)，默认 60 */
  timeout?: number;
}

/**
 * FollowPlayerAction - 跟随指定玩家，直到超时或玩家离线。
 * 参考 MineLand high_level_action/followPlayer.js 实现。
 */
export class FollowPlayerAction extends BaseAction<FollowPlayerParams> {
  name = 'followPlayer';
  description = '跟随指定玩家';

  validateParams(params: FollowPlayerParams): boolean {
    return this.validateStringParams(params, ['player']) &&
           (typeof params.distance === 'undefined' || typeof params.distance === 'number') &&
           (typeof params.timeout === 'undefined' || typeof params.timeout === 'number');
  }

  getParamsSchema(): Record<string, string> {
    return {
      player: '目标玩家名称 (字符串)',
      distance: '跟随距离 (数字，可选，默认 3)',
      timeout: '超时时间 (秒，可选，默认 60)'
    };
  }

  async execute(bot: Bot, params: FollowPlayerParams): Promise<any> {
    try {
      // 检查 pathfinder 插件
      if (!bot.pathfinder) {
        return this.createErrorResult('路径寻找插件未加载，请先加载 mineflayer-pathfinder 插件', 'PATHFINDER_NOT_LOADED');
      }

      const followDistance = params.distance ?? 3;
      const timeoutSec = params.timeout ?? 60;
      const playerName = params.player;

      const targetPlayer = bot.players[playerName];
      if (!targetPlayer || !targetPlayer.entity) {
        return this.createErrorResult(`未找到玩家 ${playerName}，请确保其在附近`, 'PLAYER_NOT_FOUND');
      }

      // 动态导入 GoalFollow
      const pathfinderModule = await import('mineflayer-pathfinder');
      const GoalFollow = pathfinderModule.goals.GoalFollow;

      return await new Promise<any>((resolve) => {
        let followInterval: NodeJS.Timeout | null = null;
        let timedOut = false;

        // 超时处理
        const timeoutId = setTimeout(() => {
          timedOut = true;
          if (followInterval) clearInterval(followInterval);
          bot.pathfinder.setGoal(null);
          resolve(this.createSuccessResult(`已停止跟随 (超时 ${timeoutSec}s)`));
        }, timeoutSec * 1000);

        // 监听玩家离线
        const onPlayerLeft = (left: any) => {
          if (left.username === playerName) {
            clearTimeout(timeoutId);
            if (followInterval) clearInterval(followInterval);
            bot.pathfinder.setGoal(null);
            bot.removeListener('playerLeft', onPlayerLeft);
            resolve(this.createSuccessResult(`${playerName} 已离线，停止跟随`));
          }
        };

        bot.on('playerLeft', onPlayerLeft);

        // 定时检查距离
        followInterval = setInterval(() => {
          const p = bot.players[playerName];
          if (!p || !p.entity) {
            // offline
            onPlayerLeft({ username: playerName });
            return;
          }

          const dist = bot.entity.position.distanceTo(p.entity.position);
          if (dist > followDistance) {
            const goal = new GoalFollow(p.entity, followDistance);
            bot.pathfinder.setGoal(goal, true);
          } else {
            bot.pathfinder.setGoal(null);
          }
        }, 1000);
      });
    } catch (err) {
      return this.createExceptionResult(err, '跟随失败', 'FOLLOW_FAILED');
    }
  }
} 