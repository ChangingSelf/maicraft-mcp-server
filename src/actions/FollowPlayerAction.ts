import { Bot } from 'mineflayer';
import { BaseAction, BaseActionParams } from '../minecraft/ActionInterface.js';
import { z } from 'zod';
import pathfinder from 'mineflayer-pathfinder';

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
  schema = z.object({
    player: z.string().describe('目标玩家名称 (字符串)'),
    distance: z.number().int().positive().optional().describe('跟随距离 (数字，可选，默认 3)'),
    timeout: z.number().int().positive().optional().describe('超时时间 (秒，可选，默认 5)'),
  });

  // 校验和参数描述由基类通过 schema 自动提供

  async execute(bot: Bot, params: FollowPlayerParams): Promise<any> {
    try {
      // 检查 pathfinder 插件
      if (!bot.pathfinder) {
        return this.createErrorResult('路径寻找插件未加载，请先加载 mineflayer-pathfinder 插件', 'PATHFINDER_NOT_LOADED');
      }

      const followDistance = params.distance ?? 3;
      const timeoutSec = params.timeout ?? 5;
      const playerName = params.player;

      const targetPlayer = bot.players[playerName];
      if (!targetPlayer || !targetPlayer.entity) {
        return this.createErrorResult(`未找到玩家 ${playerName}，请确保其在附近`, 'PLAYER_NOT_FOUND');
      }

      // 获取 GoalFollow
      const { GoalFollow } = pathfinder.goals;
      if (!GoalFollow) {
        return this.createErrorResult('mineflayer-pathfinder goals 未加载', 'PATHFINDER_NOT_LOADED');
      }

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

  // MCP 工具由基类根据 schema 自动暴露（tool: follow_player）
}