import { GameEvent } from './GameEvent.js';
import { MessageBase, MessageBuilder, MessageParser } from '../messaging/MaimMessage.js';
import { GameState } from './StateManager.js';
import { Logger } from '../utils/Logger.js';
import type {
  ActionPayload,
  QueryPayload,
  MaicraftPayload,
  ActionResultPayload,
  StateResponsePayload,
  ErrorPayload
} from '../messaging/PayloadTypes.js';
import type { ActionResult } from './ActionInterface.js';

export interface MessageEncoderOptions {
  platform: string;
  botUserId: string;
  serverId: string;
  includeEventDetails: boolean;
}

/**
 * 消息编码器类
 * 负责将游戏事件和状态转换为 maim_message 格式
 */
export class MessageEncoder {
  private options: MessageEncoderOptions;
  private logger: Logger;
  private messageCounter = 0;

  constructor(options: Partial<MessageEncoderOptions> = {}) {
    this.options = {
      platform: 'minecraft',
      botUserId: 'minecraft_bot',
      serverId: 'minecraft_server',
      includeEventDetails: false,
      ...options
    };

    this.logger = new Logger('MessageEncoder');
  }

  /**
   * 将游戏状态编码为 maim_message
   */
  encodeGameState(state: GameState): MessageBase {
    const messageId = this.generateMessageId();
    
    const builder = new MessageBuilder(
      this.options.platform,
      messageId,
      this.options.botUserId,
      this.options.serverId
    );

    builder.setUserInfo({
      platform: this.options.platform,
      user_id: this.options.botUserId,
      user_name: 'MinecraftBot',
      user_displayname: 'MinecraftBot'
    });

    const payload = {
      type: 'game_state',
      ...state,
    };

    builder.addText(JSON.stringify(payload));
    builder.setExtraInfo({});
    return builder.build();
  }

  /**
   * 编码错误响应
   */
  encodeError(errorMessage: string, referenceId?: string): MessageBase {
    const messageId = this.generateMessageId();
    const builder = new MessageBuilder(
      this.options.platform,
      messageId,
      this.options.botUserId,
      this.options.serverId
    );

    const payload: ErrorPayload = {
      type: 'error',
      error_message: errorMessage,
      reference_id: referenceId,
      timestamp: Date.now()
    };

    builder.addText(JSON.stringify(payload));
    builder.setExtraInfo({});
    return builder.build();
  }
  
  /**
   * 解析来自上游的动作或查询消息
   */
  parseActionMessage(message: MessageBase): { type: 'action' | 'query'; action?: string; params?: any } {
    try {
      const text = MessageParser.extractText(message);
      if (!text) {
        throw new Error('Empty message content');
      }
      const data = JSON.parse(text) as MaicraftPayload;

      if (data.type === 'action') {
        const payload = data as ActionPayload;
        return {
          type: 'action',
          action: payload.action,
          params: payload.params
        };
      }

      if (data.type === 'query') {
        return { type: 'query' };
      }
    } catch (error) {
      this.logger.warn('Failed to parse incoming message:', error);
    }
    
    throw new Error(`Unknown or unparseable message type in message: ${message.message_info.message_id}`);
  }

  /**
   * 编码动作执行结果
   */
  encodeActionResult(result: ActionResult, referenceId: string): MessageBase {
    const messageId = this.generateMessageId();
    const builder = new MessageBuilder(
      this.options.platform,
      messageId,
      this.options.botUserId,
      this.options.serverId
    );

    const payload: ActionResultPayload = { type: 'action_result', result, referenceId, timestamp: Date.now() };

    builder.addText(JSON.stringify(payload));
    builder.setExtraInfo({});
    return builder.build();
  }

  /**
   * 编码状态查询响应
   */
  encodeStateResponse(state: GameState, referenceId: string): MessageBase {
    const messageId = this.generateMessageId();
    const builder = new MessageBuilder(
      this.options.platform,
      messageId,
      this.options.botUserId,
      this.options.serverId
    );

    const payload: StateResponsePayload = {
      type: 'query_response',
      status: 'success',
      game_state: state,
      referenceId: referenceId,
      timestamp: Date.now()
    };

    builder.addText(JSON.stringify(payload));
    builder.setExtraInfo({});
    return builder.build();
  }

  /**
   * 生成唯一的消息 ID
   */
  private generateMessageId(): string {
    return `${this.options.platform}-${this.options.botUserId}-${Date.now()}-${this.messageCounter++}`;
  }
} 