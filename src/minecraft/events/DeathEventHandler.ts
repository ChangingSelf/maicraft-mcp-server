import { BaseEventHandler } from './BaseEventHandler.js';
import { GameEventType } from '../GameEvent.js';
import { MinecraftUtils } from '../../utils/MinecraftUtils.js';

/**
 * 玩家死亡事件处理器
 * 处理玩家死亡的事件
 */
export class DeathEventHandler extends BaseEventHandler {
  register(): void {
    this.bot.on('death', () => {
      if (!this.isEventDisabled(GameEventType.DEATH)) {
        this.addEvent(this.createEvent('death', {
          data: {
            entity: MinecraftUtils.mapEntity(this.bot!.entity),
          }
          // 根据 mineflayer API 文档，death 事件不提供死亡消息参数
        }));
      }
    });
  }

  getEventType(): GameEventType {
    return GameEventType.DEATH;
  }
}
