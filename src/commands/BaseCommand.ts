import { Logger } from '../utils/Logger.js';
import { Bot } from 'mineflayer';
import type { DebugCommandsConfig } from '../config.js';

/**
 * 调试命令参数类型
 */
export interface CommandArgs {
  [key: string]: any;
}

/**
 * 调试命令结果类型
 */
export interface CommandResult {
  success: boolean;
  message?: string;
  data?: any;
}

/**
 * 调试命令接口
 */
export interface DebugCommand {
  name: string;
  description: string;
  usage?: string;

  /**
   * 执行命令
   */
  execute(bot: Bot, username: string, args: string[]): Promise<CommandResult>;

  /**
   * 获取帮助信息
   */
  getHelp(): string;

  /**
   * 设置调试命令配置（可选）
   */
  setConfig?(config: DebugCommandsConfig): void;
}

/**
 * 调试命令基类
 */
export abstract class BaseCommand implements DebugCommand {
  abstract name: string;
  abstract description: string;
  usage?: string;
  private _logger?: Logger;
  protected config?: DebugCommandsConfig;

  /**
   * 获取 logger 实例，延迟初始化
   */
  get logger(): Logger {
    if (!this._logger) {
      this._logger = new Logger(`Command:${this.name}`);
    }
    return this._logger;
  }

  /**
   * 设置调试命令配置
   */
  setConfig(config: DebugCommandsConfig): void {
    this.config = config;
  }


  /**
   * 执行命令
   */
  abstract execute(bot: Bot, username: string, args: string[]): Promise<CommandResult>;

  /**
   * 获取帮助信息
   */
  getHelp(): string {
    let help = `!${this.name}: ${this.description}`;
    if (this.usage) {
      help += `\n用法: ${this.usage}`;
    }
    return help;
  }

  /**
   * 解析命令参数
   */
  protected parseArgs(args: string[]): CommandArgs {
    const result: CommandArgs = {};

    // 简单的参数解析逻辑
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      // 检查是否是命名参数 (--param value 或 --flag)
      if (arg.startsWith('--')) {
        const paramName = arg.slice(2);
        const nextArg = args[i + 1];

        if (nextArg && !nextArg.startsWith('--')) {
          result[paramName] = nextArg;
          i++; // 跳过下一个参数
        } else {
          result[paramName] = true; // 布尔标志
        }
      } else {
        // 位置参数
        result[`arg${i}`] = arg;
      }
    }

    return result;
  }

  /**
   * 创建成功结果
   */
  protected success(message?: string, data?: any): CommandResult {
    return {
      success: true,
      message,
      data
    };
  }

  /**
   * 创建失败结果
   */
  protected error(message: string): CommandResult {
    return {
      success: false,
      message
    };
  }
}
