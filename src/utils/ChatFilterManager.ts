import { Logger } from './Logger.js';
import type { ChatFiltersConfig } from '../config.js';

/**
 * 聊天过滤管理器
 * 负责管理玩家黑名单和消息黑名单过滤逻辑
 */
export class ChatFilterManager {
  private logger: Logger;
  private config: ChatFiltersConfig;
  private blockedPlayers: Set<string> = new Set();
  private blockedMessagePatterns: RegExp[] = [];
  private debugCommandsEnabled: boolean = false;

  constructor(config: ChatFiltersConfig = {}, debugCommandsEnabled: boolean = false) {
    this.config = config;
    this.debugCommandsEnabled = debugCommandsEnabled;
    this.logger = new Logger('ChatFilterManager');
    this.initializeFilters();
  }

  /**
   * 初始化过滤器
   */
  private initializeFilters(): void {
    if (!this.config.enabled) {
      this.logger.debug('聊天过滤已禁用');
      return;
    }

    // 初始化玩家黑名单
    if (this.config.blockedPlayers) {
      this.blockedPlayers = new Set(this.config.blockedPlayers);
      this.logger.debug(`已加载玩家黑名单: ${this.config.blockedPlayers.join(', ')}`);
    }

    // 初始化消息黑名单
    let messagePatterns = this.config.blockedMessagePatterns || [];

    // 如果调试命令系统未启用，添加默认过滤规则：过滤以!开头的消息
    if (!this.debugCommandsEnabled) {
      const defaultPatterns = ['^!.*'];
      messagePatterns = [...defaultPatterns, ...messagePatterns];
      this.logger.debug('调试命令系统未启用，已添加默认过滤规则：过滤以!开头的消息');
    }

    this.blockedMessagePatterns = messagePatterns
      .map(pattern => {
        try {
          return new RegExp(pattern);
        } catch (error) {
          this.logger.error(`无效的正则表达式模式: ${pattern} - ${error}`);
          return null;
        }
      })
      .filter((regex): regex is RegExp => regex !== null);

    if (this.config.blockedMessagePatterns && this.config.blockedMessagePatterns.length > 0) {
      this.logger.debug(`已加载消息黑名单模式: ${this.config.blockedMessagePatterns.join(', ')}`);
    }

    this.logger.debug('聊天过滤器初始化完成');
  }

  /**
   * 检查消息是否应该被过滤掉
   * @param username 发送者用户名
   * @param message 消息内容
   * @returns 如果消息应该被过滤掉则返回true，否则返回false
   */
  shouldFilterMessage(username: string, message: string): boolean {
    if (!this.config.enabled) {
      return false;
    }

    // 检查玩家黑名单
    if (this.blockedPlayers.has(username)) {
      this.logger.debug(`过滤来自黑名单玩家的消息: ${username}`);
      return true;
    }

    // 检查消息黑名单
    for (const pattern of this.blockedMessagePatterns) {
      if (pattern.test(message)) {
        this.logger.debug(`过滤匹配黑名单模式的消息: ${message} (模式: ${pattern.source})`);
        return true;
      }
    }

    return false;
  }

  /**
   * 更新配置
   * @param config 新的配置
   */
  updateConfig(config: ChatFiltersConfig): void {
    this.config = config;
    this.initializeFilters();
  }

  /**
   * 获取当前配置
   */
  getConfig(): ChatFiltersConfig {
    return { ...this.config };
  }

  /**
   * 获取被过滤的消息统计信息
   */
  getFilterStats(): {
    enabled: boolean;
    blockedPlayersCount: number;
    blockedMessagePatternsCount: number;
    blockedPlayers: string[];
    blockedMessagePatterns: string[];
  } {
    return {
      enabled: this.config.enabled || false,
      blockedPlayersCount: this.blockedPlayers.size,
      blockedMessagePatternsCount: this.blockedMessagePatterns.length,
      blockedPlayers: Array.from(this.blockedPlayers),
      blockedMessagePatterns: this.config.blockedMessagePatterns || []
    };
  }

  /**
   * 添加玩家到黑名单
   * @param username 玩家用户名
   */
  addBlockedPlayer(username: string): void {
    if (!this.config.blockedPlayers) {
      this.config.blockedPlayers = [];
    }
    if (!this.config.blockedPlayers.includes(username)) {
      this.config.blockedPlayers.push(username);
      this.blockedPlayers.add(username);
      this.logger.debug(`已添加玩家到黑名单: ${username}`);
    }
  }

  /**
   * 从黑名单中移除玩家
   * @param username 玩家用户名
   */
  removeBlockedPlayer(username: string): void {
    if (this.config.blockedPlayers) {
      const index = this.config.blockedPlayers.indexOf(username);
      if (index !== -1) {
        this.config.blockedPlayers.splice(index, 1);
        this.blockedPlayers.delete(username);
        this.logger.debug(`已从黑名单中移除玩家: ${username}`);
      }
    }
  }

  /**
   * 添加消息过滤模式
   * @param pattern 正则表达式模式字符串
   */
  addBlockedMessagePattern(pattern: string): boolean {
    try {
      const regex = new RegExp(pattern);
      if (!this.config.blockedMessagePatterns) {
        this.config.blockedMessagePatterns = [];
      }
      if (!this.config.blockedMessagePatterns.includes(pattern)) {
        this.config.blockedMessagePatterns.push(pattern);
        this.blockedMessagePatterns.push(regex);
        this.logger.debug(`已添加消息过滤模式: ${pattern}`);
        return true;
      }
    } catch (error) {
      this.logger.error(`添加消息过滤模式失败: ${pattern} - ${error}`);
      return false;
    }
    return false;
  }

  /**
   * 移除消息过滤模式
   * @param pattern 正则表达式模式字符串
   */
  removeBlockedMessagePattern(pattern: string): void {
    if (this.config.blockedMessagePatterns) {
      const index = this.config.blockedMessagePatterns.indexOf(pattern);
      if (index !== -1) {
        this.config.blockedMessagePatterns.splice(index, 1);
        // 重新构建正则表达式数组
        this.blockedMessagePatterns = this.config.blockedMessagePatterns
          .map(p => {
            try {
              return new RegExp(p);
            } catch {
              return null;
            }
          })
          .filter((regex): regex is RegExp => regex !== null);
        this.logger.debug(`已移除消息过滤模式: ${pattern}`);
      }
    }
  }
}
