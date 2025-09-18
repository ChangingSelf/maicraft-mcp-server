import { BaseEventHandler } from './BaseEventHandler.js';
import { GameEventType } from '../GameEvent.js';
import { DebugCommandHandler } from '../../utils/DebugCommandHandler.js';
import { ChatFilterManager } from '../../utils/ChatFilterManager.js';

/**
 * 聊天事件处理器
 * 处理玩家聊天消息，包括调试命令和聊天过滤
 */
export class ChatEventHandler extends BaseEventHandler {
  private debugCommandHandler?: DebugCommandHandler;
  private chatFilterManager?: ChatFilterManager;

  constructor(
    bot: any,
    isEventDisabled: (eventType: GameEventType) => boolean,
    addEvent: (event: any) => void,
    getCurrentGameTick: () => number,
    getCurrentTimestamp: () => number,
    debugCommandHandler?: DebugCommandHandler,
    chatFilterManager?: ChatFilterManager
  ) {
    super(bot, isEventDisabled, addEvent, getCurrentGameTick, getCurrentTimestamp);
    this.debugCommandHandler = debugCommandHandler;
    this.chatFilterManager = chatFilterManager;
  }

  register(): void {
    this.bot.on('chat', async (
      /** 发送消息的玩家用户名 */
      username: string,
      /** 去除颜色和控制字符的消息内容 */
      message: string,
      /** 聊天消息类型，对于大多数bukkit聊天消息为null */
      translate: string | null,
      /** 服务器发送的未修改的JSON消息 */
      jsonMsg: any,
      /** 正则表达式匹配结果数组，可能为null */
      matches: any
    ) => {
      // 处理调试命令
      if (this.debugCommandHandler) {
        const isHandled = await this.debugCommandHandler.handleChatMessage(username, message);
        if (isHandled) return;
      }

      // 处理聊天过滤
      if (this.chatFilterManager?.shouldFilterMessage(username, message)) {
        return;
      }

      // 创建事件
      if (!this.isEventDisabled(GameEventType.CHAT)) {
        this.addEvent(this.createEvent('chat', {
          data: {
            username,
            message,
            translate,
            jsonMsg,
            matches
          }
        }));
      }
    });
  }

  getEventType(): GameEventType {
    return GameEventType.CHAT;
  }
}
