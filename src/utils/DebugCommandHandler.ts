import { Bot } from 'mineflayer';
import { Logger } from './Logger.js';
import type { DebugCommandsConfig } from '../config.js';

/**
 * 调试命令处理器
 * 处理游戏内调试命令系统
 */
export class DebugCommandHandler {
  private bot: Bot;
  private logger: Logger;
  private config: DebugCommandsConfig;
  private commands: Map<string, CommandHandler> = new Map();

  constructor(bot: Bot, config: DebugCommandsConfig) {
    this.bot = bot;
    this.config = config;
    this.logger = new Logger('DebugCommandHandler');

    // 注册内置命令
    this.registerCommand('chat', this.handleChatCommand.bind(this));
    this.registerCommand('help', this.handleHelpCommand.bind(this));
  }

  /**
   * 注册命令处理器
   */
  private registerCommand(name: string, handler: CommandHandler): void {
    this.commands.set(name, handler);
    this.logger.debug(`注册调试命令: ${name}`);
  }

  /**
   * 处理聊天消息中的调试命令
   */
  public handleChatMessage(username: string, message: string): boolean {
    // 检查是否启用调试命令
    if (!this.config.enabled) {
      return false;
    }

    // 检查是否是管理员
    if (!this.isAdminPlayer(username)) {
      return false;
    }

    // 检查是否是调试命令（以!开头）
    if (!message.startsWith('!')) {
      return false;
    }

    // 解析命令
    const commandLine = message.substring(1).trim();
    const parts = commandLine.split(/\s+/);
    const commandName = parts[0].toLowerCase();
    const args = parts.slice(1);

    // 执行命令
    return this.executeCommand(username, commandName, args);
  }

  /**
   * 执行调试命令
   */
  private executeCommand(username: string, commandName: string, args: string[]): boolean {
    const handler = this.commands.get(commandName);

    if (!handler) {
      this.bot.chat(`[调试系统] 未知命令: ${commandName}`);
      return true;
    }

    try {
      handler(username, args);
      this.logger.info(`管理员 ${username} 执行命令: ${commandName} ${args.join(' ')}`);
      return true;
    } catch (error) {
      this.logger.error(`命令执行错误 ${commandName}:`, error);
      this.bot.chat(`[调试系统] 命令执行失败: ${error instanceof Error ? error.message : '未知错误'}`);
      return true;
    }
  }

  /**
   * 检查是否是管理员玩家
   */
  private isAdminPlayer(username: string): boolean {
    return this.config.adminPlayers.includes(username);
  }

  /**
   * 处理聊天命令
   */
  private handleChatCommand(username: string, args: string[]): void {
    if (args.length === 0) {
      this.bot.chat(`[调试系统] 用法: !chat <消息>`);
      return;
    }

    const message = args.join(' ');
    this.bot.chat(message);
    this.logger.info(`管理员 ${username} 让bot发送消息: ${message}`);
  }

  /**
   * 处理帮助命令
   */
  private handleHelpCommand(username: string, args: string[]): void {
    const availableCommands = Array.from(this.commands.keys()).join(', ');
    this.bot.chat(`[调试系统] 可用的命令: ${availableCommands}`);
    this.bot.chat(`[调试系统] 用法: !chat <消息> - 让bot发送指定消息`);
  }
}

/**
 * 命令处理器函数类型
 */
type CommandHandler = (username: string, args: string[]) => void;
