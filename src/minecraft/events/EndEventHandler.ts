import { BaseEventHandler } from './BaseEventHandler.js';
import { GameEventType } from '../GameEvent.js';

/**
 * 连接结束事件处理器
 * 处理机器人断开与服务器连接的事件
 * 当不再连接到服务器时触发此事件，包含断开连接的原因
 */
export class EndEventHandler extends BaseEventHandler {
  register(): void {
    this.bot.on('end', (reason: string) => {
      if (!this.isEventDisabled(GameEventType.END)) {
        this.addEvent(this.createEvent('end', {
          data: {
            reason: reason || 'socketClosed' // 使用默认值 'socketClosed'
          }
        }));
      }
    });
  }

  getEventType(): GameEventType {
    return GameEventType.END;
  }
}

