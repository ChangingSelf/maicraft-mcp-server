import { BaseEventHandler } from './BaseEventHandler.js';
import { GameEventType } from '../GameEvent.js';

/**
 * 实体死亡事件处理器
 * 处理实体死亡的事件
 */
export class EntityDeathEventHandler extends BaseEventHandler {
  register(): void {
    this.bot.on('entityDead', (entity: any) => {
      if (!this.isEventDisabled(GameEventType.ENTITY_DEATH)) {
        this.addEvent(this.createEvent('entityDead', {
          entity: {
            id: entity.id,
            type: entity.name || 'unknown',
            name: entity.displayName?.toString(),
            position: {
              x: entity.position.x,
              y: entity.position.y,
              z: entity.position.z
            },
            health: 0,
            maxHealth: entity.health
          }
        }));
      }
    });
  }

  getEventType(): GameEventType {
    return GameEventType.ENTITY_DEATH;
  }
}
