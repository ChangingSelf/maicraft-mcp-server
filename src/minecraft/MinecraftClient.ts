import { createBot, Bot } from 'mineflayer';
import { EventEmitter } from 'events';
import { Logger, LoggingConfig } from '../utils/Logger.js';
import { GameEvent, GameEventType, PlayerInfo, Position } from './GameEvent.js';
import { plugin as pvpPlugin } from 'mineflayer-pvp';
import { pathfinder as pathfinderPlugin } from 'mineflayer-pathfinder';
import { plugin as toolPlugin } from 'mineflayer-tool';
import { plugin as collectblockPlugin } from 'mineflayer-collectblock-colalab';

export interface MinecraftClientOptions {
  host: string;
  port: number;
  username: string;
  password?: string;
  auth?: 'microsoft' | 'mojang' | 'offline';
  version?: string;
  checkTimeoutInterval?: number;
  logErrors?: boolean;
  hideErrors?: boolean;
  // 重连配置
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  enableReconnect?: boolean;
  logging?: LoggingConfig;
}

export interface MinecraftClientEvents {
  'connected': () => void;
  'disconnected': (reason: string) => void;
  'error': (error: Error) => void;
  'gameEvent': (event: GameEvent) => void;
  'ready': () => void;
  'kicked': (reason: string) => void;
  'end': () => void;
}

export declare interface MinecraftClient {
  on<U extends keyof MinecraftClientEvents>(
    event: U,
    listener: MinecraftClientEvents[U]
  ): this;
  emit<U extends keyof MinecraftClientEvents>(
    event: U,
    ...args: Parameters<MinecraftClientEvents[U]>
  ): boolean;
}

/**
 * Minecraft 客户端类
 * 基于 mineflayer 实现游戏连接和事件监听
 */
export class MinecraftClient extends EventEmitter {
  private bot: Bot | null = null;
  private options: MinecraftClientOptions & {
    reconnectInterval: number;
    maxReconnectAttempts: number;
    enableReconnect: boolean;
  };
  private logger: Logger;
  private isConnected = false;
  private enabledEvents: Set<GameEventType> = new Set(Object.values(GameEventType) as GameEventType[]);
  private lastPosition: Position | null = null;
  private moveThreshold = 1.0; // 移动距离阈值
  // 重连相关属性
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private isReconnecting = false;
  private shouldReconnect = true;

  constructor(options: MinecraftClientOptions) {
    super();
    this.options = {
      auth: 'offline',
      checkTimeoutInterval: 30000,
      logErrors: false,
      hideErrors: false,
      reconnectInterval: 3000,
      maxReconnectAttempts: 3,
      enableReconnect: true,
      ...options
    };
    this.logger = Logger.fromConfig('MinecraftClient', options.logging || {});
  }

  /**
   * 连接到 Minecraft 服务器
   */
  async connect(): Promise<void> {
    // 防止并发多次 connect
    if (this.isConnected || this.isReconnecting) {
      this.logger.warn('Minecraft 客户端已连接或正在重连中，跳过本次连接');
      return;
    }
    this.isReconnecting = true;

    // 确保之前的连接已清理
    if (this.bot) {
      try {
        this.bot.quit('重新连接');
      } catch (error) {
        this.logger.debug('清理旧连接时出错:', error);
      }
      this.bot = null;
    }

    try {
      this.logger.info(`正在连接到 Minecraft 服务器 ${this.options.host}:${this.options.port}`);
      
      // 创建 mineflayer 机器人
      this.bot = createBot({
        host: this.options.host,
        port: this.options.port,
        username: this.options.username,
        password: this.options.password,
        auth: this.options.auth,
        version: this.options.version,
        checkTimeoutInterval: this.options.checkTimeoutInterval,
        logErrors: this.options.logErrors,
        hideErrors: this.options.hideErrors
      });

      // 加载插件
      this.bot.loadPlugin(pvpPlugin);
      this.bot.loadPlugin(pathfinderPlugin);
      this.bot.loadPlugin(toolPlugin);
      this.bot.loadPlugin(collectblockPlugin);

      // 设置事件监听器
      this.setupEventListeners();

      // 等待连接成功
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.isReconnecting = false;
          reject(new Error('连接超时'));
        }, 30000);

