import { BaseEventHandler } from './BaseEventHandler.js';
import { GameEventType } from '../GameEvent.js';

/**
 * 强制移动事件处理器
 * 处理机器人被服务器强制移动的事件（传送、生成等）
 * 当机器人位置被服务器强制改变时触发此事件
 */
export class ForcedMoveEventHandler extends BaseEventHandler {
  register(): void {
    this.bot.on('forcedMove', () => {
      if (!this.isEventDisabled(GameEventType.FORCED_MOVE)) {
        this.addEvent(this.createEvent('forcedMove', {
          data: {
            position: {
              x: this.bot.entity.position.x,
              y: this.bot.entity.position.y,
              z: this.bot.entity.position.z
            }
          }
        }));
      }
    });
  }

  getEventType(): GameEventType {
    return GameEventType.FORCED_MOVE;
  }
}
