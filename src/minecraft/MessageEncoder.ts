import { GameState } from "./StateManager.js";
import { Logger } from "../utils/Logger.js";
import type {
  ActionPayload,
  QueryPayload,
  MaicraftPayload,
  ActionResultPayload,
  ErrorPayload,
  GameStatePayload,
} from "../messaging/PayloadTypes.js";
import { PayloadType } from "../messaging/PayloadTypes.js";
import type { ActionResult } from "./ActionInterface.js";

export interface MessageEncoderOptions {
  platform: string;
  botUserId: string;
  serverId: string;
  includeEventDetails: boolean;
}

/**
 * 消息编码器类
 * 负责将游戏事件和状态转换为直接的 JSON 载荷对象
 */
export class MessageEncoder {
  private options: MessageEncoderOptions;
  private logger: Logger;
  private counter = 0;

  constructor(options: Partial<MessageEncoderOptions> = {}) {
    this.options = {
      platform: "minecraft",
      botUserId: "minecraft_bot",
      serverId: "minecraft_server",
      includeEventDetails: false,
      ...options,
    };

    this.logger = new Logger("MessageEncoder");
  }

  /**
   * 生成简单的唯一消息ID
   */
  private generateMessageId(): string {
    return `msg-${Date.now()}-${++this.counter}`;
  }

  /**
   * 将游戏状态编码为 GameStatePayload
   */
  encodeGameState(state: GameState): GameStatePayload {
    return {
      type: PayloadType.GAME_STATE,
      state,
      timestamp: Date.now(),
      message_id: this.generateMessageId(),
    };
  }

  /**
   * 编码错误响应
   */
  encodeError(errorMessage: string, referenceId?: string): ErrorPayload {
    return {
      type: PayloadType.ERROR,
      error_message: errorMessage,
      reference_id: referenceId,
      timestamp: Date.now(),
      message_id: this.generateMessageId(),
    };
  }

  /**
   * 编码动作执行结果
   */
  encodeActionResult(
    result: ActionResult,
    referenceId: string
  ): ActionResultPayload {
    return {
      type: PayloadType.ACTION_RESULT,
      result,
      referenceId,
      timestamp: Date.now(),
      message_id: this.generateMessageId(),
    };
  }

  /**
   * 编码状态查询响应
   */
  encodeStateResponse(
    state: GameState,
    referenceId: string
  ): GameStatePayload {
    return {
      type: PayloadType.GAME_STATE,
      state,
      timestamp: Date.now(),
      message_id: this.generateMessageId(),
    };
  }

  /**
   * 解析来自上游的 JSON 消息
   */
  parseIncomingMessage(jsonData: string): {
    type: PayloadType.ACTION | PayloadType.QUERY;
    action?: string;
    params?: any;
  } {
    try {
      if (!jsonData || jsonData.trim() === "") {
        throw new Error("Empty message content");
      }

      const data = JSON.parse(jsonData) as MaicraftPayload;

      if (data.type === PayloadType.ACTION) {
        const payload = data as ActionPayload;
        return {
          type: PayloadType.ACTION,
          action: payload.action,
          params: payload.params,
        };
      }

      if (data.type === PayloadType.QUERY) {
        return { type: PayloadType.QUERY };
      }

      throw new Error(`Unsupported message type: ${data.type}`);
    } catch (error) {
      this.logger.warn("Failed to parse incoming message:", error);
      throw new Error(
        `Failed to parse message: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
