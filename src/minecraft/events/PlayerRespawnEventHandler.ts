import { BaseEventHandler } from './BaseEventHandler.js';
import { GameEventType } from '../GameEvent.js';

/**
 * 玩家重生事件处理器
 * 处理玩家重生的事件
 */
export class PlayerRespawnEventHandler extends BaseEventHandler {
  register(): void {
    this.bot.on('spawn', () => {
      if (!this.isEventDisabled(GameEventType.PLAYER_RESPAWN)) {
        this.addEvent(this.createEvent('spawn', {
          player: {
            uuid: this.bot!.player.uuid,
            username: this.bot!.player.username,
            displayName: this.bot!.player.displayName?.toString(),
            ping: this.bot!.player.ping,
            gamemode: this.bot!.player.gamemode
          },
          position: {
            x: this.bot!.entity.position.x,
            y: this.bot!.entity.position.y,
            z: this.bot!.entity.position.z
          }
        }));
      }
    });
  }

  getEventType(): GameEventType {
    return GameEventType.PLAYER_RESPAWN;
  }
}
