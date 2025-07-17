/*
 * Maicraft 消息载荷统一类型定义
 * 所有传输的 JSON 字符串应满足以下联合类型之一。
 */

import type { GameEvent } from "../minecraft/GameEvent.js";
import type { GameState } from "../minecraft/StateManager.js";

/**
 * 载荷类型枚举
 */
export enum PayloadType {
  GAME_EVENT = "game_event",
  GAME_STATE = "game_state",
  ERROR = "error",
  ACTION_RESULT = "action_result",
  ACTION = "action",
  QUERY = "query",
  PING = "ping",
  PONG = "pong"
}

/**
 * 基础载荷
 */
export interface BasePayload {
  type: string;
  message_id?: string;
  timestamp?: number;
}

/**
 * 游戏事件（Maicraft -> 下游）
 */
export interface GameEventPayload extends BasePayload {
  type: PayloadType.GAME_EVENT;
  event: GameEvent;
  timestamp: number;
  server_id: string;
  /** 额外的完整事件信息（当 includeEventDetails 为 true 时提供） */
  event_details?: GameEvent;
}

/**
 * 游戏状态快照（Maicraft -> 下游）
 */
export interface GameStatePayload extends BasePayload {
  type: PayloadType.GAME_STATE;
  state: GameState;
  timestamp: number;
}

/**
 * 错误信息（Maicraft -> 下游）
 */
export interface ErrorPayload extends BasePayload {
  type: PayloadType.ERROR;
  error_message: string;
  reference_id?: string;
  timestamp: number;
}

/**
 * 动作执行结果（Maicraft -> 下游）
 */
export interface ActionResultPayload extends BasePayload {
  type: PayloadType.ACTION_RESULT;
  result: any;
  referenceId: string;
  /** 可选时间戳，生成时通常由 MessageEncoder 填入 */
  timestamp?: number;
}

/**
 * 动作请求（下游 -> Maicraft）
 */
export interface ActionPayload extends BasePayload {
  type: PayloadType.ACTION;
  action: string;
  params?: any;
}

/**
 * 状态查询请求（下游 -> Maicraft）
 */
export interface QueryPayload extends BasePayload {
  type: PayloadType.QUERY;
}

/**
 * 心跳请求载荷
 */
export interface PingPayload extends BasePayload {
  type: PayloadType.PING;
  timestamp: number;
}

/**
 * 心跳响应载荷
 */
export interface PongPayload extends BasePayload {
  type: PayloadType.PONG;
  timestamp: number;
}

/**
 * 联合类型（开发时可按需 Narrow）
 * 
 * 下游 -> Maicraft 的请求载荷
 * 
 * 下游 -> Maicraft 的响应载荷
 * 
 * Maicraft -> 下游 的响应载荷
 */
export type MaicraftPayload =
  | GameEventPayload
  | GameStatePayload
  | ErrorPayload
  | ActionResultPayload
  | ActionPayload
  | QueryPayload
  | PingPayload
  | PongPayload;
