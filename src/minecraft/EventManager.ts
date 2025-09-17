import { GameEvent, GameEventType } from './GameEvent.js';
import { Logger } from '../utils/Logger.js';
import { Bot } from 'mineflayer';
import { DebugCommandHandler } from '../utils/DebugCommandHandler.js';
import { ChatFilterManager } from '../utils/ChatFilterManager.js';
import type { DebugCommandsConfig, ChatFiltersConfig } from '../config.js';

/**
 * 事件管理器
 * 负责存储、管理和查询游戏事件
 */
export class EventManager {
  private events: GameEvent[] = [];
  private maxEvents: number;
  private logger: Logger;
  private bot: Bot | null = null;
  private enabledEvents: Set<GameEventType> = new Set(Object.values(GameEventType) as GameEventType[]);
  private debugCommandHandler: DebugCommandHandler | null = null;
  private chatFilterManager: ChatFilterManager | null = null;

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
   * 设置启用的游戏事件类型
   */
  setEnabledEvents(events: GameEventType[]): void {
    this.enabledEvents = new Set(events);
    this.logger.info(`已设置启用的事件类型: ${events.join(', ')}`);
  }

  /**
   * 注册mineflayer bot并设置事件监听器
   */
  async registerBot(bot: Bot, debugCommandsConfig?: DebugCommandsConfig): Promise<void> {
    this.bot = bot;

    // 如果配置了调试命令，创建调试命令处理器
    if (debugCommandsConfig && debugCommandsConfig.enabled) {
      this.debugCommandHandler = new DebugCommandHandler(bot, debugCommandsConfig);
      this.logger.info('调试命令系统已启用');

      // 自动发现并注册命令
      try {
        await this.debugCommandHandler.discoverAndRegisterCommands();
      } catch (error) {
        this.logger.error('自动发现调试命令失败:', error);
      }
    }

    this.setupEventListeners();
    this.logger.info('已注册mineflayer bot并设置事件监听器');
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

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    if (!this.bot) return;

    // 聊天事件 - "chat" (username, message, translate, jsonMsg, matches)
    this.bot.on('chat', async (username, message, translate, jsonMsg, matches) => {
      // 检查是否是调试命令，如果是则处理并返回，不添加到事件队列
      if (this.debugCommandHandler) {
        const isHandled = await this.debugCommandHandler.handleChatMessage(username, message);
        if (isHandled) {
          return;
        }
      }

      // 检查聊天过滤，如果消息应该被过滤掉则返回，不添加到事件队列
      if (this.chatFilterManager && this.chatFilterManager.shouldFilterMessage(username, message)) {
        return;
      }

      if (this.enabledEvents.has(GameEventType.CHAT)) {
        this.addEvent({
          type: 'chat',
          gameTick: this.getCurrentGameTick(),
          timestamp: this.getCurrentTimestamp(),
          chatInfo: {
            text: message,
            username: username,
          }
        });
      }
    });

    // 玩家加入事件 - "playerJoined" (player)
    this.bot.on('playerJoined', (player) => {
      if (this.enabledEvents.has(GameEventType.PLAYER_JOIN)) {
        this.addEvent({
          type: 'playerJoined',
          gameTick: this.getCurrentGameTick(),
          timestamp: this.getCurrentTimestamp(),
          playerInfo: {
            uuid: player.uuid,
            username: player.username,
            displayName: player.displayName?.toString(),
            ping: player.ping,
            gamemode: player.gamemode
          }
        });
      }
    });

    // 玩家离开事件 - "playerLeft" (entity)
    this.bot.on('playerLeft', (entity) => {
      if (this.enabledEvents.has(GameEventType.PLAYER_LEAVE)) {
        this.addEvent({
          type: 'playerLeft',
          gameTick: this.getCurrentGameTick(),
          timestamp: this.getCurrentTimestamp(),
          playerInfo: {
            uuid: entity.uuid,
            username: entity.username,
            displayName: entity.displayName?.toString(),
            ping: entity.ping,
            gamemode: entity.gamemode
          }
        });
      }
    });

    // 玩家死亡事件 - "death" ()
    this.bot.on('death', () => {
      if (this.enabledEvents.has(GameEventType.PLAYER_DEATH)) {
        this.addEvent({
          type: 'death',
          gameTick: this.getCurrentGameTick(),
          timestamp: this.getCurrentTimestamp(),
          player: {
            uuid: this.bot!.player.uuid,
            username: this.bot!.player.username,
            displayName: this.bot!.player.displayName?.toString(),
            ping: this.bot!.player.ping,
            gamemode: this.bot!.player.gamemode
          },
          deathMessage: '玩家死亡'
        });
      }
    });

    // 玩家重生事件 - "spawn" ()
    this.bot.on('spawn', () => {
      if (this.enabledEvents.has(GameEventType.PLAYER_RESPAWN)) {
        this.addEvent({
          type: 'spawn',
          gameTick: this.getCurrentGameTick(),
          timestamp: this.getCurrentTimestamp(),
          player: {
            uuid: this.bot!.player.uuid,
            username: this.bot!.player.username,
            displayName: this.bot!.player.displayName?.toString(),
            ping: this.bot!.player.ping,
            gamemode: this.bot!.player.gamemode
          },
          position: {
            x: this.bot!.entity.position.x,
            y: this.bot!.entity.position.y,
            z: this.bot!.entity.position.z
          }
        });
      }
    });

    // 天气变化事件 - "rain" () - 当下雨开始或停止时触发
    this.bot.on('rain', () => {
      if (this.enabledEvents.has(GameEventType.WEATHER_CHANGE)) {
        // 根据当前天气状态确定天气类型
        let weather: 'clear' | 'rain' | 'thunder';
        if (this.bot!.thunderState > 0) {
          weather = 'thunder';
        } else if (this.bot!.isRaining) {
          weather = 'rain';
        } else {
          weather = 'clear';
        }

        this.addEvent({
          type: 'rain',
          gameTick: this.getCurrentGameTick(),
          timestamp: this.getCurrentTimestamp(),
          weather: weather
        });
      }
    });

    // 玩家踢出事件 - "kicked" (reason, loggedIn)
    this.bot.on('kicked', (reason, loggedIn) => {
      if (this.enabledEvents.has(GameEventType.PLAYER_KICK)) {
        this.addEvent({
          type: 'kicked',
          gameTick: this.getCurrentGameTick(),
          timestamp: this.getCurrentTimestamp(),
          player: {
            uuid: this.bot!.player.uuid,
            username: this.bot!.player.username,
            displayName: this.bot!.player.displayName?.toString(),
            ping: this.bot!.player.ping,
            gamemode: this.bot!.player.gamemode
          },
          reason: reason
        });
      }
    });

    // 重生点重置事件 - "spawnReset" ()
    this.bot.on('spawnReset', () => {
      if (this.enabledEvents.has(GameEventType.SPAWN_POINT_RESET)) {
        this.addEvent({
          type: 'spawnReset',
          gameTick: this.getCurrentGameTick(),
          timestamp: this.getCurrentTimestamp(),
          position: {
            x: this.bot!.entity.position.x,
            y: this.bot!.entity.position.y,
            z: this.bot!.entity.position.z
          }
        });
      }
    });

    // 生命值更新事件 - "health" ()
    this.bot.on('health', () => {
      if (this.enabledEvents.has(GameEventType.HEALTH_UPDATE)) {
        this.addEvent({
          type: 'health',
          gameTick: this.getCurrentGameTick(),
          timestamp: this.getCurrentTimestamp(),
          health: this.bot!.health,
          food: this.bot!.food,
          saturation: this.bot!.foodSaturation
        });
      }
    });

    // 实体受伤事件 - "entityHurt" (entity)
    this.bot.on('entityHurt', (entity) => {
      if (this.enabledEvents.has(GameEventType.ENTITY_HURT)) {
        this.addEvent({
          type: 'entityHurt',
          gameTick: this.getCurrentGameTick(),
          timestamp: this.getCurrentTimestamp(),
          entity: {
            id: entity.id,
            type: entity.name || 'unknown',
            name: entity.displayName?.toString(),
            position: {
              x: entity.position.x,
              y: entity.position.y,
              z: entity.position.z
            },
            health: entity.health,
            maxHealth: entity.health
          },
          damage: 0 // Mineflayer没有直接提供伤害值
        });
      }
    });

    // 实体死亡事件 - "entityDead" (entity)
    this.bot.on('entityDead', (entity) => {
      if (this.enabledEvents.has(GameEventType.ENTITY_DEATH)) {
        this.addEvent({
          type: 'entityDead',
          gameTick: this.getCurrentGameTick(),
          timestamp: this.getCurrentTimestamp(),
          entity: {
            id: entity.id,
            type: entity.name || 'unknown',
            name: entity.displayName?.toString(),
            position: {
              x: entity.position.x,
              y: entity.position.y,
              z: entity.position.z
            },
            health: 0,
            maxHealth: entity.health
          }
        });
      }
    });

    // 玩家收集物品事件 - "playerCollect" (collector, collected)
    this.bot.on('playerCollect', (collector, collected) => {
      if (this.enabledEvents.has(GameEventType.PLAYER_COLLECT)) {
        // 检查是否是机器人自己收集的物品
        const isSelfCollect = collector.id === this.bot!.entity.id;

        const mcData = this.bot!.registry;

        const collectedItems = collected.metadata.filter((item: any) => item !== null)
        .map((item: any) => {
          return {
            count: item.itemCount,
            ...mcData.items[item.itemId],
          }
        });

        this.addEvent({
          type: 'playerCollect',
          gameTick: this.getCurrentGameTick(),
          timestamp: this.getCurrentTimestamp(),
          collector: {
            id: collector.id,
            type: collector.type,
            name:collector.name,
            username: collector.username,
            position: {
              x: Number(collector.position.x?.toFixed(2) ?? 0),
              y: Number(collector.position.y?.toFixed(2) ?? 0),
              z: Number(collector.position.z?.toFixed(2) ?? 0)
            },
          },
          collected: collectedItems
        });

        // 如果是机器人自己收集的物品，记录到日志
        if (isSelfCollect) {
          const itemNames = collectedItems.map((item) => item.name).join(', ');
          const itemCounts = collectedItems.map((item) => item.count).join(', ');
          this.logger.info(`机器人收集了物品: ${itemNames} x${itemCounts}`);
        }
      }
    });

    this.logger.info('事件监听器设置完成');
  }
}
