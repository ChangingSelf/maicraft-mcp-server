import type {
  MaicraftPayload,
  ActionPayload,
  QueryPayload,
  GameEventPayload,
  GameStatePayload,
  ErrorPayload,
  ActionResultPayload,
  PingPayload,
  PongPayload,
} from "./PayloadTypes.js";
import { PayloadType } from "./PayloadTypes.js";

/**
 * Payload 验证器
 * 
 * 提供运行时类型检查和验证功能，确保接收到的消息载荷符合预期的数据结构。
 * 主要用于：
 * 1. 验证从外部系统接收到的消息格式是否正确
 * 2. 确保消息载荷包含必要的字段和正确的数据类型
 * 3. 提供类型安全的验证结果，支持 TypeScript 类型推断
 * 4. 向后兼容旧的消息格式
 */
export class PayloadValidator {
  /**
   * 验证基础 payload 结构
   * 
   * @param data - 待验证的数据对象
   * @returns {boolean} 如果数据符合基础载荷结构则返回 true，否则返回 false
   * 
   * 验证规则：
   * - data 必须是非空对象
   * - 必须包含 type 字段且为字符串类型
   * - message_id 字段可选，如果存在必须为字符串
   * - timestamp 字段可选，如果存在必须为数字
   */
  static validateBasePayload(data: any): data is MaicraftPayload {
    return (
      data &&
      typeof data === "object" &&
      typeof data.type === "string" &&
      (data.message_id === undefined || typeof data.message_id === "string") &&
      (data.timestamp === undefined || typeof data.timestamp === "number")
    );
  }

  /**
   * 验证 ActionPayload（动作请求载荷）
   * 
   * @param data - 待验证的数据对象
   * @returns {boolean} 如果数据符合 ActionPayload 结构则返回 true，否则返回 false
   * 
   * 验证规则：
   * - 必须通过基础载荷验证
   * - type 字段必须等于 PayloadType.ACTION
   * - 必须包含 action 字段且为字符串类型
   * - params 字段可选，如果存在必须为对象类型
   */
  static validateActionPayload(data: any): data is ActionPayload {
    return (
      this.validateBasePayload(data) &&
      data.type === PayloadType.ACTION &&
      typeof data.action === "string" &&
      (data.params === undefined || typeof data.params === "object")
    );
  }

  /**
   * 验证 QueryPayload（查询请求载荷）
   * 
   * @param data - 待验证的数据对象
   * @returns {boolean} 如果数据符合 QueryPayload 结构则返回 true，否则返回 false
   * 
   * 验证规则：
   * - 必须通过基础载荷验证
   * - type 字段必须等于 PayloadType.QUERY
   */
  static validateQueryPayload(data: any): data is QueryPayload {
    return this.validateBasePayload(data) && data.type === PayloadType.QUERY;
  }

  /**
   * 验证 GameEventPayload（游戏事件载荷）
   * 
   * @param data - 待验证的数据对象
   * @returns {boolean} 如果数据符合 GameEventPayload 结构则返回 true，否则返回 false
   * 
   * 验证规则：
   * - 必须通过基础载荷验证
   * - type 字段必须等于 PayloadType.GAME_EVENT
   * - 必须包含 event 字段且为对象类型
   * - 必须包含 timestamp 字段且为数字类型
   * - 必须包含 server_id 字段且为字符串类型
   * - event_details 字段可选，如果存在必须为对象类型
   */
  static validateGameEventPayload(data: any): data is GameEventPayload {
    return (
      this.validateBasePayload(data) &&
      data.type === PayloadType.GAME_EVENT &&
      typeof data.event === "object" &&
      typeof data.timestamp === "number" &&
      typeof data.server_id === "string" &&
      (data.event_details === undefined || typeof data.event_details === "object")
    );
  }

  /**
   * 验证 GameStatePayload（游戏状态载荷）
   * 
   * @param data - 待验证的数据对象
   * @returns {boolean} 如果数据符合 GameStatePayload 结构则返回 true，否则返回 false
   * 
   * 验证规则：
   * - 必须通过基础载荷验证
   * - type 字段必须等于 PayloadType.GAME_STATE
   * - 必须包含 state 字段且为对象类型
   * - 必须包含 timestamp 字段且为数字类型
   */
  static validateGameStatePayload(data: any): data is GameStatePayload {
    return (
      this.validateBasePayload(data) &&
      data.type === PayloadType.GAME_STATE &&
      typeof data.state === "object" &&
      typeof data.timestamp === "number"
    );
  }

