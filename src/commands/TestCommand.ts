import { Bot } from 'mineflayer';
import { BaseCommand, CommandResult } from './BaseCommand.js';

/**
 * 测试命令
 * 用于测试调试命令系统的功能
 */
export class TestCommand extends BaseCommand {
  name = 'test';
  description = '测试调试命令系统';
  usage = '!test [参数]';

  async execute(bot: Bot, username: string, args: string[]): Promise<CommandResult> {
    const parsedArgs = this.parseArgs(args);

    if (parsedArgs.help || args.includes('--help')) {
      bot.chat(`[调试系统] 测试命令帮助:`);
      bot.chat(`!test - 显示基本测试信息`);
      bot.chat(`!test --echo <消息> - 回显消息`);
      bot.chat(`!test --info - 显示bot信息`);
      return this.success('已显示测试命令帮助');
    }

    if (parsedArgs.echo) {
      const message = args.slice(args.indexOf('--echo') + 1).join(' ');
      bot.chat(`[测试] 回显: ${message}`);
      return this.success(`已回显消息: ${message}`);
    }

    if (parsedArgs.info) {
      const health = Math.floor(bot.health);
      const food = Math.floor(bot.food);
      const position = bot.entity.position;

      bot.chat(`[Bot信息] 生命值: ${health}/20, 饥饿值: ${food}/20`);
      bot.chat(`[Bot信息] 位置: (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})`);
      return this.success('已显示bot信息');
    }

    // 默认测试
    bot.chat(`[测试] 调试命令系统工作正常!`);
    bot.chat(`[测试] 执行者: ${username}`);
    bot.chat(`[测试] 参数数量: ${args.length}`);

    if (args.length > 0) {
      bot.chat(`[测试] 参数: ${args.join(', ')}`);
    }

    return this.success('测试命令执行完成');
  }
}

// 导出命令实例
export const testCommand = new TestCommand();
