import { BaseEventHandler } from './BaseEventHandler.js';
import { GameEventType } from '../GameEvent.js';
import { MinecraftUtils } from '../../utils/MinecraftUtils.js';

/**
 * 实体受伤事件处理器
 * 处理实体受伤的事件
 */
export class EntityHurtEventHandler extends BaseEventHandler {
  register(): void {
    this.bot.on('entityHurt', (entity: any) => {
      if (!this.isEventDisabled(GameEventType.ENTITY_HURT)) {
        const entityData = MinecraftUtils.mapEntity(entity);
        // 特殊处理：使用displayName作为名称，添加maxHealth字段
        entityData.name = entity.displayName?.toString() || entity.name;
        entityData.maxHealth = entity.health;
        entityData.position = {
          x: entity.position.x,
          y: entity.position.y,
          z: entity.position.z
        };

        this.addEvent(this.createEvent('entityHurt', {
          data: {
            entity: entityData,
            damage: 0 // 注意：mineflayer 的 entityHurt 事件不直接提供伤害值参数
          }
        }));
      }
    });
  }

  getEventType(): GameEventType {
    return GameEventType.ENTITY_HURT;
  }
}
