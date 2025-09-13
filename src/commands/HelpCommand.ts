import { Bot } from 'mineflayer';
import { BaseCommand, CommandResult } from './BaseCommand.js';

/**
 * 帮助命令
 * 显示所有可用命令的帮助信息
 */
export class HelpCommand extends BaseCommand {
  name = 'help';
  description = '显示所有可用命令的帮助信息';
  usage = '!help [命令名]';

  private availableCommands: Map<string, BaseCommand> = new Map();

  /**
   * 设置可用的命令列表
   */
  setAvailableCommands(commands: Map<string, BaseCommand>): void {
    this.availableCommands = commands;
  }

  async execute(bot: Bot, username: string, args: string[]): Promise<CommandResult> {
    const commandName = args[0];

    if (commandName) {
      // 显示特定命令的帮助
      const command = this.availableCommands.get(commandName);
      if (!command) {
        return this.error(`未知命令: ${commandName}`);
      }

      bot.chat(command.getHelp());
      return this.success(`已显示 ${commandName} 命令的帮助信息`);
    } else {
      // 显示所有命令的列表
      const commandNames = Array.from(this.availableCommands.keys());
      const commandsText = commandNames.join(', ');

      bot.chat(`[调试系统] 可用命令: ${commandsText}`);
      bot.chat('[调试系统] 使用 !help <命令名> 查看详细帮助');

      return this.success(`显示了 ${commandNames.length} 个可用命令`);
    }
  }
}

// 导出命令实例
export const helpCommand = new HelpCommand();
