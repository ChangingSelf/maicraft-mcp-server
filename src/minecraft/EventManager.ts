import { GameEvent, GameEventType } from './GameEvent.js';
import { Logger } from '../utils/Logger.js';
import { Bot } from 'mineflayer';

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
  private lastPosition: { x: number; y: number; z: number } | null = null;
  private moveThreshold = 1.0;

  constructor(maxEvents: number = 1000) {
    this.maxEvents = maxEvents;
    this.logger = new Logger('EventManager');
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
    limit?: number;
    includeDetails?: boolean;
  } = {}): {
    total: number;
    events: GameEvent[] | Array<{ type: string; gameTick: number; }>;
  } {
    const { eventType, sinceTick, limit = 50, includeDetails = true } = options;
    
    let filteredEvents = [...this.events];

    // 按事件类型过滤
    if (eventType) {
      filteredEvents = filteredEvents.filter(event => event.type === eventType);
    }

    // 按游戏刻过滤
    if (sinceTick !== undefined) {
      filteredEvents = filteredEvents.filter(event => event.gameTick >= sinceTick);
    }

    // 按游戏刻倒序排序（最新的在前）
    filteredEvents.sort((a, b) => b.gameTick - a.gameTick);

    // 限制返回数量
    const limitedEvents = filteredEvents.slice(0, limit);

    // 如果不包含详细信息，简化事件对象
    const finalEvents = includeDetails 
      ? limitedEvents 
      : limitedEvents.map(event => ({
          type: event.type,
          gameTick: event.gameTick
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
  } {
    const byType: Record<string, number> = {};
    let oldestGameTick: number | null = null;
    let newestGameTick: number | null = null;

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
    }

    return {
      total: this.events.length,
      byType,
      oldestGameTick,
      newestGameTick
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
   * 设置启用的游戏事件类型
   */
  setEnabledEvents(events: GameEventType[]): void {
    this.enabledEvents = new Set(events);
    this.logger.info(`已设置启用的事件类型: ${events.join(', ')}`);
  }

  /**
   * 设置玩家移动阈值
   */
  setMoveThreshold(threshold: number): void {
    this.moveThreshold = threshold;
  }

  /**
   * 注册mineflayer bot并设置事件监听器
   */
  registerBot(bot: Bot): void {
    this.bot = bot;
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
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    if (!this.bot) return;

    // 聊天事件
    this.bot.on('messagestr', (message, messagePosition) => {
      if (this.enabledEvents.has(GameEventType.CHAT)) {
        this.addEvent({
          type: 'chat',
          gameTick: this.getCurrentGameTick(),
          chatInfo: {
            json: {},
            text: message,
            position: typeof messagePosition === 'number' ? messagePosition : 0
          }
        });
      }
    });

    // 玩家加入事件
    this.bot.on('playerJoined', (player) => {
      if (this.enabledEvents.has(GameEventType.PLAYER_JOIN)) {
        this.addEvent({
          type: 'playerJoin',
          gameTick: this.getCurrentGameTick(),
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

    // 玩家离开事件
    this.bot.on('playerLeft', (player) => {
      if (this.enabledEvents.has(GameEventType.PLAYER_LEAVE)) {
        this.addEvent({
          type: 'playerLeave',
          gameTick: this.getCurrentGameTick(),
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

    // 实体生成事件
    this.bot.on('entitySpawn', (entity) => {
      if (this.enabledEvents.has(GameEventType.MOB_SPAWN) && entity.type === 'mob') {
        this.addEvent({
          type: 'mobSpawn',
          gameTick: this.getCurrentGameTick(),
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
          }
        });
      }
    });

    // 方块破坏/放置事件
    this.bot.on('blockUpdate', (oldBlock, newBlock) => {
      if (oldBlock && newBlock && this.enabledEvents.has(GameEventType.BLOCK_BREAK) && newBlock.type === 0) {
        this.addEvent({
          type: 'blockBreak',
          gameTick: this.getCurrentGameTick(),
          block: {
            type: oldBlock.type,
            name: oldBlock.name,
            position: {
              x: oldBlock.position.x,
              y: oldBlock.position.y,
              z: oldBlock.position.z
            }
          }
        });
      } else if (oldBlock && newBlock && this.enabledEvents.has(GameEventType.BLOCK_PLACE) && oldBlock.type === 0) {
        this.addEvent({
          type: 'blockPlace',
          gameTick: this.getCurrentGameTick(),
          block: {
            type: newBlock.type,
            name: newBlock.name,
            position: {
              x: newBlock.position.x,
              y: newBlock.position.y,
              z: newBlock.position.z
            }
          }
        });
      }
    });

    // 玩家移动事件
    this.bot.on('move', () => {
      if (this.enabledEvents.has(GameEventType.PLAYER_MOVE)) {
        const currentPosition = {
          x: this.bot!.entity.position.x,
          y: this.bot!.entity.position.y,
          z: this.bot!.entity.position.z
        };
        
        if (this.lastPosition) {
          const distance = Math.sqrt(
            Math.pow(currentPosition.x - this.lastPosition.x, 2) +
            Math.pow(currentPosition.y - this.lastPosition.y, 2) +
            Math.pow(currentPosition.z - this.lastPosition.z, 2)
          );
          
          if (distance >= this.moveThreshold) {
            this.addEvent({
              type: 'playerMove',
              gameTick: this.getCurrentGameTick(),
              player: {
                uuid: this.bot!.player.uuid,
                username: this.bot!.player.username,
                displayName: this.bot!.player.displayName?.toString(),
                ping: this.bot!.player.ping,
                gamemode: this.bot!.player.gamemode
              },
              oldPosition: this.lastPosition,
              newPosition: currentPosition
            });
          }
        }
        this.lastPosition = currentPosition;
      }
    });

    // 生命值更新事件
    this.bot.on('health', () => {
      if (this.enabledEvents.has(GameEventType.HEALTH_UPDATE)) {
        this.addEvent({
          type: 'healthUpdate',
          gameTick: this.getCurrentGameTick(),
          health: this.bot!.health,
          food: this.bot!.food,
          saturation: this.bot!.foodSaturation
        });
      }
    });

    // 经验更新事件
    this.bot.on('experience', () => {
      if (this.enabledEvents.has(GameEventType.EXPERIENCE_UPDATE)) {
        this.addEvent({
          type: 'experienceUpdate',
          gameTick: this.getCurrentGameTick(),
          experience: this.bot!.experience.points,
          level: this.bot!.experience.level
        });
      }
    });

    this.logger.info('事件监听器设置完成');
  }
}
