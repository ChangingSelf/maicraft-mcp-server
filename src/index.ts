/**
 * Maicraft - Minecraft × MaiBot 适配器
 * 
 * 主入口文件，导出核心功能模块
 */

// 核心模块
export { WebSocketClient } from './messaging/WebSocketClient.js';
export { Router } from './messaging/Router.js';

// 类型定义
export * from './messaging/MaimMessage.js';

// 工具类
export { Logger, LogLevel } from './utils/Logger.js';

// 版本信息
export const VERSION = '0.1.0';

console.log(`
🎮 Maicraft v${VERSION}
📦 Minecraft × MaiBot 适配器
🔗 基于 maim_message 协议的双向适配器
`);