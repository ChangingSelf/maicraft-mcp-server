#!/usr/bin/env node
/**
 * Maicraft 主入口（main.ts）
 * 
 * 用法：
 *   maicraft <configPath>
 *   # 或
 *   pnpm run dev -- <configPath>
 * 
 * 默认读取根目录下的 config.json
 */

import fs from 'fs';
import { resolve, extname } from 'path';
import { load as yamlLoad } from 'js-yaml';

import { MaicraftClient, ClientConfig } from './MaicraftClient.js';
import { Logger, LoggingConfig } from './utils/Logger.js';
import { MaicraftMcpServer } from './mcp/MaicraftMcpServer.js';

// 设置MCP stdio模式，重定向全局console输出到stderr
Logger.setupMcpMode();

// 临时日志器，用于配置加载阶段
const tempLogger = new Logger('Maicraft', { useStderr: true });

/** 获取配置文件路径
 * 1. 如果用户传入路径，则使用该路径。
 * 2. 否则依次尝试 config.yaml → config.yml → config.json。
 */
function getConfigPath(): string {
  const userPath = process.argv[2];
  if (userPath) {
    const abs = resolve(process.cwd(), userPath);
    const ext = extname(abs).toLowerCase();
    if (ext !== '.yaml' && ext !== '.yml') {
      tempLogger.error('仅支持 YAML 格式的配置文件（.yaml / .yml）');
      process.exit(1);
    }
    return abs;
  }

  const cwd = process.cwd();
  const yamlPath = resolve(cwd, 'config.yaml');
  const ymlPath = resolve(cwd, 'config.yml');

  if (fs.existsSync(yamlPath)) return yamlPath;
  if (fs.existsSync(ymlPath)) return ymlPath;

  tempLogger.error('未找到配置文件，请在当前目录提供 config.yaml 或 config.yml');
  process.exit(1);
}

async function main() {
  // 添加全局错误处理
  process.on('uncaughtException', (error) => {
    tempLogger.error('未捕获的异常:', error);
    // 不退出程序，让程序继续运行
  });

  process.on('unhandledRejection', (reason, promise) => {
    tempLogger.error('未处理的 Promise 拒绝:', reason);
    // 不退出程序，让程序继续运行
  });

  /**
   * 读取配置文件
   */
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    tempLogger.error(`配置文件不存在: ${configPath}`);
    process.exit(1);
  }

  let config: ClientConfig & { 
    mcp?: { 
      name?: string; 
      version?: string; 
      auth?: { token?: string; enabled?: boolean }, 
      tools?: { enabled?: string[] } 
    },
    logging?: LoggingConfig
  };
  
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    config = yamlLoad(raw) as ClientConfig;
  } catch (err) {
    tempLogger.error('读取或解析配置文件失败:', err);
    process.exit(1);
  }

  // 创建正式的日志器
  const logger = Logger.fromConfig('Maicraft', config.logging || {});

  /**
   * 创建客户端
   */
  const client = new MaicraftClient(config);

  // 重用 MaicraftClient 的组件保持单一来源
  const minecraftClient = client.getMinecraftClient();
  const stateManager = client.getStateManager();
  const actionExecutor = client.getActionExecutor();

  // 启动 MCP server (stdio)
  let mcpServer: MaicraftMcpServer | null = null;
  try {
    mcpServer = new MaicraftMcpServer({
      minecraftClient,
      stateManager,
      actionExecutor,
      config: {
        name: config.mcp?.name || 'Maicraft MCP',
        version: config.mcp?.version || '0.1.0',
        auth: config.mcp?.auth,
        tools: config.mcp?.tools,
      },
    });
  } catch (e: unknown) {
    logger.error('创建 MCP 服务器失败:', e as Error);
  }

  // 退出时停止客户端
  process.on('SIGINT', async () => {
    logger.info('收到 SIGINT，正在停止客户端...');
    await client.stop();
    process.exit(0);
  });

  /**
   * 启动客户端
   */
  try {
    await client.start();
    logger.info('Maicraft 客户端已启动，按 Ctrl+C 退出。');
    logger.info(`日志文件位置: ${logger.getLogFilePath()}`);
    
    // 启动 MCP Server（独立于 Minecraft 连接）
    if (mcpServer) {
      logger.info('正在启动 MCP Server...');
      try {
        await mcpServer.startOnStdio();
        logger.info('MCP Server 已启动');
      } catch (e: unknown) {
        logger.error('启动 MCP 失败:', e);
      }
    }
  } catch (err) {
    logger.error('启动客户端失败:', err);
    process.exit(1);
  }
}

main().catch((err) => {
  tempLogger.error('未知错误:', err);
  process.exit(1);
});