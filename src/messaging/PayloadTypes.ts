/*
 * Maicraft 消息载荷统一类型定义
 * 所有通过 maim_message.text 传输的 JSON 字符串应满足以下联合类型之一。
 */

import type { GameEvent } from '../minecraft/GameEvent.js';
import type { GameState } from '../minecraft/StateManager.js';

// 1. 游戏事件
export interface GameEventPayload {
  type: 'game_event';
  event: GameEvent;
  timestamp: number;
  server_id: string;
  /** 额外的完整事件信息（当 includeEventDetails 为 true 时提供） */
  event_details?: GameEvent;
}

// 2. 周期性完整状态快照
export interface GameStatePayload {
  type: 'game_state';
  state: GameState;
  timestamp: number;
}

// 3. 聊天信息
export interface ChatPayload {
  type: 'chat';
  message: string;
  player_name: string;
  timestamp: number;
  context?: string;
}

// 4. 系统通知
export interface SystemNotificationPayload {
  type: 'system_notification';
  notification_type: string;
  message: string;
  timestamp: number;
}

// 5. 低级决策（面向 Amaidesu）
export interface LowLevelDecisionPayload {
  type: 'low_level_decision';
  event: GameEvent;
  game_state: GameState;
  timestamp: number;
  current_task?: string;
  /** 标记该决策是否需要即时执行 */
  requires_immediate_action?: boolean;
}

// 6. 高级决策（面向 MaiBot）
export interface HighLevelDecisionPayload {
  type: 'high_level_decision';
  game_state: GameState;
  recent_events: GameEvent[];
  timestamp: number;
  long_term_goals?: string[];
  /** 标记是否需要战略思考 */
  requires_strategic_thinking?: boolean;
  /** 最近事件数量 */
  recent_events_count?: number;
}

// 7. 错误信息
export interface ErrorPayload {
  type: 'error';
  error_message: string;
  reference_id?: string;
  timestamp: number;
}

// 8. 动作执行结果
export interface ActionResultPayload {
  type: 'action_result';
  result: any;
  referenceId: string;
  /** 可选时间戳，生成时通常由 MessageEncoder 填入 */
  timestamp?: number;
}

/**
 * 状态响应载荷
 */
export interface StateResponsePayload {
  type: 'query_response';
  status: 'success' | 'error';
  game_state?: GameState;
  error?: string;
  referenceId: string;
  timestamp: number;
}

// 以下两种为「下游 → Maicraft」请求载荷
// 10. 动作请求
export interface ActionPayload {
  type: 'action';
  action: string;
  params?: any;
}

// 11. 状态查询请求
export interface QueryPayload {
  type: 'query';
}

// 联合类型（开发时可按需 Narrow）
export type MaicraftPayload =
  | GameEventPayload
  | GameStatePayload
  | ChatPayload
  | SystemNotificationPayload
  | LowLevelDecisionPayload
  | HighLevelDecisionPayload
  | ErrorPayload
  | ActionResultPayload
  | StateResponsePayload
  | ActionPayload
  | QueryPayload; 