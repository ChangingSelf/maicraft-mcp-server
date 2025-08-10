/**
 * Maicraft - Minecraft 游戏客户端适配器
 *
 * 主入口文件，导出核心功能模块
 */

// 核心客户端
export { MaicraftClient } from "./MaicraftClient.js";
export type { ClientConfig, MinecraftConfig } from "./MaicraftClient.js";

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
export type { GameState } from "./minecraft/StateManager.js";

// 工具类
export { Logger } from "./utils/Logger.js";

// 动作执行器
export { ActionExecutor } from "./minecraft/ActionExecutor.js";
export type { ActionInfo } from "./minecraft/ActionExecutor.js";

// 所有预定义动作
export { ChatAction } from "./actions/ChatAction.js";
export { CraftItemAction } from "./actions/CraftItemAction.js";
export { PlaceBlockAction } from "./actions/PlaceBlockAction.js";
export { MineBlockAction } from "./actions/MineBlockAction.js";
export { KillMobAction } from "./actions/KillMobAction.js";
export { FollowPlayerAction } from "./actions/FollowPlayerAction.js";
export { SmeltItemAction } from "./actions/SmeltItemAction.js";
export { SwimToLandAction } from "./actions/SwimToLandAction.js";
export { UseChestAction } from "./actions/UseChestAction.js";

// 核心组件
export * from "./minecraft/GameEvent.js";

// 版本信息
export const VERSION = "1.0.0";
