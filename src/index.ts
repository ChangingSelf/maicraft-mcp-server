/**
 * Maicraft - Minecraft 游戏客户端适配器
 *
 * 主入口文件，导出核心功能模块
 */

// 核心客户端
export { MaicraftClient } from "./MaicraftClient";
export type { ClientConfig, MinecraftConfig } from "./MaicraftClient";

// 动作系统
export type {
  GameAction,
  ActionResult,
  BaseActionParams,
  ActionRegistry,
} from "./minecraft/ActionInterface";
export { BaseAction } from "./minecraft/ActionInterface";

// 消息系统
export type { MaicraftPayload } from "./messaging/PayloadTypes";
export { PayloadType } from "./messaging/PayloadTypes";

// 游戏事件和状态
export type { GameEvent } from "./minecraft/GameEvent";
export type { GameState } from "./minecraft/StateManager";

// 工具类
export { Logger } from "./utils/Logger";

// 动作执行器
export { ActionExecutor } from "./minecraft/ActionExecutor";
export type { ActionInfo } from "./minecraft/ActionExecutor";

// 所有预定义动作
export { ChatAction } from "./actions/ChatAction";
export { CraftItemAction } from "./actions/CraftItemAction";
export { PlaceBlockAction } from "./actions/PlaceBlockAction";
export { MineBlockAction } from "./actions/MineBlockAction";
export { KillMobAction } from "./actions/KillMobAction";
export { FollowPlayerAction } from "./actions/FollowPlayerAction";
export { SmeltItemAction } from "./actions/SmeltItemAction";
export { SwimToLandAction } from "./actions/SwimToLandAction";
export { UseChestAction } from "./actions/UseChestAction";

// 核心组件
export * from "./messaging/MaimMessage";
export * from "./minecraft/GameEvent";

// 版本信息
export const VERSION = "1.0.0";