  /**
   * 验证 ErrorPayload（错误载荷）
   * 
   * @param data - 待验证的数据对象
   * @returns {boolean} 如果数据符合 ErrorPayload 结构则返回 true，否则返回 false
   * 
   * 验证规则：
   * - 必须通过基础载荷验证
   * - type 字段必须等于 PayloadType.ERROR
   * - 必须包含 error_message 字段且为字符串类型
   * - 必须包含 timestamp 字段且为数字类型
   * - reference_id 字段可选，如果存在必须为字符串类型
   */
  static validateErrorPayload(data: any): data is ErrorPayload {
    return (
      this.validateBasePayload(data) &&
      data.type === PayloadType.ERROR &&
      typeof data.error_message === "string" &&
      typeof data.timestamp === "number" &&
      (data.reference_id === undefined || typeof data.reference_id === "string")
    );
  }

  /**
   * 验证 ActionResultPayload（动作结果载荷）
   * 
   * @param data - 待验证的数据对象
   * @returns {boolean} 如果数据符合 ActionResultPayload 结构则返回 true，否则返回 false
   * 
   * 验证规则：
   * - 必须通过基础载荷验证
   * - type 字段必须等于 PayloadType.ACTION_RESULT
   * - 必须包含 result 字段
   * - 必须包含 referenceId 字段且为字符串类型
   * - timestamp 字段可选，如果存在必须为数字类型
   */
  static validateActionResultPayload(data: any): data is ActionResultPayload {
    return (
      this.validateBasePayload(data) &&
      data.type === PayloadType.ACTION_RESULT &&
      data.result !== undefined &&
      typeof data.referenceId === "string" &&
      (data.timestamp === undefined || typeof data.timestamp === "number")
    );
  }

  /**
   * 验证 PingPayload（心跳请求载荷）
   * 
   * @param data - 待验证的数据对象
   * @returns {boolean} 如果数据符合 PingPayload 结构则返回 true，否则返回 false
   * 
   * 验证规则：
   * - 必须通过基础载荷验证
   * - type 字段必须等于 PayloadType.PING
   * - 必须包含 timestamp 字段且为数字类型
   */
  static validatePingPayload(data: any): data is PingPayload {
    return (
      this.validateBasePayload(data) &&
      data.type === PayloadType.PING &&
      typeof data.timestamp === "number"
    );
  }

  /**
   * 验证 PongPayload（心跳响应载荷）
   * 
   * @param data - 待验证的数据对象
   * @returns {boolean} 如果数据符合 PongPayload 结构则返回 true，否则返回 false
   * 
   * 验证规则：
   * - 必须通过基础载荷验证
   * - type 字段必须等于 PayloadType.PONG
   * - 必须包含 timestamp 字段且为数字类型
   */
  static validatePongPayload(data: any): data is PongPayload {
    return (
      this.validateBasePayload(data) &&
      data.type === PayloadType.PONG &&
      typeof data.timestamp === "number"
    );
  }

  /**
   * 验证传入的 payload 并返回类型安全的载荷对象
   * 
   * @param data - 待验证的数据对象
   * @returns {MaicraftPayload} 验证通过后返回类型安全的载荷对象
   * @throws {Error} 当载荷格式无效时抛出错误
   * 
   * 验证流程：
   * 1. 首先验证基础载荷结构
   * 2. 根据 type 字段确定载荷类型
   * 3. 调用对应的验证方法进行详细验证
   * 4. 验证通过后返回类型安全的载荷对象
   * 5. 验证失败时抛出描述性错误信息
   */
  static validateIncomingPayload(data: any): MaicraftPayload {
    if (!this.validateBasePayload(data)) {
      throw new Error("Invalid payload structure");
    }

    const payloadType = data.type as string;
    switch (payloadType) {
      case PayloadType.ACTION:
        if (!this.validateActionPayload(data)) {
          throw new Error("Invalid action payload");
        }
        break;
      case PayloadType.QUERY:
        if (!this.validateQueryPayload(data)) {
          throw new Error("Invalid query payload");
        }
        break;
      case PayloadType.GAME_EVENT:
        if (!this.validateGameEventPayload(data)) {
          throw new Error("Invalid game event payload");
        }
        break;
      case PayloadType.GAME_STATE:
        if (!this.validateGameStatePayload(data)) {
          throw new Error("Invalid game state payload");
        }
        break;
      case PayloadType.ERROR:
        if (!this.validateErrorPayload(data)) {
          throw new Error("Invalid error payload");
        }
        break;
      case PayloadType.ACTION_RESULT:
        if (!this.validateActionResultPayload(data)) {
          throw new Error("Invalid action result payload");
        }
        break;
      case PayloadType.PING:
        if (!this.validatePingPayload(data)) {
          throw new Error("Invalid ping payload");
        }
        break;
      case PayloadType.PONG:
        if (!this.validatePongPayload(data)) {
          throw new Error("Invalid pong payload");
        }
        break;
      default:
        throw new Error(`Unsupported payload type: ${payloadType}`);
    }

    return data as MaicraftPayload;
  }
}
