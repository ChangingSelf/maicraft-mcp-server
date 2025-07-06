import { Bot } from 'mineflayer';
import { GameEvent, GameEventType, Position, PlayerInfo, EntityInfo, InventoryItem } from './GameEvent.js';
import { Logger } from '../utils/Logger.js';

export interface GameState {
  player: PlayerInfo | null;
  position: Position | null;
  health: number;
  food: number;
  experience: number;
  level: number;
  inventory: InventoryItem[];
  weather: 'clear' | 'rain' | 'thunder';
  timeOfDay: number;
  dimension: string;
  nearbyPlayers: PlayerInfo[];
  nearbyEntities: EntityInfo[];
  recentEvents: GameEvent[];
}

export interface StateManagerOptions {
  maxEventHistory: number;
  nearbyRange: number;
  includeInventory: boolean;
  includeNearbyEntities: boolean;
}

/**
 * 状态管理器类
 * 负责收集游戏状态信息并转换为自然语言提示词
 */
export class StateManager {
  private bot: Bot | null = null;
  private logger: Logger;
  private gameState: GameState;
  private options: StateManagerOptions;
  private eventHistory: GameEvent[] = [];

  constructor(options: Partial<StateManagerOptions> = {}) {
    this.options = {
      maxEventHistory: 50,
      nearbyRange: 10,
      includeInventory: true,
      includeNearbyEntities: true,
      ...options
    };

    this.logger = new Logger('StateManager');
    this.gameState = this.initializeGameState();
  }

  /**
   * 设置机器人实例
   */
  setBot(bot: Bot): void {
    this.bot = bot;
    this.logger.info('StateManager 已绑定机器人实例');
  }

  /**
   * 添加游戏事件到历史记录
   */
  addEvent(event: GameEvent): void {
    this.eventHistory.push(event);
    
    // 保持历史记录在限制范围内
    if (this.eventHistory.length > this.options.maxEventHistory) {
      this.eventHistory = this.eventHistory.slice(0, this.options.maxEventHistory);
    }

    // 更新游戏状态
    this.updateGameStateFromEvent(event);
    this.updateGameState();
    
    this.logger.debug(`添加事件: ${event.type}`, event);
  }

  /**
   * 获取当前游戏状态
   */
  getGameState(): GameState {
    this.updateGameState();
    return { ...this.gameState };
  }

  /**
   * 停止状态管理器
   */
  stop(): void {
    this.logger.info('StateManager 已停止');
  }

  /**
   * 初始化游戏状态
   */
  private initializeGameState(): GameState {
    return {
      player: null,
      position: null,
      health: 20,
      food: 20,
      experience: 0,
      level: 0,
      inventory: [],
      weather: 'clear',
      timeOfDay: 0,
      dimension: 'overworld',
      nearbyPlayers: [],
      nearbyEntities: [],
      recentEvents: []
    };
  }

