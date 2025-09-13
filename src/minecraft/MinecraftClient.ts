import { createBot, Bot } from 'mineflayer';
import { EventEmitter } from 'events';
import { Logger, LoggingConfig } from '../utils/Logger.js';
import { GameEvent, GameEventType, PlayerInfo, Position } from './GameEvent.js';
import { EventManager } from './EventManager.js';
import { plugin as pvpPlugin } from 'mineflayer-pvp';
import { pathfinder as pathfinderPlugin, Movements } from 'mineflayer-pathfinder-mai';
import { plugin as toolPlugin } from 'mineflayer-tool';
import { plugin as collectblockPlugin } from 'mineflayer-collectblock-colalab';
import type { DebugCommandsConfig, ChatFiltersConfig } from '../config.js';

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
  // 不能破坏的方块列表配置
  blocksCantBreak?: string[];
  // 调试命令系统配置
  debugCommands?: DebugCommandsConfig;
  // 聊天过滤配置
  chatFilters?: ChatFiltersConfig;
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
  private eventManager: EventManager; // 事件管理器
  private viewerManager: any = null; // ViewerManager 实例
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
    this.eventManager = new EventManager(1000, options.debugCommands, options.chatFilters); // 初始化事件管理器，最多存储1000个事件
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

      // 在bot对象上设置client引用，以便动作类可以访问事件管理器
      (this.bot as any).client = this;

      // 加载插件
      this.bot.loadPlugin(pvpPlugin);
      this.bot.loadPlugin(pathfinderPlugin);
      this.bot.loadPlugin(toolPlugin);
      this.bot.loadPlugin(collectblockPlugin);

      // 注册bot到事件管理器
      await this.eventManager.registerBot(this.bot, this.options.debugCommands);

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

          // 设置默认移动参数
          const defaultMove = new Movements(this.bot!);
          // defaultMove.canDig = false;
          // defaultMove.digCost = 5;//提高破坏方块成本，降低路上破坏方块的可能性
          
          // 设置不能破坏的方块列表
          const blocksCantBreakIds = new Set<number>();
          const defaultBlocks = ['chest', 'furnace']; // 默认不能破坏的方块
          const blockNames = this.options.blocksCantBreak || defaultBlocks;
          
          this.logger.info(`配置移动过程中不能破坏的方块列表: ${blockNames.join(', ')}`);
          
          for (const blockName of blockNames) {
            const block = this.bot!.registry.blocksByName[blockName];
            if (block) {
              blocksCantBreakIds.add(block.id);
              this.logger.debug(`已添加移动过程中不能破坏的方块: ${blockName} (ID: ${block.id})`);
            } else {
              this.logger.warn(`未知的方块名称: ${blockName}`);
            }
          }
          
          defaultMove.blocksCantBreak = blocksCantBreakIds;
          // defaultMove.allow1by1towers = false;

          this.bot!.pathfinder.setMovements(defaultMove);


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
    this.eventManager.setEnabledEvents(events);
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
   * 获取事件管理器
   */
  getEventManager(): EventManager {
    return this.eventManager;
  }

  /**
   * 获取聊天过滤管理器
   */
  getChatFilterManager(): any {
    return this.eventManager.getChatFilterManager();
  }

  /**
   * 设置 ViewerManager 实例
   */
  setViewerManager(viewerManager: any): void {
    this.viewerManager = viewerManager;
  }

  /**
   * 获取 ViewerManager 实例
   */
  getViewerManager(): any {
    return this.viewerManager;
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
  }




} 