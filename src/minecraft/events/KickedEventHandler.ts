import { BaseEventHandler } from './BaseEventHandler.js';
import { GameEventType } from '../GameEvent.js';
import { MinecraftUtils } from '../../utils/MinecraftUtils.js';

/**
 * 玩家踢出事件处理器
 * 处理玩家被服务器踢出的事件
 * 当机器人被服务器踢出时触发。 reason 是一个聊天消息，解释你被踢的原因。 loggedIn 如果客户端在成功登录后被踢出，则为 true，如果在登录阶段被踢出，则为 false。
 */
export class KickedEventHandler extends BaseEventHandler {
  register(): void {
    this.bot.on('kicked', (reason: string, loggedIn: boolean) => {
      if (!this.isEventDisabled(GameEventType.KICKED)) {
        this.addEvent(this.createEvent('kicked', {
          data: {
            player: MinecraftUtils.mapPlayer(this.bot!.player),
            reason: reason,
            loggedIn: loggedIn
          }
        }));
      }
    });
  }

  getEventType(): GameEventType {
    return GameEventType.KICKED;
  }
}
