import { Bot } from 'mineflayer';
import { BaseCommand, CommandResult } from './BaseCommand.js';
import { MoveAction } from '../actions/MoveAction.js';

/**
 * 移动命令
 * 让bot移动到命令发出者的位置
 */
export class MoveCommand extends BaseCommand {
  name = 'move';
  description = '移动到命令发出者的位置';
  usage = '!move\n移动到你的当前位置';


  async execute(bot: Bot, username: string, args: string[]): Promise<CommandResult> {
    try {
      // 检查是否有参数，如果有则报错
      if (args.length > 0) {
        return this.error('此命令不支持参数，请直接使用 !move 移动到你的位置');
      }

      // 获取命令发出者的位置
      const player = bot.players[username];
      if (!player || !player.entity) {
        return this.error(`未找到玩家 ${username} 的信息`);
      }

      const playerPos = player.entity.position;
      this.logger.info(`移动到玩家<${username}>的位置: (${playerPos.x}, ${playerPos.y}, ${playerPos.z})`);

      // 设置移动参数
      const moveParams = {
        type: 'coordinate' as const,
        x: playerPos.x,
        y: playerPos.y,
        z: playerPos.z,
        useRelativeCoords: false,
        distance: 1
      };

      // 创建并执行移动动作
      const moveAction = new MoveAction();
      const result = await moveAction.execute(bot, moveParams);

      if (result.success) {
        return this.success(`移动成功到达<${username}>的位置(${playerPos.x}, ${playerPos.y}, ${playerPos.z})`);
      } else {
        this.logger.warn(`移动命令执行失败: ${result.message}`);
        return this.error(result.message || '移动失败');
      }

    } catch (error) {
      const errorMsg = '移动命令执行失败，请稍后重试';
      this.logger.error(`移动命令执行异常: ${error instanceof Error ? error.message : String(error)}`);
      return this.error(errorMsg);
    }
  }


}

// 导出命令实例
export const moveCommand = new MoveCommand();
