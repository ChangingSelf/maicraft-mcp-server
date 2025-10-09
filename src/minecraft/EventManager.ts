import { GameEvent, GameEventType } from './GameEvent.js';
import { Logger } from '../utils/Logger.js';
import { Bot } from 'mineflayer';
import { DebugCommandHandler } from '../utils/DebugCommandHandler.js';
import { ChatFilterManager } from '../utils/ChatFilterManager.js';
import type { DebugCommandsConfig, ChatFiltersConfig } from '../config.js';
import { BaseEventHandler } from './events/BaseEventHandler.js';
import { getAllEventHandlers, ChatEventHandler } from './events/index.js';

/**
 * 事件管理器
 * 负责存储、管理和查询游戏事件
 */
export class EventManager {
  private events: GameEvent[] = [];
  private maxEvents: number;
  private logger: Logger;
  private bot: Bot | null = null;
  private disabledEvents: Set<GameEventType> = new Set();
  private debugCommandHandler: DebugCommandHandler | null = null;
  private chatFilterManager: ChatFilterManager | null = null;
  private eventHandlers: BaseEventHandler[] = [];

  constructor(maxEvents: number = 1000, debugCommandsConfig?: DebugCommandsConfig, chatFiltersConfig?: ChatFiltersConfig) {
    this.maxEvents = maxEvents;
    this.logger = new Logger('EventManager');

    const debugCommandsEnabled = debugCommandsConfig?.enabled || false;

    // 如果配置了调试命令，则创建调试命令处理器
    if (debugCommandsEnabled) {
      this.logger.info('启用调试命令系统');
    }

    // 如果配置了聊天过滤，则创建聊天过滤管理器
    if (chatFiltersConfig && chatFiltersConfig.enabled) {
      this.chatFilterManager = new ChatFilterManager(chatFiltersConfig, debugCommandsEnabled);
      this.logger.info('启用聊天过滤系统');
    }
  }

  /**
   * 添加事件到管理器
   */
  addEvent(event: GameEvent): void {
    this.events.push(event);
    
    // 如果超过最大事件数量，移除最旧的事件
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
    
    this.logger.debug(`添加事件: ${event.type} (总计: ${this.events.length})`);
  }

  /**
   * 查询最近的事件
   */
  queryRecentEvents(options: {
    eventType?: string;
    sinceTick?: number;
    timestampAfter?: number;
    timestampBefore?: number;
    limit?: number;
    includeDetails?: boolean;
  } = {}): {
    total: number;
    events: GameEvent[] | Array<{ type: string; gameTick: number; timestamp: number; }>;
  } {
    const { eventType, sinceTick, timestampAfter, timestampBefore, limit = 50, includeDetails = true } = options;
    
    let filteredEvents = [...this.events];

    // 按事件类型过滤
    if (eventType) {
      filteredEvents = filteredEvents.filter(event => event.type === eventType);
    }

    // 按游戏刻过滤
    if (sinceTick !== undefined) {
      filteredEvents = filteredEvents.filter(event => event.gameTick >= sinceTick);
    }

    // 按时间戳过滤
    if (timestampAfter !== undefined) {
      filteredEvents = filteredEvents.filter(event => event.timestamp >= timestampAfter);
    }
    if (timestampBefore !== undefined) {
      filteredEvents = filteredEvents.filter(event => event.timestamp <= timestampBefore);
    }

    // 按游戏刻升序排序（最早的在前）
    filteredEvents.sort((a, b) => a.gameTick - b.gameTick);

    // 限制返回数量
    const limitedEvents = filteredEvents.slice(0, limit);

    // 如果不包含详细信息，简化事件对象
    const finalEvents = includeDetails
      ? limitedEvents
      : limitedEvents.map(event => ({
          type: event.type,
          gameTick: event.gameTick,
          timestamp: event.timestamp
        }));

    this.logger.debug(`查询事件: 过滤后 ${filteredEvents.length} 个，返回 ${finalEvents.length} 个`);
    
    return {
      total: filteredEvents.length,
      events: finalEvents
    };
  }

