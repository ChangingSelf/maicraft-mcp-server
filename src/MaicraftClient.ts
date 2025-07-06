import { Router } from './messaging/Router';
import { MinecraftClient } from './minecraft/MinecraftClient';
import { StateManager } from './minecraft/StateManager';
import { MessageEncoder } from './minecraft/MessageEncoder';

import { ActionExecutor } from './minecraft/ActionExecutor';
import { ChatAction } from './actions/ChatAction';
import { CraftItemAction } from './actions/CraftItemAction';
import { PlaceBlockAction } from './actions/PlaceBlockAction';
import { MineBlockAction } from './actions/MineBlockAction';
import { KillMobAction } from './actions/KillMobAction';
import { FollowPlayerAction } from './actions/FollowPlayerAction';
import { SmeltItemAction } from './actions/SmeltItemAction';
import { SwimToLandAction } from './actions/SwimToLandAction';
import { UseChestAction } from './actions/UseChestAction';

import { Logger } from './utils/Logger';
import { GameEvent } from './minecraft/GameEvent';
import type { MessageBase } from './messaging/MaimMessage.js';

/**
 * Minecraft 配置
 */
export interface MinecraftConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  auth: 'offline' | 'microsoft' | 'mojang';
  version?: string;
}

/**
 * 路由配置
 */
export interface RouteConfig {
  route_config: {
    [key: string]: {
      url: string;
      token?: string;
      reconnect_interval?: number;
      max_reconnect_attempts?: number;
    };
  };
}

/**
 * 客户端配置
 */
export interface ClientConfig {
  minecraft: MinecraftConfig;
  router: RouteConfig;
  enabledEvents?: string[];
  maxMessageHistory?: number;
}

/**
 * Maicraft 客户端（MaicraftClient）
 * 提供游戏事件监听、动作执行与路由转发能力
 */
export class MaicraftClient {
  private minecraftClient: MinecraftClient;
  private router: Router;
  private stateManager: StateManager;
  private messageEncoder: MessageEncoder;
  private actionExecutor: ActionExecutor;
  private logger: Logger;
  private config: ClientConfig;
  private isRunning = false;

  constructor(config: ClientConfig) {
    this.config = config;
    this.logger = new Logger('MaicraftClient');

    // 初始化组件
    this.minecraftClient = new MinecraftClient(config.minecraft);
    this.router = new Router(config.router);
    this.stateManager = new StateManager({
      maxEventHistory: config.maxMessageHistory || 100
    });
    this.messageEncoder = new MessageEncoder();
    this.actionExecutor = new ActionExecutor();

    // 注册基础动作
    this.registerBasicActions();

    // 设置事件监听
    this.setupEventListeners();
  }

  /**
   * 注册基础动作
   */
  private registerBasicActions(): void {
    // 需要注册的基础动作类列表
    const basicActions = [
      ChatAction,
      CraftItemAction,
      PlaceBlockAction,
      MineBlockAction,
      KillMobAction,
      FollowPlayerAction,
      SmeltItemAction,
      SwimToLandAction,
      UseChestAction
    ];

    // 批量注册
    basicActions.forEach((ActionClass) => {
      this.actionExecutor.register(new ActionClass());
    });

    this.logger.info(`已注册基础动作: ${basicActions.map((a) => a.name).join(', ')}`);
  }

  /**
   * 设置事件监听
   */
  private setupEventListeners(): void {
    // 监听游戏事件
    this.minecraftClient.on('gameEvent', (event: GameEvent) => {
      this.handleGameEvent(event);
    });

    // 监听机器人连接状态
    this.minecraftClient.on('connected', () => {
      this.logger.info('Minecraft 客户端已连接');
    });

    this.minecraftClient.on('disconnected', () => {
      this.logger.warn('Minecraft 客户端连接断开');
    });

    // 监听来自上游的消息
    this.router.registerMessageHandler(async (message: MessageBase) => {
      await this.handleIncomingMessage(message);
    });
  }

  /**
   * 处理游戏事件
   */
  private async handleGameEvent(event: GameEvent): Promise<void> {
    try {
      const {enabledEvents} = this.config;
      if (enabledEvents && !enabledEvents.includes(event.type)) {
        return;
      }

      // 记录事件并更新内部状态
      this.stateManager.addEvent(event);

      const currentState = this.stateManager.getGameState();

      // 发送完整的游戏状态
      const message = this.messageEncoder.encodeGameState(currentState);
      await this.router.sendMessage(message);

      this.logger.debug(`已发送游戏事件更新: ${event.type}`);
    } catch (error) {
      this.logger.error('处理游戏事件时发生错误:', error);
    }
  }

  /**
   * 处理来自上游的消息
   */
  private async handleIncomingMessage(message: MessageBase): Promise<void> {
    try {
      this.logger.debug('收到消息:', message);

      // 解析消息内容
      const parsed = this.messageEncoder.parseActionMessage(message);

      if (parsed.type === 'action') {
        // 执行动作
        const result = await this.actionExecutor.execute(
          parsed.action ?? 'unknown',
          this.minecraftClient.getBot()!,
          parsed.params
        );

        // 发送执行结果
        const resultMessage = this.messageEncoder.encodeActionResult(result, message.message_info.message_id);
        await this.router.sendMessage(resultMessage);

        this.logger.info(`动作执行结果: ${result.success ? '成功' : '失败'} - ${result.message}`);
      } else if (parsed.type === 'query') {
        // 查询游戏状态
        const response = this.messageEncoder.encodeStateResponse(this.stateManager.getGameState(), message.message_info.message_id);
        await this.router.sendMessage(response);

        this.logger.debug('已发送状态查询响应');
      }
    } catch (error) {
      this.logger.error('处理消息时发生错误:', error);

      // 发送错误响应
      const errorMessage = this.messageEncoder.encodeError(
        error instanceof Error ? error.message : String(error),
        message.message_info.message_id
      );
      await this.router.sendMessage(errorMessage);
    }
  }

  /**
   * 启动客户端
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('客户端已经在运行中');
      return;
    }

    try {
      this.logger.info('启动 Maicraft 客户端...');

      // 启动 Router
      await this.router.run();

      // 连接 Minecraft
      await this.minecraftClient.connect();

      this.isRunning = true;
      this.logger.info('Maicraft 客户端启动成功');

      // 发送初始状态
      const initialState = this.stateManager.getGameState();
      const initialMessage = this.messageEncoder.encodeGameState(initialState);
      await this.router.sendMessage(initialMessage);
    } catch (error) {
      this.logger.error('启动客户端时发生错误:', error);
      throw error;
    }
  }

  /**
   * 停止客户端
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      this.logger.info('停止 Maicraft 客户端...');

      // 断开连接
      await this.minecraftClient.disconnect();
      await this.router.shutdown();

      this.isRunning = false;
      this.logger.info('Maicraft 客户端已停止');
    } catch (error) {
      this.logger.error('停止客户端时发生错误:', error);
      throw error;
    }
  }

  /**
   * 获取运行状态
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * 获取可用动作列表
   */
  getAvailableActions(): string[] {
    return this.actionExecutor.getActionNames();
  }

  /**
   * 获取动作信息
   */
  getActionsInfo(): Record<string, { description: string; params: Record<string, string> }> {
    return this.actionExecutor.getActionsInfo();
  }

  /**
   * 注册自定义动作
   */
  registerAction(action: any): void {
    this.actionExecutor.register(action);
    this.logger.info(`已注册自定义动作: ${action.name}`);
  }

  /**
   * 获取当前游戏状态
   */
  getCurrentState(): any {
    return this.stateManager.getGameState();
  }
} 