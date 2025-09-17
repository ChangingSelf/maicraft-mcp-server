import { BaseEventHandler } from './BaseEventHandler.js';
import { GameEventType } from '../GameEvent.js';

/**
 * 生命值更新事件处理器
 * 处理玩家生命值、饱食度和饱和度变化的事件
 */
export class HealthUpdateEventHandler extends BaseEventHandler {
  register(): void {
    this.bot.on('health', () => {
      if (!this.isEventDisabled(GameEventType.HEALTH_UPDATE)) {
        this.addEvent(this.createEvent('health', {
          health: this.bot!.health,
          food: this.bot!.food,
          saturation: this.bot!.foodSaturation
        }));
      }
    });
  }

  getEventType(): GameEventType {
    return GameEventType.HEALTH_UPDATE;
  }
}
