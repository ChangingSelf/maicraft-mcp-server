import { BaseEventHandler } from './BaseEventHandler.js';
import { ChatEventHandler } from './ChatEventHandler.js';
import { PlayerJoinEventHandler } from './PlayerJoinEventHandler.js';
import { PlayerLeftEventHandler } from './PlayerLeftEventHandler.js';
import { DeathEventHandler } from './DeathEventHandler.js';
import { PlayerRespawnEventHandler } from './PlayerRespawnEventHandler.js';
import { WeatherChangeEventHandler } from './WeatherChangeEventHandler.js';
import { PlayerKickEventHandler } from './PlayerKickEventHandler.js';
import { SpawnPointResetEventHandler } from './SpawnPointResetEventHandler.js';
import { HealthEventHandler } from './HealthEventHandler.js';
import { EntityHurtEventHandler } from './EntityHurtEventHandler.js';
import { EntityDeathEventHandler } from './EntityDeathEventHandler.js';
import { PlayerCollectEventHandler } from './PlayerCollectEventHandler.js';

/**
 * 获取所有事件处理器类的构造函数
 * 用于运行时发现和注册事件处理器
 */
export function getAllEventHandlers(): (new (
  bot: any,
  isEventDisabled: (eventType: any) => boolean,
  addEvent: (event: any) => void,
  getCurrentGameTick: () => number,
  getCurrentTimestamp: () => number,
  ...args: any[]
) => BaseEventHandler)[] {
  return [
    ChatEventHandler,
    PlayerJoinEventHandler,
    PlayerLeftEventHandler,
    DeathEventHandler,
    PlayerRespawnEventHandler,
    WeatherChangeEventHandler,
    PlayerKickEventHandler,
    SpawnPointResetEventHandler,
    HealthEventHandler,
    EntityHurtEventHandler,
    EntityDeathEventHandler,
    PlayerCollectEventHandler
  ];
}

// 导出所有处理器类以供外部使用
export {
  ChatEventHandler,
  PlayerJoinEventHandler,
  PlayerLeftEventHandler as PlayerLeaveEventHandler,
  DeathEventHandler,
  PlayerRespawnEventHandler,
  WeatherChangeEventHandler,
  PlayerKickEventHandler,
  SpawnPointResetEventHandler,
  HealthEventHandler as HealthUpdateEventHandler,
  EntityHurtEventHandler,
  EntityDeathEventHandler,
  PlayerCollectEventHandler
};
