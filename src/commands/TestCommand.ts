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
      return this.success('测试命令帮助:\n!test - 显示基本测试信息\n!test --echo <消息> - 回显消息\n!test --info - 显示bot信息');
    }

    if (parsedArgs.echo) {
      const message = args.slice(args.indexOf('--echo') + 1).join(' ');
      return this.success(`[测试] 回显: ${message}`);
    }

    if (parsedArgs.info) {
      const health = Math.floor(bot.health);
      const food = Math.floor(bot.food);
      const position = bot.entity.position;
      return this.success(`[Bot信息] 生命值: ${health}/20, 饥饿值: ${food}/20\n[Bot信息] 位置: (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})`);
    }

    // 默认测试
    const info = args.length > 0 ? `参数: ${args.join(', ')}` : '无参数';
    return this.success(`调试命令系统工作正常!\n执行者: ${username}\n参数数量: ${args.length}\n${info}`);
  }
}

// 导出命令实例
export const testCommand = new TestCommand();
