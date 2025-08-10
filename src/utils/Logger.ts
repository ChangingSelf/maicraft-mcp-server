import fs from 'fs';
import path from 'path';

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
  // 新增：是否启用文件日志
  enableFileLog?: boolean;
  // 新增：日志文件路径
  logFilePath?: string;
}

export interface LoggingConfig {
  level?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  enableFileLog?: boolean;
  logFilePath?: string;
  useStderr?: boolean;
  colors?: boolean;
  timestamp?: boolean;
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
  private enableFileLog: boolean;
  private logFilePath: string;
  private logStream: fs.WriteStream | null = null;

  constructor(prefix: string = '', options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.prefix = prefix;
    this.timestamp = options.timestamp ?? true;
    this.colors = options.colors ?? true;
    // Default to stderr when MCP stdio mode is enabled to prevent stdout pollution
    this.useStderr = options.useStderr ?? true;
    this.enableFileLog = options.enableFileLog ?? false;
    this.logFilePath = options.logFilePath ?? this.getDefaultLogPath();
    
    // 初始化文件日志
    if (this.enableFileLog) {
      this.initFileLog();
    }
  }

  /**
   * 从配置对象创建日志器
   */
  static fromConfig(prefix: string, config: LoggingConfig): Logger {
    const levelMap: Record<string, LogLevel> = {
      'DEBUG': LogLevel.DEBUG,
      'INFO': LogLevel.INFO,
      'WARN': LogLevel.WARN,
      'ERROR': LogLevel.ERROR
    };

    return new Logger(prefix, {
      level: config.level ? levelMap[config.level] : LogLevel.INFO,
      timestamp: config.timestamp ?? true,
      colors: config.colors ?? true,
      useStderr: config.useStderr ?? true,
      enableFileLog: config.enableFileLog ?? false,
      logFilePath: config.logFilePath || undefined
    });
  }

  /**
   * 获取默认日志文件路径
   */
  private getDefaultLogPath(): string {
    const cwd = process.cwd();
    const logDir = path.join(cwd, 'logs');
    
    // 确保日志目录存在
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    return path.join(logDir, `maicraft-${timestamp}.log`);
  }

  /**
   * 初始化文件日志
   */
  private initFileLog(): void {
    try {
      // 确保日志目录存在
      const logDir = path.dirname(this.logFilePath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      this.logStream = fs.createWriteStream(this.logFilePath, { 
        flags: 'a',
        encoding: 'utf8'
      });
      
      // 写入日志文件头
      this.logStream.write(`=== Maicraft Log Started at ${new Date().toISOString()} ===\n`);
      
      // 监听进程退出，确保日志文件正确关闭
      process.on('exit', () => {
        if (this.logStream) {
          this.logStream.end();
        }
      });
      
      process.on('SIGINT', () => {
        if (this.logStream) {
          this.logStream.end();
        }
      });
      
    } catch (error) {
      console.error('Failed to initialize file log:', error);
    }
  }

  /**
   * 设置MCP stdio模式，并重定向全局console输出
   * 在MCP stdio模式下，所有console输出都会重定向到stderr，避免污染stdout
   */
  static setupMcpMode(): void {
    // 重定向全局console输出到stderr
    // 保留原始方法以便调试需要
    const origError = console.error.bind(console);
    const toStderr = (...args: unknown[]) => origError(...args);
    console.log = toStderr as any;
    console.info = toStderr as any;
    console.debug = toStderr as any;
    console.warn = toStderr as any;
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
    const fullMessage = `${prefix} ${message}`;

    // 写入文件日志（无颜色）
    if (this.enableFileLog && this.logStream) {
      const fileMessage = (rawParts).join(' ') + ' ' + message + '\n';
      this.logStream.write(fileMessage);
    }

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
        colors: this.colors,
        enableFileLog: this.enableFileLog,
        logFilePath: this.logFilePath
      }
    );
  }

  /**
   * 获取当前日志文件路径
   */
  getLogFilePath(): string {
    return this.logFilePath;
  }
} 