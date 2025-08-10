import { MinecraftClient } from "./minecraft/MinecraftClient.js";
import { StateManager } from "./minecraft/StateManager.js";

import { ActionExecutor } from "./minecraft/ActionExecutor.js";
import { ChatAction } from "./actions/ChatAction.js";
import { CraftItemAction } from "./actions/CraftItemAction.js";
import { PlaceBlockAction } from "./actions/PlaceBlockAction.js";
import { MineBlockAction } from "./actions/MineBlockAction.js";
import { KillMobAction } from "./actions/KillMobAction.js";
import { FollowPlayerAction } from "./actions/FollowPlayerAction.js";
import { SmeltItemAction } from "./actions/SmeltItemAction.js";
import { SwimToLandAction } from "./actions/SwimToLandAction.js";
import { UseChestAction } from "./actions/UseChestAction.js";

import { Logger } from "./utils/Logger.js";
import { GameEvent } from "./minecraft/GameEvent.js";

/**
 * Minecraft 配置
 */
export interface MinecraftConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  auth: "offline" | "microsoft" | "mojang";
  version?: string;
}

/**
 * 客户端配置
 */
export interface ClientConfig {
  minecraft: MinecraftConfig;
  enabledEvents?: string[];
  maxMessageHistory?: number;
}

/**
 * Maicraft 客户端（MaicraftClient）
 * 提供游戏事件监听、动作执行与路由转发能力
 */
export class MaicraftClient {
  private minecraftClient: MinecraftClient;
  private stateManager: StateManager;
  private actionExecutor: ActionExecutor;
  private logger: Logger;
  private config: ClientConfig;
  private isRunning = false;

  constructor(config: ClientConfig) {
    this.config = config;
    this.logger = new Logger("MaicraftClient");

    // 初始化组件
    this.minecraftClient = new MinecraftClient(config.minecraft);
    this.stateManager = new StateManager({
      maxEventHistory: config.maxMessageHistory || 100,
    });
    this.actionExecutor = new ActionExecutor();

    // 注册基础动作
    this.registerBasicActions();

    // 设置事件监听
    this.setupEventListeners();

    // 应用事件过滤配置（如果提供）
    if (Array.isArray(config.enabledEvents) && config.enabledEvents.length > 0) {
      // 由 MinecraftClient 自行过滤事件
      // @ts-ignore 允许传入字符串数组，内部做映射/容错
      this.minecraftClient.setEnabledEvents(config.enabledEvents as any);
    }
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
      UseChestAction,
    ];

    // 批量注册
    basicActions.forEach((ActionClass) => {
      this.actionExecutor.register(new ActionClass());
    });

    this.logger.info(
      `已注册基础动作: ${basicActions.map((a) => a.name).join(", ")}`
    );
  }

  /**
   * 设置事件监听
   */
  private setupEventListeners(): void {
    // 监听游戏事件
    this.minecraftClient.on("gameEvent", (event: GameEvent) => {
      this.handleGameEvent(event);
    });

    // 监听机器人连接状态
    this.minecraftClient.on("connected", () => {
      this.logger.info("Minecraft 客户端已连接");
      const bot = this.minecraftClient.getBot();
      if (bot) {
        this.stateManager.setBot(bot);
      }
    });

    this.minecraftClient.on("disconnected", () => {
      this.logger.warn("Minecraft 客户端连接断开");
      this.stateManager.setStatus('unavailable');
    });

    // 不再处理上游 WebSocket 消息，交互统一通过 MCP Server 提供的工具完成
  }

  /**
   * 处理游戏事件
   */
  private async handleGameEvent(event: GameEvent): Promise<void> {
    try {
      const { enabledEvents } = this.config;
      if (enabledEvents && !enabledEvents.includes(event.type)) {
        return;
      }

      // 记录事件并更新内部状态
      this.stateManager.addEvent(event);
      this.logger.debug(`事件已记录: ${event.type}`);
    } catch (error) {
      this.logger.error("处理游戏事件时发生错误:", error);
    }
  }

  /**
   * 启动客户端
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn("客户端已经在运行中");
      return;
    }

    try {
      this.logger.info("启动 Maicraft 客户端...");

      // 尝试连接 Minecraft，如果失败则记录错误但不崩溃
      try {
        this.stateManager.setStatus('connecting');
        await this.minecraftClient.connect();
        this.logger.info("Minecraft 连接成功");
      } catch (error) {
        this.logger.error("Minecraft 连接失败，但程序将继续运行:", error);
        // 不抛出错误，让程序继续运行
        this.stateManager.setStatus('unavailable');
      }

      this.isRunning = true;
      this.logger.info("Maicraft 客户端启动成功");

      // 不再向上游广播初始状态（由 MCP 查询）。
    } catch (error) {
      this.logger.error("启动客户端时发生错误:", error);
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
      this.logger.info("停止 Maicraft 客户端...");

      // 断开连接
      await this.minecraftClient.disconnect();

      this.isRunning = false;
      this.logger.info("Maicraft 客户端已停止");
    } catch (error) {
      this.logger.error("停止客户端时发生错误:", error);
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
   * 获取所有已注册的动作名称
   */
  getAvailableActions(): string[] {
    return this.actionExecutor.getRegisteredActions();
  }

  /**
   * 获取所有动作的详细信息
   */
  getActionsInfo(): Record<string, { description: string; params: Record<string, string> }> {
    return this.actionExecutor.getAllActionsInfo();
  }

  /**
   * 获取特定动作的信息
   */
  getActionInfo(actionName: string): { description: string; params: Record<string, string> } | null {
    return this.actionExecutor.getActionInfo(actionName);
  }

  /**
   * 设置动作执行超时时间
   */
  setActionTimeout(timeoutMs: number): void {
    this.actionExecutor.setDefaultTimeout(timeoutMs);
  }

  /**
   * 获取当前动作执行超时时间
   */
  getActionTimeout(): number {
    return this.actionExecutor.getDefaultTimeout();
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

  /**
   * 将动作添加到队列（带优先级）
   */
  async queueAction(
    name: string, 
    params: any, 
    priority: number = 0,
    timeout?: number
  ): Promise<any> {
    const bot = this.minecraftClient.getBot();
    if (!bot) {
      throw new Error('Minecraft 客户端未连接');
    }
    return this.actionExecutor.queueAction(name, bot, params, priority, timeout);
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): { length: number; isProcessing: boolean } {
    return this.actionExecutor.getQueueStatus();
  }

  /**
   * 清空动作队列
   */
  clearActionQueue(): void {
    this.actionExecutor.clearQueue();
  }

  // ---- Expose internal components for MCP integration ----
  getMinecraftClient(): MinecraftClient {
    return this.minecraftClient;
  }

  getStateManager(): StateManager {
    return this.stateManager;
  }

  getActionExecutor(): ActionExecutor {
    return this.actionExecutor;
  }
}
