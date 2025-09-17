import { BaseEventHandler } from './BaseEventHandler.js';
import { GameEventType } from '../GameEvent.js';

/**
 * 实体受伤事件处理器
 * 处理实体受伤的事件
 */
export class EntityHurtEventHandler extends BaseEventHandler {
  register(): void {
    this.bot.on('entityHurt', (entity: any) => {
      if (!this.isEventDisabled(GameEventType.ENTITY_HURT)) {
        this.addEvent(this.createEvent('entityHurt', {
          entity: {
            id: entity.id,
            type: entity.name || 'unknown',
            name: entity.displayName?.toString(),
            position: {
              x: entity.position.x,
              y: entity.position.y,
              z: entity.position.z
            },
            health: entity.health,
            maxHealth: entity.health
          },
          damage: 0 // Mineflayer没有直接提供伤害值
        }));
      }
    });
  }

  getEventType(): GameEventType {
    return GameEventType.ENTITY_HURT;
  }
}
