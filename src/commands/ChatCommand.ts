import { Bot } from 'mineflayer';
import { BaseCommand, CommandResult } from './BaseCommand.js';

/**
 * 聊天命令
 * 让bot发送指定消息
 */
export class ChatCommand extends BaseCommand {
  name = 'chat';
  description = '让bot发送指定消息';
  usage = '!chat <消息内容>';

  async execute(bot: Bot, username: string, args: string[]): Promise<CommandResult> {
    if (args.length === 0) {
      return this.error('请提供要发送的消息内容');
    }

    const message = args.join(' ');

    try {
      bot.chat(message);
      this.logger.info(`管理员 ${username} 让bot发送消息: ${message}`);
      return this.success(`已发送消息: ${message}`);
    } catch (error) {
      this.logger.error(`发送消息失败: ${error}`);
      return this.error('发送消息失败，请稍后重试');
    }
  }
}

// 导出命令实例
export const chatCommand = new ChatCommand();
