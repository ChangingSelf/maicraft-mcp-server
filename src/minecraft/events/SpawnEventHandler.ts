import { BaseEventHandler } from './BaseEventHandler.js';
import { GameEventType } from '../GameEvent.js';
import { MinecraftUtils } from '../../utils/MinecraftUtils.js';

/**
 * 玩家生成事件处理器
 * 处理玩家首次登录和重生的事件
 * 注意：根据 mineflayer API 文档，'spawn' 事件在玩家首次登录和重生时都会触发
 */
export class SpawnEventHandler extends BaseEventHandler {
  register(): void {
    this.bot.on('spawn', () => {
      if (!this.isEventDisabled(GameEventType.SPAWN)) {
        this.addEvent(this.createEvent('spawn', {
          data: {
            player: MinecraftUtils.mapPlayer(this.bot!.player),
            entity: MinecraftUtils.mapEntity(this.bot!.entity)
          }
        }));
      }
    });
  }

  getEventType(): GameEventType {
    return GameEventType.SPAWN;
  }
}
