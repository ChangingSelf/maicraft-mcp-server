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

// 方块信息
export interface BlockInfo {
  type: number; // 方块类型 ID
  name: string; // 方块注册名称
  position: Position; // 方块所在坐标
  hardness?: number; // 方块硬度
  material?: string; // 方块材质
}

// 实体信息
export interface EntityInfo {
  id: number; // 实体唯一 ID
  type: string; // 实体类型字符串（例如 'player'、'zombie'）
  name?: string; // 实体显示名称
  position: Position; // 实体当前坐标
  health?: number; // 当前生命值
  maxHealth?: number; // 最大生命值
  equipment?: InventoryItem[]; // 装备物品列表
}

// 聊天消息信息
export interface ChatInfo {
  json: Record<string, unknown>; // 原始 JSON 聊天消息对象
  text: string; // 解析后的纯文本内容
  username?: string; // 发送者用户名（如果可用）
  translate?: string; // 原始语言键，用于国际化
  position?: number; // 0: 聊天, 1: 系统消息, 2: 快捷栏上方
}

// 基础物品信息（简化自 mineflayer 的 Item 定义）
export interface InventoryItem {
  type: number; // 物品类型 ID
  count: number; // 数量
  name: string; // 物品名称
  displayName?: string; // 显示名称
  nbtData?: Record<string, unknown>; // 额外 NBT 数据
}

// 游戏事件基础接口
export interface BaseGameEvent {
  type: string; // 事件类型标识
  timestamp: number; // 时间戳（毫秒）
  serverId: string; // 服务器唯一标识
  playerName: string; // 机器人在服务器中的名称
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

export interface MobSpawnEvent extends BaseGameEvent {
  type: 'mobSpawn';
  entity: EntityInfo; // 新生成的实体信息
}

export interface BlockBreakEvent extends BaseGameEvent {
  type: 'blockBreak';
  block: BlockInfo; // 被破坏的方块
  player?: PlayerInfo; // 触发破坏的玩家
}

export interface BlockPlaceEvent extends BaseGameEvent {
  type: 'blockPlace';
  block: BlockInfo; // 放置的方块
  player?: PlayerInfo; // 放置方块的玩家
}

export interface PlayerDeathEvent extends BaseGameEvent {
  type: 'playerDeath';
  player: PlayerInfo; // 死亡的玩家
  killer?: EntityInfo; // 凶手（可能为实体或玩家）
  deathMessage: string; // 死亡提示文本
}

export interface PlayerMoveEvent extends BaseGameEvent {
  type: 'playerMove';
  player: PlayerInfo; // 移动的玩家
  oldPosition: Position; // 原始位置
  newPosition: Position; // 新位置
}

export interface WeatherChangeEvent extends BaseGameEvent {
  type: 'weatherChange';
  weather: 'clear' | 'rain' | 'thunder'; // 天气类型
}

export interface HealthUpdateEvent extends BaseGameEvent {
  type: 'healthUpdate';
  health: number; // 当前生命值
  food: number; // 饱食度
  saturation: number; // 饱和度
}

export interface ExperienceUpdateEvent extends BaseGameEvent {
  type: 'experienceUpdate';
  experience: number; // 经验条进度（0-1）
  level: number; // 等级
}

// 联合类型，包含所有事件
export type GameEvent = 
  | ChatEvent
  | PlayerJoinEvent
  | PlayerLeaveEvent
  | MobSpawnEvent
  | BlockBreakEvent
  | BlockPlaceEvent
  | PlayerDeathEvent
  | PlayerMoveEvent
  | WeatherChangeEvent
  | HealthUpdateEvent
  | ExperienceUpdateEvent;

// 事件类型枚举
export enum GameEventType {
  CHAT = 'chat',
  PLAYER_JOIN = 'playerJoin',
  PLAYER_LEAVE = 'playerLeave',
  MOB_SPAWN = 'mobSpawn',
  BLOCK_BREAK = 'blockBreak',
  BLOCK_PLACE = 'blockPlace',
  PLAYER_DEATH = 'playerDeath',
  PLAYER_MOVE = 'playerMove',
  WEATHER_CHANGE = 'weatherChange',
  HEALTH_UPDATE = 'healthUpdate',
  EXPERIENCE_UPDATE = 'experienceUpdate'
}

// 事件监听器接口
export interface GameEventListener {
  (event: GameEvent): void | Promise<void>;
}

// 事件配置
export interface EventConfig {
  enabledEvents: GameEventType[]; // 要启用的事件类型列表
  playerMoveThreshold: number; // 触发 playerMove 事件的位移阈值
  maxEventHistory: number; // 本地缓存的事件历史最大条目数
} 