  /**
   * 更新游戏状态
   */
  private updateGameState(): void {
    if (!this.bot) {
      return;
    }

    try {
      // 更新玩家信息
      this.gameState.player = {
        uuid: this.bot.player.uuid,
        username: this.bot.player.username,
        displayName: this.bot.player.displayName?.toString(),
        ping: this.bot.player.ping,
        gamemode: this.bot.player.gamemode
      };

      // 更新位置
      this.gameState.position = {
        x: this.bot.entity.position.x,
        y: this.bot.entity.position.y,
        z: this.bot.entity.position.z
      };

      // 更新生命值和食物
      this.gameState.health = this.bot.health;
      this.gameState.food = this.bot.food;

      // 更新经验
      this.gameState.experience = this.bot.experience.points;
      this.gameState.level = this.bot.experience.level;

      // 更新天气
      if (this.bot.thunderState > 0) {
        this.gameState.weather = 'thunder';
      } else if (this.bot.isRaining) {
        this.gameState.weather = 'rain';
      } else {
        this.gameState.weather = 'clear';
      }

      // 更新时间
      this.gameState.timeOfDay = this.bot.time.timeOfDay;

      // 更新维度
      this.gameState.dimension = this.bot.game.dimension || 'overworld';

      // 更新附近玩家
      this.gameState.nearbyPlayers = Object.values(this.bot.players)
        .filter(player => player.entity && player.username !== this.bot!.username)
        .map(player => ({
          uuid: player.uuid,
          username: player.username,
          displayName: player.displayName?.toString(),
          ping: player.ping,
          gamemode: player.gamemode
        }));

      // 更新附近实体
      if (this.options.includeNearbyEntities) {
        this.gameState.nearbyEntities = Object.values(this.bot.entities)
          .filter(entity => {
            if (!entity.position || entity.id === this.bot!.entity.id) {
              return false;
            }
            const distance = this.bot!.entity.position.distanceTo(entity.position);
            return distance <= this.options.nearbyRange;
          })
          .map(entity => ({
            id: entity.id,
            type: entity.type,
            name: entity.name || entity.type,
            position: {
              x: entity.position.x,
              y: entity.position.y,
              z: entity.position.z
            }
          }));
      }

      // 更新库存
      if (this.options.includeInventory) {
        this.gameState.inventory = this.bot.inventory.items();
      }

    } catch (error) {
      this.logger.error('更新游戏状态时发生错误:', error);
    }
  }

  /**
   * 从事件更新游戏状态
   */
  private updateGameStateFromEvent(event: GameEvent): void {
    this.gameState.recentEvents.unshift(event);
    
    // 保持最近事件在限制范围内
    if (this.gameState.recentEvents.length > 10) {
      this.gameState.recentEvents = this.gameState.recentEvents.slice(0, 10);
    }
  }

  /**
   * 生成事件描述
   */
  private generateEventDescription(event: GameEvent): string {
    const timeAgo = Math.floor((Date.now() - event.timestamp) / 1000);
    const timeText = timeAgo < 60 ? `${timeAgo}秒前` : `${Math.floor(timeAgo / 60)}分钟前`;

    switch (event.type) {
      case 'chat':
        return `${timeText}: 聊天消息: ${event.chatInfo.text}`;
      case 'playerJoin':
        return `${timeText}: 玩家 ${event.playerInfo.username} 加入游戏`;
      case 'playerLeave':
        return `${timeText}: 玩家 ${event.playerInfo.username} 离开游戏`;
      case 'mobSpawn':
        return `${timeText}: ${event.entity.type} 在附近生成`;
      case 'blockBreak':
        return `${timeText}: 方块 ${event.block.name} 被破坏`;
      case 'blockPlace':
        return `${timeText}: 方块 ${event.block.name} 被放置`;
      case 'playerMove':
        return `${timeText}: 玩家移动到新位置`;
      case 'healthUpdate':
        return `${timeText}: 生命值更新: ${event.health}/20`;
      case 'experienceUpdate':
        return `${timeText}: 经验更新: 等级 ${event.level}`;
      case 'timeUpdate':
        return `${timeText}: 时间更新`;
      case 'weatherChange':
        return `${timeText}: 天气变化: ${this.getWeatherText(event.weather)}`;
      default:
        return `${timeText}: 未知事件`;
    }
  }

  /**
   * 获取天气文本
   */
  private getWeatherText(weather: string): string {
    switch (weather) {
      case 'clear': return '晴朗';
      case 'rain': return '下雨';
      case 'thunder': return '雷雨';
      default: return '未知';
    }
  }

  /**
   * 获取时间文本
   */
  private getTimeText(timeOfDay: number): string {
    // Minecraft 时间：0-23999 ticks，6000 tick = 中午
    const hours = Math.floor((timeOfDay + 6000) / 1000) % 24;
    const minutes = Math.floor(((timeOfDay + 6000) % 1000) / 1000 * 60);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
} 