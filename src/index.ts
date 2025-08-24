/**
 * Maicraft - Minecraft 游戏客户端适配器
 *
 * 主入口文件，导出核心功能模块
 */

// 配置与核心组件
export type { ClientConfig, MinecraftConfig } from "./config.js";
export { Logger } from "./utils/Logger.js";
export { ActionExecutor } from "./minecraft/ActionExecutor.js";
export type { ActionInfo } from "./minecraft/ActionExecutor.js";
export * from "./minecraft/GameEvent.js";

// 动作系统
export type {
  GameAction,
  ActionResult,
  BaseActionParams,
  ActionRegistry,
} from "./minecraft/ActionInterface";
export { BaseAction } from "./minecraft/ActionInterface";

// 游戏事件和状态
export type { GameEvent } from "./minecraft/GameEvent.js";


// 工具类与执行器已在前方导出

// 动作由 ActionExecutor 自动发现，无需在此显式导出

// 核心组件
export * from "./minecraft/GameEvent.js";

// 版本信息
export const VERSION = "1.0.0";
