/**
 * Maicraft - Minecraft 游戏客户端适配器
 * 
 * 主入口文件，导出核心功能模块
 */

// 核心客户端
export { MaicraftClient } from './MaicraftClient';
export type { 
  ClientConfig,
  MinecraftConfig,
  RouteConfig
} from './MaicraftClient';

// 动作系统
export { ActionExecutor } from './minecraft/ActionExecutor';
export type { 
  GameAction,
  ActionResult,
  BaseActionParams,
  ActionRegistry
} from './minecraft/ActionInterface';

export { 
  MoveToPositionAction,
  ChatAction,
  CraftItemAction,
  DigBlockAction,
  PlaceBlockAction
} from './minecraft/BasicActions';

// 核心组件
export { MinecraftClient } from './minecraft/MinecraftClient';
export { StateManager } from './minecraft/StateManager';
export { MessageEncoder } from './minecraft/MessageEncoder';
export type { MinecraftClientOptions } from './minecraft/MinecraftClient.js';
export type { StateManagerOptions, GameState } from './minecraft/StateManager.js';
export type { MessageEncoderOptions } from './minecraft/MessageEncoder.js';

// 消息传递模块
export { WebSocketClient } from './messaging/WebSocketClient';
export { Router } from './messaging/Router';

// 类型定义
export * from './messaging/MaimMessage';
export * from './minecraft/GameEvent';

// 工具类
export { Logger, LogLevel } from './utils/Logger';

// 版本信息
export const VERSION = '0.1.0';