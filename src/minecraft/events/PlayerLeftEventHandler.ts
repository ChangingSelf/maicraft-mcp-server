import { BaseEventHandler } from './BaseEventHandler.js';
import { GameEventType } from '../GameEvent.js';
import { MinecraftUtils } from '../../utils/MinecraftUtils.js';
import { Player } from 'mineflayer';

/**
 * 玩家离开事件处理器
 * 处理玩家离开服务器的事件
 */
export class PlayerLeftEventHandler extends BaseEventHandler {
  register(): void {
    this.bot.on('playerLeft', (player: Player) => {
      if (!this.isEventDisabled(GameEventType.PLAYER_LEFT)) {
        this.addEvent(this.createEvent('playerLeft', {
          data: {
            player: MinecraftUtils.mapPlayer(player)
          }
        }));
      }
    });
  }

  getEventType(): GameEventType {
    return GameEventType.PLAYER_LEFT;
  }
}
