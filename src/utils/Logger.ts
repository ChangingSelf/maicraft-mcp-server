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
  // When true, always write logs to stderr. Useful for MCP stdio servers to avoid
  // corrupting stdout which is reserved for protocol frames.
  useStderr?: boolean;
}

/**
 * 日志记录器
 */
export class Logger {
  private level: LogLevel;
  private prefix: string;
  private timestamp: boolean;
  private colors: boolean;
  private useStderr: boolean;

  constructor(prefix: string = '', options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.prefix = prefix;
    this.timestamp = options.timestamp ?? true;
    this.colors = options.colors ?? true;
    // Default to stderr when MCP stdio mode is enabled to prevent stdout pollution
    this.useStderr = options.useStderr ?? (process.env.MCP_STDIO_MODE === '1');
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
  debug(...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      this.log('DEBUG', ...args);
    }
  }

  /**
   * 信息日志
   */
  info(...args: unknown[]): void {
    if (this.level <= LogLevel.INFO) {
      this.log('INFO', ...args);
    }
  }

  /**
   * 警告日志
   */
  warn(...args: unknown[]): void {
    if (this.level <= LogLevel.WARN) {
      this.log('WARN', ...args);
    }
  }

  /**
   * 错误日志
   */
  error(...args: unknown[]): void {
    if (this.level <= LogLevel.ERROR) {
      this.log('ERROR', ...args);
    }
  }

  /**
   * 内部日志方法
   */
  private log(level: string, ...args: unknown[]): void {
    const rawParts: string[] = [];
    const coloredParts: string[] = [];

    // 时间戳
    if (this.timestamp) {
      const ts = `[${this.formatTimestamp(new Date())}]`;
      rawParts.push(ts);
      coloredParts.push(this.colors ? `\x1b[90m${ts}\x1b[0m` : ts); // 灰色
    }

    // 日志级别
    const levelPart = `[${level}]`;
    rawParts.push(levelPart);
    coloredParts.push(
      this.colors ? `${this.getColor(level)}${levelPart}\x1b[0m` : levelPart
    );

    // 模块前缀
    if (this.prefix) {
      const modulePart = `[${this.prefix}]`;
      rawParts.push(modulePart);
      coloredParts.push(this.colors ? `\x1b[34m${modulePart}\x1b[0m` : modulePart); // 蓝色
    }

    // 构建完整消息
    const prefix = (this.colors ? coloredParts : rawParts).join(' ');
    const message = args.length > 0 ? args.join(' ') : '';

    // 根据级别选择输出方法
    if (this.useStderr) {
      // MCP stdio-safe: all logs go to stderr
      console.error(prefix, message);
      return;
    }

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
   * 根据日志级别获取 ANSI 颜色代码
   */
  private getColor(level: string): string {
    switch (level) {
      case 'DEBUG':
        return '\x1b[90m'; // 灰色
      case 'INFO':
        return '\x1b[32m'; // 绿色
      case 'WARN':
        return '\x1b[33m'; // 黄色
      case 'ERROR':
        return '\x1b[31m'; // 红色
      default:
        return '';
    }
  }

  /**
   * 将日期格式化为 "YYYY-MM-DD HH:mm:ss" 字符串
   */
  private formatTimestamp(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
           `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
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