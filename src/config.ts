import type { LoggingConfig } from "./utils/Logger.js";
import { ViewerOptions } from "./minecraft/ViewerManager.js";

export interface MinecraftConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  auth: "offline" | "microsoft" | "mojang";
  version?: string;
}

export interface ScreenshotConfig extends Partial<ViewerOptions> {
  enabled: boolean;
}

export interface DebugCommandsConfig {
  enabled: boolean;
  adminPlayers: string[];
  chatFeedback?: boolean;
}

export interface ChatFiltersConfig {
  // 玩家黑名单：不接收这些玩家的消息
  blockedPlayers?: string[];
  // 消息黑名单：不接收匹配这些正则表达式的消息
  blockedMessagePatterns?: string[];
  // 是否启用聊天过滤
  enabled?: boolean;
}

export interface WebSocketConfig {
  enabled?: boolean;
  port?: number;
  host?: string;
}

export interface ClientConfig {
  minecraft: MinecraftConfig;
  enabledEvents?: string[];
  maxMessageHistory?: number;
  logging?: LoggingConfig;
  // 不能破坏的方块列表配置
  blocksCantBreak?: string[];
  // 截图功能配置
  screenshot?: ScreenshotConfig;
  // 调试命令系统配置
  debugCommands?: DebugCommandsConfig;
  // 玩家黑名单和消息黑名单配置
  chatFilters?: ChatFiltersConfig;
  // WebSocket日志服务器配置
  websocket?: WebSocketConfig;
  // Optional MCP-specific block; kept here to simplify typing in main
  mcp?: {
    name?: string;
    version?: string;
    tools?: { enabled?: string[]; disabled?: string[] };
  };
}


