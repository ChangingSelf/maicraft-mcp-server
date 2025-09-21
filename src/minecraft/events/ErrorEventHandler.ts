import { BaseEventHandler } from './BaseEventHandler.js';
import { GameEventType } from '../GameEvent.js';

/**
 * 错误事件处理器
 * 处理机器人发生错误的事件
 * 当发生错误时触发此事件，包含错误信息和堆栈跟踪
 */
export class ErrorEventHandler extends BaseEventHandler {
  register(): void {
    this.bot.on('error', (err: Error) => {
      if (!this.isEventDisabled(GameEventType.ERROR)) {
        this.addEvent(this.createEvent('error', {
          data: {
            error: err
          }
        }));
      }
    });
  }

  getEventType(): GameEventType {
    return GameEventType.ERROR;
  }
}

