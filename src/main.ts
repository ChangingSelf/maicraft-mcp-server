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
import { Logger } from './utils/Logger.js';

// 在最开始设置 MCP_STDIO_MODE，确保后续创建的 Logger 默认走 stderr，避免污染 MCP stdout
if (!process.env.MCP_STDIO_MODE) {
  process.env.MCP_STDIO_MODE = '1';
}

const logger = new Logger('Maicraft', { useStderr: true });

// 在 MCP stdio 模式下，强制将所有 console.* 输出重定向到 stderr，避免污染 stdout
if (process.env.MCP_STDIO_MODE === '1') {
  // 保留原始方法以便调试需要
  const origError = console.error.bind(console);
  const toStderr = (...args: unknown[]) => origError(...args);
  console.log = toStderr as any;
  console.info = toStderr as any;
  console.debug = toStderr as any;
  console.warn = toStderr as any;
}

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
      logger.error('仅支持 YAML 格式的配置文件（.yaml / .yml）');
      process.exit(1);
    }
    return abs;
  }

  const cwd = process.cwd();
  const yamlPath = resolve(cwd, 'config.yaml');
  const ymlPath = resolve(cwd, 'config.yml');

  if (fs.existsSync(yamlPath)) return yamlPath;
  if (fs.existsSync(ymlPath)) return ymlPath;

  logger.error('未找到配置文件，请在当前目录提供 config.yaml 或 config.yml');
  process.exit(1);
}

async function main() {
  // 添加全局错误处理
  process.on('uncaughtException', (error) => {
    logger.error('未捕获的异常:', error);
    // 不退出程序，让程序继续运行
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('未处理的 Promise 拒绝:', reason);
    // 不退出程序，让程序继续运行
  });

  /**
   * 读取配置文件
   */
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    logger.error(`配置文件不存在: ${configPath}`);
    process.exit(1);
  }

  let config: ClientConfig & { mcp?: { enabled?: boolean; name?: string; version?: string; auth?: { token?: string; enabled?: boolean }, tools?: { enabled?: string[] } } };
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    config = yamlLoad(raw) as ClientConfig;
  } catch (err) {
    logger.error('读取或解析配置文件失败:', err);
    process.exit(1);
  }

  /**
   * 创建客户端
   */
  const client = new MaicraftClient(config);

  // Reuse components from MaicraftClient to keep single source of truth
  const minecraftClient = client.getMinecraftClient();
  const stateManager = client.getStateManager();
  const actionExecutor = client.getActionExecutor();

  // Optionally start MCP server (stdio)
  let mcpServer: any = null;
  if (config.mcp?.enabled) {
    // dynamic import inside function to avoid top-level await and casing issues
    try {
      // Signal logger to use stderr to avoid corrupting MCP stdout
      process.env.MCP_STDIO_MODE = '1';
      const mod = await import('./mcp/MaicraftMcpServer.js');
      const { MaicraftMcpServer } = mod as any;
      mcpServer = new MaicraftMcpServer({
      minecraftClient,
      stateManager,
      actionExecutor,
      config: {
        name: config.mcp.name || 'Maicraft MCP',
        version: config.mcp.version || '0.1.0',
        auth: config.mcp.auth,
        tools: config.mcp.tools,
      },
      });
    } catch (e: unknown) {
      logger.error('加载 MCP 模块失败:', e as Error);
    }
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
  logger.error('未知错误:', err);
  process.exit(1);
});