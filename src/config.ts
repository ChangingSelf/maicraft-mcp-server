import type { LoggingConfig } from "./utils/Logger.js";

export interface MinecraftConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  auth: "offline" | "microsoft" | "mojang";
  version?: string;
}

export interface ClientConfig {
  minecraft: MinecraftConfig;
  enabledEvents?: string[];
  maxMessageHistory?: number;
  logging?: LoggingConfig;
  // 不能破坏的方块列表配置
  blocksCantBreak?: string[];
  // Optional MCP-specific block; kept here to simplify typing in main
  mcp?: {
    name?: string;
    version?: string;
    tools?: { enabled?: string[]; disabled?: string[] };
  };
}


