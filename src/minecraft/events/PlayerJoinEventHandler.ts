import { BaseEventHandler } from './BaseEventHandler.js';
import { GameEventType } from '../GameEvent.js';
import { Player } from 'mineflayer';
import { MinecraftUtils } from '../../utils/MinecraftUtils.js';

/**
 * 玩家加入事件处理器
 * 处理玩家加入服务器的事件
 */
export class PlayerJoinEventHandler extends BaseEventHandler {
  register(): void {
    this.bot.on('playerJoined', (player: Player) => {
      if (!this.isEventDisabled(GameEventType.PLAYER_JOIN)) {
        this.addEvent(this.createEvent('playerJoined', {
          data: {
            player: MinecraftUtils.mapPlayer(player)
          }
        }));
      }
    });
  }

  getEventType(): GameEventType {
    return GameEventType.PLAYER_JOIN;
  }
}