        this.bot!.once('spawn', () => {
          clearTimeout(timeout);
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.isReconnecting = false;
          this.stopReconnect(); // 连接成功后终止所有重连
          
          this.logger.info('Minecraft 客户端连接成功');
          this.emit('connected');
          this.emit('ready');
          resolve();
        });

        this.bot!.once('error', (error) => {
          clearTimeout(timeout);
          this.isReconnecting = false;
          this.logger.error('Minecraft 连接错误:', error);
          reject(error);
        });
      });

    } catch (error) {
      this.isReconnecting = false;
      this.logger.error('连接 Minecraft 服务器失败:', error);
      throw error;
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    this.shouldReconnect = false;
    this.stopReconnect();

    if (!this.isConnected || !this.bot) {
      return;
    }

    try {
      // 先设置断开标志，防止重连
      this.isConnected = false;
      
      // 优雅断开连接
      this.bot.quit('客户端断开连接');
      
      // 等待一段时间确保连接完全断开
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.bot = null;
      this.logger.info('Minecraft 客户端已断开连接');
      this.emit('disconnected', '正常断开');
    } catch (error) {
      this.logger.error('断开连接时发生错误:', error);
      // 强制清理
      this.bot = null;
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * 开始重连
   */
  private startReconnect(): void {
    // 如果已经连接，或者正在连接，则不再重连
    if (this.isConnected || this.isReconnecting) {
      this.logger.info('已连接或正在重连中，跳过本次重连');
      return;
    }
    if (
      !this.options.enableReconnect ||
      this.reconnectAttempts >= this.options.maxReconnectAttempts ||
      !this.shouldReconnect
    ) {
      if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
        this.logger.error("达到最大重连次数，停止重连");
      }
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    // 固定间隔重连：每次间隔固定时间（符合 MVP 要求）
    const totalDelay = this.options.reconnectInterval;

    this.logger.info(`开始第 ${this.reconnectAttempts} 次重连，${totalDelay}ms 后尝试...`);

    this.reconnectTimer = setTimeout(async () => {
      // 再次检查是否已连接
      if (this.isConnected) {
        this.logger.info('重连定时器触发时已连接，跳过本次重连');
        this.isReconnecting = false;
        return;
      }
      try {
        await this.connect();
        this.logger.info("重连成功");
      } catch (error) {
        this.isReconnecting = false;
        this.logger.error("重连失败:", error);
        this.startReconnect(); // 继续尝试重连
      }
    }, totalDelay);
  }

  /**
   * 停止重连
   */
  private stopReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.isReconnecting = false;
  }

  /**
   * 设置启用的事件类型
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
   * 获取当前机器人实例
   */
  getBot(): Bot | null {
    return this.bot;
  }

  /**
   * 获取连接状态
   */
  isConnectedToServer(): boolean {
    return this.isConnected && this.bot !== null;
  }



  /**
   * 获取当前玩家信息
   */
  getCurrentPlayer(): PlayerInfo | null {
    if (!this.bot) return null;
    
    return {
      uuid: this.bot.player.uuid,
      username: this.bot.player.username,
      displayName: this.bot.player.displayName?.toString(),
      ping: this.bot.player.ping,
      gamemode: this.bot.player.gamemode
    };
  }

  /**
   * 获取当前位置
   */
  getCurrentPosition(): Position | null {
    if (!this.bot) return null;
    
    return {
      x: this.bot.entity.position.x,
      y: this.bot.entity.position.y,
      z: this.bot.entity.position.z
    };
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    if (!this.bot) return;

    // 连接和断开事件
    this.bot.on('error', (error) => {
      this.logger.error('Minecraft 机器人错误:', error);
      this.emit('error', error);
    });

    this.bot.on('end', () => {
      this.isConnected = false;
      this.logger.info('Minecraft 连接已结束');
      this.emit('end');
      
      // 如果启用了重连，开始重连
      if (this.options.enableReconnect && this.shouldReconnect) {
        this.startReconnect();
      }
    });

    this.bot.on('kicked', (reason) => {
      this.isConnected = false;
      const reasonStr = typeof reason === 'string' ? reason : JSON.stringify(reason);
      this.logger.warn(`被服务器踢出: ${reasonStr}`);
      this.emit('kicked', reasonStr);
      
      // 如果是重复登录，等待更长时间再重连
      // 无特殊延迟策略，统一采用固定间隔重连
      if (this.options.enableReconnect && this.shouldReconnect) {
        this.startReconnect();
      }
    });

    // 游戏事件监听
    this.setupGameEventListeners();
  }

  /**
   * 设置游戏事件监听器
   */
  private setupGameEventListeners(): void {
    if (!this.bot) return;

    // 聊天事件
    this.bot.on('messagestr', (message, messagePosition) => {
      if (this.enabledEvents.has(GameEventType.CHAT)) {
        this.emitGameEvent({
          type: 'chat',
          timestamp: Date.now(),
          serverId: this.options.host,
          playerName: this.bot!.username,
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
        this.emitGameEvent({
          type: 'playerJoin',
          timestamp: Date.now(),
          serverId: this.options.host,
          playerName: this.bot!.username,
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
        this.emitGameEvent({
          type: 'playerLeave',
          timestamp: Date.now(),
          serverId: this.options.host,
          playerName: this.bot!.username,
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
        this.emitGameEvent({
          type: 'mobSpawn',
          timestamp: Date.now(),
          serverId: this.options.host,
          playerName: this.bot!.username,
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
            maxHealth: entity.health // 使用 health 作为 maxHealth 的默认值
          }
        });
      }
    });

    // 方块破坏事件
    this.bot.on('blockUpdate', (oldBlock, newBlock) => {
      if (oldBlock && newBlock && this.enabledEvents.has(GameEventType.BLOCK_BREAK) && newBlock.type === 0) {
        this.emitGameEvent({
          type: 'blockBreak',
          timestamp: Date.now(),
          serverId: this.options.host,
          playerName: this.bot!.username,
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
        this.emitGameEvent({
          type: 'blockPlace',
          timestamp: Date.now(),
          serverId: this.options.host,
          playerName: this.bot!.username,
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
        const currentPosition = this.getCurrentPosition();
        if (currentPosition && this.lastPosition) {
          const distance = Math.sqrt(
            Math.pow(currentPosition.x - this.lastPosition.x, 2) +
            Math.pow(currentPosition.y - this.lastPosition.y, 2) +
            Math.pow(currentPosition.z - this.lastPosition.z, 2)
          );
          
          if (distance >= this.moveThreshold) {
            const playerInfo = this.getCurrentPlayer();
            if (playerInfo) {
              this.emitGameEvent({
                type: 'playerMove',
                timestamp: Date.now(),
                serverId: this.options.host,
                playerName: this.bot!.username,
                player: playerInfo,
                oldPosition: this.lastPosition,
                newPosition: currentPosition
              });
            }
          }
        }
        this.lastPosition = currentPosition;
      }
    });

    // 生命值更新事件
    this.bot.on('health', () => {
      if (this.enabledEvents.has(GameEventType.HEALTH_UPDATE)) {
        this.emitGameEvent({
          type: 'healthUpdate',
          timestamp: Date.now(),
          serverId: this.options.host,
          playerName: this.bot!.username,
          health: this.bot!.health,
          food: this.bot!.food,
          saturation: this.bot!.foodSaturation
        });
      }
    });

    // 经验更新事件
    this.bot.on('experience', () => {
      if (this.enabledEvents.has(GameEventType.EXPERIENCE_UPDATE)) {
        this.emitGameEvent({
          type: 'experienceUpdate',
          timestamp: Date.now(),
          serverId: this.options.host,
          playerName: this.bot!.username,
          experience: this.bot!.experience.points,
          level: this.bot!.experience.level
        });
      }
    });

    // 天气变化事件（简化处理）
    // 注意：mineflayer 的天气事件处理比较复杂，这里先简化处理
    // 可以通过定期检查 bot.isRaining 和 bot.thunderState 来获取天气状态
  }

  /**
   * 发出游戏事件
   */
  private emitGameEvent(event: GameEvent): void {
    this.logger.debug(`游戏事件: ${event.type}`, event);
    this.emit('gameEvent', event);
  }
} 