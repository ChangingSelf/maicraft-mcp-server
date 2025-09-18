import { BaseEventHandler } from './BaseEventHandler.js';
import { GameEventType } from '../GameEvent.js';
import { MinecraftUtils } from '../../utils/MinecraftUtils.js';

/**
 * 玩家生成事件处理器
 * 处理玩家首次登录和重生的事件
 * 注意：根据 mineflayer API 文档，'spawn' 事件在玩家首次登录和重生时都会触发
 */
export class PlayerRespawnEventHandler extends BaseEventHandler {
  register(): void {
    this.bot.on('spawn', () => {
      if (!this.isEventDisabled(GameEventType.PLAYER_RESPAWN)) {
        this.addEvent(this.createEvent('spawn', {
          data: {
            player: MinecraftUtils.mapPlayer(this.bot!.player),
            position: {
              x: this.bot!.entity.position.x,
              y: this.bot!.entity.position.y,
              z: this.bot!.entity.position.z
            }
          }
        }));
      }
    });
  }

  getEventType(): GameEventType {
    return GameEventType.PLAYER_RESPAWN;
  }
}
