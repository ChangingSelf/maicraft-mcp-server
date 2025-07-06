import { Bot } from 'mineflayer';
import { GameAction, ActionResult, BaseActionParams } from '../minecraft/ActionInterface';

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
export class FollowPlayerAction implements GameAction<FollowPlayerParams> {
  name = 'followPlayer';
  description = '跟随指定玩家';

  validateParams(params: FollowPlayerParams): boolean {
    return typeof params.player === 'string' && params.player.length > 0;
  }

  getParamsSchema(): Record<string, string> {
    return {
      player: '目标玩家名称 (字符串)',
      distance: '跟随距离 (数字，可选，默认 3)',
      timeout: '超时时间 (秒，可选，默认 60)'
    };
  }

  async execute(bot: Bot, params: FollowPlayerParams): Promise<ActionResult> {
    try {
      // 检查 pathfinder 插件
      if (!bot.pathfinder) {
        return {
          success: false,
          message: '路径寻找插件未加载，请先加载 mineflayer-pathfinder 插件',
          error: 'PATHFINDER_NOT_LOADED'
        };
      }

      const followDistance = params.distance ?? 3;
      const timeoutSec = params.timeout ?? 60;
      const playerName = params.player;

      const targetPlayer = bot.players[playerName];
      if (!targetPlayer || !targetPlayer.entity) {
        return {
          success: false,
          message: `未找到玩家 ${playerName}，请确保其在附近`,
          error: 'PLAYER_NOT_FOUND'
        };
      }

      const { goals } = await import('mineflayer-pathfinder');
      const GoalFollow = (goals as any).GoalFollow;

      return await new Promise<ActionResult>((resolve) => {
        let followInterval: NodeJS.Timeout | null = null;
        let timedOut = false;

        // 超时处理
        const timeoutId = setTimeout(() => {
          timedOut = true;
          if (followInterval) clearInterval(followInterval);
          bot.pathfinder.setGoal(null);
          resolve({ success: true, message: `已停止跟随 (超时 ${timeoutSec}s)` });
        }, timeoutSec * 1000);

        // 监听玩家离线
        const onPlayerLeft = (left: any) => {
          if (left.username === playerName) {
            clearTimeout(timeoutId);
            if (followInterval) clearInterval(followInterval);
            bot.pathfinder.setGoal(null);
            bot.removeListener('playerLeft', onPlayerLeft);
            resolve({ success: true, message: `${playerName} 已离线，停止跟随` });
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
      return {
        success: false,
        message: `跟随失败: ${err instanceof Error ? err.message : String(err)}`,
        error: 'FOLLOW_FAILED'
      };
    }
  }
} 