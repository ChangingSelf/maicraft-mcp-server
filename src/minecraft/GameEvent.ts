/**
 * Minecraft 游戏事件类型定义
 * 基于 mineflayer 事件系统
 */

// 玩家位置信息
export interface Position {
  x: number; // x 坐标
  y: number; // y 坐标
  z: number; // z 坐标
}

// 玩家信息
export interface PlayerInfo {
  uuid: string; // 玩家唯一 UUID
  username: string; // 玩家用户名
  displayName?: string; // 玩家显示名称（可能包含颜色/格式）
  ping?: number; // 网络延迟（毫秒）
  gamemode?: number; // 游戏模式 ID（0: 生存, 1: 创造, 2: 冒险, 3: 旁观）
}

// 实体信息
export interface EntityInfo {
  id: number; // 实体唯一 ID
  type: string; // 实体类型字符串（例如 'player'、'zombie'）
  name?: string; // 实体显示名称
  username?: string; // 玩家用户名
  position: Position; // 实体当前坐标
  health?: number; // 当前生命值
  maxHealth?: number; // 最大生命值
}

// 聊天消息信息
export interface ChatInfo {
  username: string; // 发送消息的玩家用户名
  message: string; // 去除颜色和控制字符的消息内容
  translate?: string | null; // 聊天消息类型，对于大多数bukkit聊天消息为null
  jsonMsg?: any; // 服务器发送的未修改的JSON消息
  matches?: any; // 正则表达式匹配结果数组，可能为null
}

// 物品信息
export interface ItemInfo {
  id: number; // 物品ID
  name: string; // 物品名称
  displayName?: string; // 显示名称
  count: number; // 物品数量
  metadata?: number; // 元数据
}

// 游戏事件基础接口
export interface BaseGameEvent {
  type: string; // 事件类型标识
  gameTick: number; // 游戏刻（世界年龄）
  timestamp: number; // 真实世界时间戳（毫秒）
}

// 具体事件类型
export interface ChatEvent extends BaseGameEvent {
  type: 'chat';
  data: ChatInfo; // 聊天详细信息
}

export interface PlayerJoinEvent extends BaseGameEvent {
  type: 'playerJoined';
  data: PlayerInfo; // 加入的玩家信息
}

export interface PlayerLeaveEvent extends BaseGameEvent {
  type: 'playerLeft';
  data: PlayerInfo; // 离开的玩家信息
}

export interface PlayerDeathEvent extends BaseGameEvent {
  type: 'death';
  data: {
    player: PlayerInfo; // 死亡的玩家
    killer?: EntityInfo; // 凶手（可能为实体或玩家）
  };
  // 注意：根据 mineflayer API 文档，death 事件不提供死亡消息参数
}

export interface PlayerRespawnEvent extends BaseGameEvent {
  type: 'spawn';
  data: {
    player: PlayerInfo; // 生成/重生的玩家
    position: Position; // 生成/重生位置
  };
  // 注意：根据 mineflayer API 文档，此事件在玩家首次登录和重生时都会触发
}

export interface WeatherChangeEvent extends BaseGameEvent {
  type: 'rain';
  data: {
    weather: 'clear' | 'rain' | 'thunder'; // 天气类型
  };
  // 注意：根据 mineflayer API 文档，'rain' 事件在天气开始或停止下雨时触发
}

export interface PlayerKickEvent extends BaseGameEvent {
  type: 'kicked';
  data: {
    player: PlayerInfo; // 被踢出的玩家
    reason: string; // 踢出原因
  };
}

export interface SpawnPointResetEvent extends BaseGameEvent {
  type: 'spawnReset';
  data: Position; // 新的重生点位置
}

export interface HealthUpdateEvent extends BaseGameEvent {
  type: 'health';
  data: {
    health: number; // 当前生命值
    food: number; // 饱食度
    saturation: number; // 饱和度
  };
}

export interface EntityHurtEvent extends BaseGameEvent {
  type: 'entityHurt';
  data: {
    entity: EntityInfo; // 受伤的实体
    damage: number; // 伤害值
    attacker?: EntityInfo; // 攻击者
  };
}

export interface EntityDeathEvent extends BaseGameEvent {
  type: 'entityDead';
  data: {
    entity: EntityInfo; // 死亡的实体
    killer?: EntityInfo; // 凶手
  };
}

export interface PlayerCollectEvent extends BaseGameEvent {
  type: 'playerCollect';
  data: {
    collector: EntityInfo; // 收集物品的玩家实体
    collected: ItemInfo[]; // 被收集的物品实体
  };
}

// 联合类型，包含所有事件
export type GameEvent =
  | ChatEvent
  | PlayerJoinEvent
  | PlayerLeaveEvent
  | PlayerDeathEvent
  | PlayerRespawnEvent
  | WeatherChangeEvent
  | PlayerKickEvent
  | SpawnPointResetEvent
  | HealthUpdateEvent
  | EntityHurtEvent
  | EntityDeathEvent
  | PlayerCollectEvent;

// 事件类型枚举 - 与 mineflayer 事件名保持一致
export enum GameEventType {
  CHAT = 'chat',
  PLAYER_JOIN = 'playerJoined',
  PLAYER_LEAVE = 'playerLeft',
  PLAYER_DEATH = 'death',
  PLAYER_RESPAWN = 'spawn',
  WEATHER_CHANGE = 'rain',
  PLAYER_KICK = 'kicked',
  SPAWN_POINT_RESET = 'spawnReset',
  HEALTH_UPDATE = 'health',
  ENTITY_HURT = 'entityHurt',
  ENTITY_DEATH = 'entityDead',
  PLAYER_COLLECT = 'playerCollect'
}

// 事件监听器接口
export interface GameEventListener {
  (event: GameEvent): void | Promise<void>;
}

// 事件配置
export interface EventConfig {
  disabledEvents: GameEventType[]; // 要禁用的事件类型列表（黑名单机制）
  maxEventHistory: number; // 本地缓存的事件历史最大条目数
} 