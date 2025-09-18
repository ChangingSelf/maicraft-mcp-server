import { BaseEventHandler } from './BaseEventHandler.js';
import { GameEventType } from '../GameEvent.js';
import { Entity } from 'prismarine-entity';
import { MinecraftUtils } from '../../utils/MinecraftUtils.js';

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
            entity: MinecraftUtils.mapEntity(entity)
          }
        }));
      }
    });
  }

  getEventType(): GameEventType {
    return GameEventType.ENTITY_DEATH;
  }
}
