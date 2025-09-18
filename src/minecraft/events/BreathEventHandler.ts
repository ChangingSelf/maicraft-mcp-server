import { BaseEventHandler } from './BaseEventHandler.js';
import { GameEventType } from '../GameEvent.js';

/**
 * 氧气水平更新事件处理器
 * 处理玩家氧气水平变化的事件
 */
export class BreathEventHandler extends BaseEventHandler {
  register(): void {
    this.bot.on('breath', () => {
      if (!this.isEventDisabled(GameEventType.BREATH)) {
        this.addEvent(this.createEvent('breath', {
          data: {
            oxygenLevel: this.bot!.oxygenLevel,
            health: this.bot!.health,
            food: this.bot!.food
          }
        }));
      }
    });
  }

  getEventType(): GameEventType {
    return GameEventType.BREATH;
  }
}
