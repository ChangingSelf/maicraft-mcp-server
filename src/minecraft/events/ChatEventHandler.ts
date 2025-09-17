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
    this.bot.on('chat', async (username: string, message: string, translate: string | null, jsonMsg: any, matches: any) => {
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
          chatInfo: {
            text: message,
            username
          }
        }));
      }
    });
  }

  getEventType(): GameEventType {
    return GameEventType.CHAT;
  }
}
