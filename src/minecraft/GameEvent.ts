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
  text: string; // 解析后的纯文本内容
  username?: string; // 发送者用户名（如果可用）
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
  chatInfo: ChatInfo; // 聊天详细信息
}

export interface PlayerJoinEvent extends BaseGameEvent {
  type: 'playerJoin';
  playerInfo: PlayerInfo; // 加入的玩家信息
}

export interface PlayerLeaveEvent extends BaseGameEvent {
  type: 'playerLeave';
  playerInfo: PlayerInfo; // 离开的玩家信息
}

export interface PlayerDeathEvent extends BaseGameEvent {
  type: 'playerDeath';
  player: PlayerInfo; // 死亡的玩家
  killer?: EntityInfo; // 凶手（可能为实体或玩家）
  deathMessage: string; // 死亡提示文本
}

export interface PlayerRespawnEvent extends BaseGameEvent {
  type: 'playerRespawn';
  player: PlayerInfo; // 重生的玩家
  position: Position; // 重生位置
}

export interface WeatherChangeEvent extends BaseGameEvent {
  type: 'weatherChange';
  weather: 'clear' | 'rain' | 'thunder'; // 天气类型
}

export interface PlayerKickEvent extends BaseGameEvent {
  type: 'playerKick';
  player: PlayerInfo; // 被踢出的玩家
  reason: string; // 踢出原因
}

export interface SpawnPointResetEvent extends BaseGameEvent {
  type: 'spawnPointReset';
  position: Position; // 新的重生点位置
}

export interface HealthUpdateEvent extends BaseGameEvent {
  type: 'healthUpdate';
  health: number; // 当前生命值
  food: number; // 饱食度
  saturation: number; // 饱和度
}

export interface EntityHurtEvent extends BaseGameEvent {
  type: 'entityHurt';
  entity: EntityInfo; // 受伤的实体
  damage: number; // 伤害值
  attacker?: EntityInfo; // 攻击者
}

export interface EntityDeathEvent extends BaseGameEvent {
  type: 'entityDeath';
  entity: EntityInfo; // 死亡的实体
  killer?: EntityInfo; // 凶手
}

export interface PlayerCollectEvent extends BaseGameEvent {
  type: 'playerCollect';
  collector: EntityInfo; // 收集物品的玩家实体
  collected: ItemInfo[]; // 被收集的物品实体
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

// 事件类型枚举
export enum GameEventType {
  CHAT = 'chat',
  PLAYER_JOIN = 'playerJoin',
  PLAYER_LEAVE = 'playerLeave',
  PLAYER_DEATH = 'playerDeath',
  PLAYER_RESPAWN = 'playerRespawn',
  WEATHER_CHANGE = 'weatherChange',
  PLAYER_KICK = 'playerKick',
  SPAWN_POINT_RESET = 'spawnPointReset',
  HEALTH_UPDATE = 'healthUpdate',
  ENTITY_HURT = 'entityHurt',
  ENTITY_DEATH = 'entityDeath',
  PLAYER_COLLECT = 'playerCollect'
}

// 事件监听器接口
export interface GameEventListener {
  (event: GameEvent): void | Promise<void>;
}

// 事件配置
export interface EventConfig {
  enabledEvents: GameEventType[]; // 要启用的事件类型列表
  maxEventHistory: number; // 本地缓存的事件历史最大条目数
} 