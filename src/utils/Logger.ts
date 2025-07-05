export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
  timestamp?: boolean;
  colors?: boolean;
}

/**
 * 日志记录器
 */
export class Logger {
  private level: LogLevel;
  private prefix: string;
  private timestamp: boolean;
  private colors: boolean;

  constructor(prefix: string = '', options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.prefix = prefix;
    this.timestamp = options.timestamp ?? true;
    this.colors = options.colors ?? true;
  }

  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * 调试日志
   */
  debug(...args: any[]): void {
    if (this.level <= LogLevel.DEBUG) {
      this.log('DEBUG', ...args);
    }
  }

  /**
   * 信息日志
   */
  info(...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      this.log('INFO', ...args);
    }
  }

  /**
   * 警告日志
   */
  warn(...args: any[]): void {
    if (this.level <= LogLevel.WARN) {
      this.log('WARN', ...args);
    }
  }

  /**
   * 错误日志
   */
  error(...args: any[]): void {
    if (this.level <= LogLevel.ERROR) {
      this.log('ERROR', ...args);
    }
  }

  /**
   * 内部日志方法
   */
  private log(level: string, ...args: any[]): void {
    const parts: string[] = [];

    // 时间戳
    if (this.timestamp) {
      parts.push(`[${new Date().toISOString()}]`);
    }

    // 日志级别
    parts.push(`[${level}]`);

    // 前缀
    if (this.prefix) {
      parts.push(`[${this.prefix}]`);
    }

    // 构建完整消息
    const prefix = parts.join(' ');
    const message = args.length > 0 ? args.join(' ') : '';

    // 根据级别选择输出方法
    switch (level) {
      case 'DEBUG':
        console.debug(prefix, message);
        break;
      case 'INFO':
        console.info(prefix, message);
        break;
      case 'WARN':
        console.warn(prefix, message);
        break;
      case 'ERROR':
        console.error(prefix, message);
        break;
      default:
        console.log(prefix, message);
    }
  }

  /**
   * 创建子日志器
   */
  child(prefix: string): Logger {
    return new Logger(
      this.prefix ? `${this.prefix}:${prefix}` : prefix,
      {
        level: this.level,
        timestamp: this.timestamp,
        colors: this.colors
      }
    );
  }
} 