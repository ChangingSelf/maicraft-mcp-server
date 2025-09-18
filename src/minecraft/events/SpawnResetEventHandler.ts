import { BaseEventHandler } from './BaseEventHandler.js';
import { GameEventType } from '../GameEvent.js';
import { MinecraftUtils } from '../../utils/MinecraftUtils.js';

/**
 * 重生点重置事件处理器
 * 处理重生点重置的事件
 */
export class SpawnResetEventHandler extends BaseEventHandler {
  register(): void {
    this.bot.on('spawnReset', () => {
      if (!this.isEventDisabled(GameEventType.SPAWN_RESET)) {
        this.addEvent(this.createEvent('spawnReset', {
          data: {
            newSpawnPoint: {
              x: Number(this.bot!.spawnPoint.x.toFixed(0)),
              y: Number(this.bot!.spawnPoint.y.toFixed(0)),
              z: Number(this.bot!.spawnPoint.z.toFixed(0))
            }
          }
        }));
      }
    });
  }

  getEventType(): GameEventType {
    return GameEventType.SPAWN_RESET;
  }
}
