import { BaseEventHandler } from './BaseEventHandler.js';
import { GameEventType } from '../GameEvent.js';
import { MinecraftUtils } from '../../utils/MinecraftUtils.js';
import { Entity } from 'prismarine-entity';

/**
 * 实体受伤事件处理器
 * 处理实体受伤的事件
 */
export class EntityHurtEventHandler extends BaseEventHandler {
  register(): void {
    this.bot.on('entityHurt', (entity: Entity) => {
      if (!this.isEventDisabled(GameEventType.ENTITY_HURT)) {
        this.addEvent(this.createEvent('entityHurt', {
          data: {
            entity: MinecraftUtils.mapEntity(entity),
          }
        }));
      }
    });
  }

  getEventType(): GameEventType {
    return GameEventType.ENTITY_HURT;
  }
}