  /**
   * 获取事件统计信息
   */
  getEventStats(): {
    total: number;
    byType: Record<string, number>;
    oldestGameTick: number | null;
    newestGameTick: number | null;
    oldestTimestamp: number | null;
    newestTimestamp: number | null;
  } {
    const byType: Record<string, number> = {};
    let oldestGameTick: number | null = null;
    let newestGameTick: number | null = null;
    let oldestTimestamp: number | null = null;
    let newestTimestamp: number | null = null;

    for (const event of this.events) {
      // 统计事件类型
      byType[event.type] = (byType[event.type] || 0) + 1;

      // 更新游戏刻范围
      if (oldestGameTick === null || event.gameTick < oldestGameTick) {
        oldestGameTick = event.gameTick;
      }
      if (newestGameTick === null || event.gameTick > newestGameTick) {
        newestGameTick = event.gameTick;
      }

      // 更新时间戳范围
      if (oldestTimestamp === null || event.timestamp < oldestTimestamp) {
        oldestTimestamp = event.timestamp;
      }
      if (newestTimestamp === null || event.timestamp > newestTimestamp) {
        newestTimestamp = event.timestamp;
      }
    }

    return {
      total: this.events.length,
      byType,
      oldestGameTick,
      newestGameTick,
      oldestTimestamp,
      newestTimestamp
    };
  }

  /**
   * 清理旧事件
   */
  cleanupOldEvents(beforeGameTick: number): number {
    const originalCount = this.events.length;
    this.events = this.events.filter(event => event.gameTick >= beforeGameTick);
    const removedCount = originalCount - this.events.length;
    
    if (removedCount > 0) {
      this.logger.info(`清理了 ${removedCount} 个旧事件`);
    }
    
    return removedCount;
  }

  /**
   * 清空所有事件
   */
  clear(): void {
    this.events = [];
    this.logger.info('已清空所有事件');
  }

  /**
   * 获取支持的事件类型列表
   */
  getSupportedEventTypes(): string[] {
    return Object.values(GameEventType);
  }

  /**
   * 获取聊天过滤管理器
   */
  getChatFilterManager(): ChatFilterManager | null {
    return this.chatFilterManager;
  }

  /**
   * 设置禁用的游戏事件类型（黑名单机制）
   */
  setDisabledEvents(events: GameEventType[]): void {
    this.disabledEvents = new Set(events);
    this.logger.info(`已设置禁用的事件类型: ${events.join(', ')}`);
  }

  /**
   * 检查事件类型是否被禁用
   */
  isEventDisabled(eventType: GameEventType): boolean {
    return this.disabledEvents.has(eventType);
  }

  /**
   * 初始化事件处理器
   */
  private initializeEventHandlers(): void {
    if (!this.bot) return;

    const handlerClasses = getAllEventHandlers();
    this.eventHandlers = [];

    for (const HandlerClass of handlerClasses) {
      // 特殊处理 ChatEventHandler，需要注入额外的依赖
      if (HandlerClass === ChatEventHandler) {
        const handler = new HandlerClass(
          this.bot,
          this.isEventDisabled.bind(this),
          this.addEvent.bind(this),
          this.getCurrentGameTick.bind(this),
          this.getCurrentTimestamp.bind(this),
          this.debugCommandHandler,  // 额外依赖
          this.chatFilterManager     // 额外依赖
        );
        this.eventHandlers.push(handler);
      } else {
        const handler = new HandlerClass(
          this.bot,
          this.isEventDisabled.bind(this),
          this.addEvent.bind(this),
          this.getCurrentGameTick.bind(this),
          this.getCurrentTimestamp.bind(this)
        );
        this.eventHandlers.push(handler);
      }
    }

    this.logger.info(`已初始化 ${this.eventHandlers.length} 个事件处理器`);
  }

  /**
   * 设置事件监听器（新架构）
   */
  private setupEventListeners(): void {
    if (!this.bot) return;

    // 注册所有事件处理器
    for (const handler of this.eventHandlers) {
      handler.register();
    }

    this.logger.info(`已注册 ${this.eventHandlers.length} 个事件监听器`);
  }

  /**
   * 注册mineflayer bot并设置事件监听器
   */
  async registerBot(bot: Bot, debugCommandsConfig?: DebugCommandsConfig): Promise<void> {
    this.logger.debug('注册bot到事件管理器');
    this.bot = bot;

    // 如果配置了调试命令，创建调试命令处理器
    if (debugCommandsConfig && debugCommandsConfig.enabled) {
      this.debugCommandHandler = new DebugCommandHandler(bot, debugCommandsConfig);
      this.logger.debug('调试命令系统已启用');

      // 自动发现并注册命令
      try {
        await this.debugCommandHandler.discoverAndRegisterCommands();
      } catch (error) {
        this.logger.error('自动发现调试命令失败:', error);
      }
    }

    this.initializeEventHandlers();
    this.setupEventListeners();
    
    this.logger.debug(`已注册${this.eventHandlers.length}个事件处理器`);
  }

  /**
   * 获取当前游戏刻
   */
  private getCurrentGameTick(): number {
    if (!this.bot) return 0;
    return this.bot.time.age ?? 0;
  }

  /**
   * 获取当前时间戳
   */
  private getCurrentTimestamp(): number {
    return Date.now();
  }
}
