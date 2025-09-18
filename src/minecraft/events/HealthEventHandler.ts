import { BaseEventHandler } from './BaseEventHandler.js';
import { GameEventType } from '../GameEvent.js';

/**
 * 生命值更新事件处理器
 * 处理玩家生命值、饱食度和饱和度变化的事件
 */
export class HealthEventHandler extends BaseEventHandler {
  register(): void {
    this.bot.on('health', () => {
      if (!this.isEventDisabled(GameEventType.HEALTH)) {
        this.addEvent(this.createEvent('health', {
          data: {
            health: this.bot!.health,
            maxHealth: 20,
            food: this.bot!.food,
            foodSaturation: this.bot!.foodSaturation
          }
        }));
      }
    });
  }

  getEventType(): GameEventType {
    return GameEventType.HEALTH;
  }
}
