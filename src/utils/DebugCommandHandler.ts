import { Bot } from 'mineflayer';
import { Logger } from './Logger.js';
import { BaseCommand, DebugCommand } from '../commands/BaseCommand.js';
import type { DebugCommandsConfig } from '../config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

/**
 * 调试命令处理器
 * 处理游戏内调试命令系统
 */
export class DebugCommandHandler {
  private bot: Bot;
  private logger: Logger;
  private config: DebugCommandsConfig;
  private commands: Map<string, DebugCommand> = new Map();

  constructor(bot: Bot, config: DebugCommandsConfig) {
    this.bot = bot;
    this.config = config;
    this.logger = new Logger('DebugCommandHandler');
  }

  /**
   * 自动发现并注册命令
   */
  async discoverAndRegisterCommands(): Promise<void> {
    const discoveredCommands: DebugCommand[] = [];

    // 获取当前模块目录
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    // 候选目录列表 - 优先使用 dist 目录（生产环境），然后是 src 目录（开发环境）
    const candidateDirs = [
      path.resolve(__dirname, '../commands'),  // dist/commands
      path.resolve(__dirname, '../../src/commands'),  // src/commands
      './dist/commands',
      './src/commands'
    ];

    for (const dir of candidateDirs) {
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
        continue;
      }

      const files = fs.readdirSync(dir)
        .filter((f) => /\.(mjs|cjs|js|ts)$/.test(f) && !/\.d\.ts$/.test(f) && !f.includes('BaseCommand'));

      for (const file of files) {
        const full = path.join(dir, file);
        try {
          const mod = await import(pathToFileURL(full).href);

          // 检查模块导出的值
          const exportedValues: unknown[] = Object.values(mod);

          for (const value of exportedValues) {
            try {
              if (!value) continue;

              // 检查是否是 BaseCommand 的实例
              if (this.isDebugCommand(value)) {
                const command = value as DebugCommand;
                discoveredCommands.push(command);
                this.logger.debug(`发现调试命令: ${command.name}`);
              }
            } catch {}
          }
        } catch (err) {
          this.logger.warn(`加载命令模块失败: ${full}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // 如果从当前目录找到了命令，就不再扫描其他目录
      if (discoveredCommands.length > 0) break;
    }

    // 注册发现的命令
    for (const command of discoveredCommands) {
      this.registerCommand(command);
    }

    // 更新帮助命令的可用命令列表
    const helpCommand = this.commands.get('help');
    if (helpCommand && 'setAvailableCommands' in helpCommand) {
      (helpCommand as any).setAvailableCommands(this.commands);
    }

    if (discoveredCommands.length > 0) {
      this.logger.info(`已自动发现并注册 ${discoveredCommands.length} 个调试命令: ${discoveredCommands.map(c => c.name).join(', ')}`);
    } else {
      this.logger.warn('未发现任何调试命令，请检查命令文件是否存在且导出正确');
    }
  }

  /**
   * 检查对象是否是调试命令
   */
  private isDebugCommand(value: unknown): value is DebugCommand {
    return (
      typeof value === 'object' &&
      value !== null &&
      'name' in value &&
      'description' in value &&
      'execute' in value &&
      'getHelp' in value &&
      typeof (value as any).name === 'string' &&
      typeof (value as any).description === 'string' &&
      typeof (value as any).execute === 'function' &&
      typeof (value as any).getHelp === 'function'
    );
  }

  /**
   * 注册命令
   */
  private registerCommand(command: DebugCommand): void {
    this.commands.set(command.name, command);

    // 如果命令支持配置设置，则传递配置
    if ('setConfig' in command && typeof command.setConfig === 'function') {
      (command as any).setConfig(this.config);
    }

    this.logger.debug(`注册调试命令: ${command.name}`);
  }

  /**
   * 处理聊天消息中的调试命令
   */
  public async handleChatMessage(username: string, message: string): Promise<boolean> {
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
    return await this.executeCommand(username, commandName, args);
  }

  /**
   * 执行调试命令
   */
  private async executeCommand(username: string, commandName: string, args: string[]): Promise<boolean> {
    const command = this.commands.get(commandName);

    if (!command) {
      this.bot.chat(`[调试系统] 未知命令: ${commandName}`);
      return true;
    }

    try {
      const result = await command.execute(this.bot, username, args);

      // 根据配置决定是否在游戏中输出反馈
      const shouldChat = this.config.chatFeedback !== false;

      if (shouldChat && result.message) {
        if (result.success) {
          // 成功消息
          this.bot.chat(`[调试系统] ${result.message}`);
        } else {
          // 错误消息
          this.bot.chat(`[调试系统] ${result.message}`);
        }
      }

      this.logger.info(`管理员 ${username} 执行命令: ${commandName} ${args.join(' ')} - ${result.success ? '成功' : '失败'}`);
      return true;
    } catch (error) {
      this.logger.error(`命令执行错误 ${commandName}:`, error);
      // 异常情况下总是输出错误信息
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
   * 获取已注册的命令列表
   */
  public getRegisteredCommands(): string[] {
    return Array.from(this.commands.keys());
  }

  /**
   * 获取命令信息
   */
  public getCommandInfo(name: string): { description: string; usage?: string } | null {
    const command = this.commands.get(name);
    if (!command) return null;

    return {
      description: command.description,
      usage: command.usage
    };
  }
}
