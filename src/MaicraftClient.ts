import { Router } from "./messaging/Router";
import { MinecraftClient } from "./minecraft/MinecraftClient";
import { StateManager } from "./minecraft/StateManager";
import { MessageEncoder } from "./minecraft/MessageEncoder";

import { ActionExecutor } from "./minecraft/ActionExecutor";
import { ChatAction } from "./actions/ChatAction";
import { CraftItemAction } from "./actions/CraftItemAction";
import { PlaceBlockAction } from "./actions/PlaceBlockAction";
import { MineBlockAction } from "./actions/MineBlockAction";
import { KillMobAction } from "./actions/KillMobAction";
import { FollowPlayerAction } from "./actions/FollowPlayerAction";
import { SmeltItemAction } from "./actions/SmeltItemAction";
import { SwimToLandAction } from "./actions/SwimToLandAction";
import { UseChestAction } from "./actions/UseChestAction";

import { Logger } from "./utils/Logger";
import { GameEvent } from "./minecraft/GameEvent";
import type { MaicraftPayload } from "./messaging/PayloadTypes.js";
import { PayloadType } from "./messaging/PayloadTypes.js";
import type { RouteConfig } from "./messaging/MaimMessage.js";

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
    this.logger = new Logger("MaicraftClient");

    // 初始化组件
    this.minecraftClient = new MinecraftClient(config.minecraft);
    this.router = new Router(config.router);
    this.stateManager = new StateManager({
      maxEventHistory: config.maxMessageHistory || 100,
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
    });

    this.minecraftClient.on("disconnected", () => {
      this.logger.warn("Minecraft 客户端连接断开");
    });

    // 监听来自上游的消息
    this.router.registerMessageHandler(async (payload: MaicraftPayload) => {
      await this.handleIncomingMessage(payload);
    });
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

      const currentState = this.stateManager.getGameState();

      // 发送完整的游戏状态
      const message = this.messageEncoder.encodeGameState(currentState);
      await this.router.sendMessage(message);

      this.logger.debug(`已发送游戏事件更新: ${event.type}`);
    } catch (error) {
      this.logger.error("处理游戏事件时发生错误:", error);
    }
  }

  /**
   * 处理来自上游的消息
   */
  private async handleIncomingMessage(payload: MaicraftPayload): Promise<void> {
    try {
      this.logger.debug("收到消息:", payload);

      if (payload.type === PayloadType.ACTION) {
        // 检查 Minecraft 连接状态
        const bot = this.minecraftClient.getBot();
        if (!bot) {
          const errorResult = {
            success: false,
            message: "Minecraft 客户端未连接，无法执行动作",
            error: 'MINECRAFT_NOT_CONNECTED'
          };
          
          const resultMessage = this.messageEncoder.encodeActionResult(
            errorResult,
            payload.message_id || ""
          );
          await this.router.sendMessage(resultMessage);
          
          this.logger.warn("尝试执行动作但 Minecraft 未连接");
          return;
        }

        // 执行动作
        const actionPayload = payload as any; // ActionPayload
        const result = await this.actionExecutor.execute(
          actionPayload.action ?? "unknown",
          bot,
          actionPayload.params
        );

        // 发送执行结果
        const resultMessage = this.messageEncoder.encodeActionResult(
          result,
          payload.message_id || ""
        );
        await this.router.sendMessage(resultMessage);

        this.logger.info(
          `动作执行结果: ${result.success ? "成功" : "失败"} - ${
            result.message
          }`
        );
      } else if (payload.type === PayloadType.QUERY) {
        // 查询游戏状态
        const response = this.messageEncoder.encodeStateResponse(
          this.stateManager.getGameState(),
          payload.message_id || ""
        );
        await this.router.sendMessage(response);

        this.logger.debug("已发送状态查询响应");
      }
    } catch (error) {
      this.logger.error("处理消息时发生错误:", error);

      // 发送错误响应
      const errorMessage = this.messageEncoder.encodeError(
        error instanceof Error ? error.message : String(error),
        payload.message_id
      );
      await this.router.sendMessage(errorMessage);
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

      // 启动 Router（不等待连接完成）
      await this.router.run();

      // 尝试连接 Minecraft，如果失败则记录错误但不崩溃
      try {
        await this.minecraftClient.connect();
        this.logger.info("Minecraft 连接成功");
      } catch (error) {
        this.logger.error("Minecraft 连接失败，但程序将继续运行:", error);
        // 不抛出错误，让程序继续运行
      }

      this.isRunning = true;
      this.logger.info("Maicraft 客户端启动成功");

      // 发送初始状态（如果连接成功）
      if (this.minecraftClient.isConnectedToServer()) {
        const initialState = this.stateManager.getGameState();
        const initialMessage = this.messageEncoder.encodeGameState(initialState);
        await this.router.sendMessage(initialMessage);
      }
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
      await this.router.stop();

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
}
