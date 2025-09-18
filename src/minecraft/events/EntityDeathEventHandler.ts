import { BaseEventHandler } from './BaseEventHandler.js';
import { GameEventType } from '../GameEvent.js';
import { Entity } from 'prismarine-entity';

/**
 * 实体死亡事件处理器
 * 处理实体死亡的事件
 */
export class EntityDeathEventHandler extends BaseEventHandler {
  register(): void {
    this.bot.on('entityDead', (entity: Entity) => {
      if (!this.isEventDisabled(GameEventType.ENTITY_DEATH)) {
        this.addEvent(this.createEvent('entityDead', {
          data: {
            entity: {
              id: entity.id,
              uuid: entity.uuid,
              type: entity.type,
              name: entity.name,
              username: entity.username,
              count: entity.count,
              position: {
                x: Number(entity.position.x.toFixed(2)),
                y: Number(entity.position.y.toFixed(2)),
                z: Number(entity.position.z.toFixed(2))
              },
              health: entity.health,
              food: entity.food,
            }
          }
        }));
      }
    });
  }

  getEventType(): GameEventType {
    return GameEventType.ENTITY_DEATH;
  }
}
