#!/usr/bin/env node
/**
 * Maicraft 主入口（main.ts）
 * 
 * 用法：
 *   maicraft <configPath>
 *   maicraft --init-config
 *   # 或
 *   pnpm run dev -- <configPath>
 *
 * 默认读取根目录下的 config.yaml / config.yml（仅支持 YAML）
 */

import fs from 'fs';
import { resolve, extname, dirname } from 'path';
import { fileURLToPath } from 'url';
import { load as yamlLoad } from 'js-yaml';

import { Logger, LoggingConfig } from './utils/Logger.js';
import { MaicraftMcpServer } from './mcp/MaicraftMcpServer.js';
import { ClientConfig } from './config.js';
import { MinecraftClient } from './minecraft/MinecraftClient.js';
import { ActionExecutor } from './minecraft/ActionExecutor.js';
import { GameEvent } from './minecraft/GameEvent.js';
// ViewerManager 动态导入，避免不必要的依赖加载
// 动作由 ActionExecutor 自动发现与注册，无需在此显式导入

// 设置MCP stdio模式，重定向全局console输出到stderr
Logger.setupMcpMode();

// 临时日志器，用于配置加载阶段
const tempLogger = new Logger('Maicraft', { useStderr: true });

// 兼容 ESM 的 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 初始化 ViewerManager
 * @param minecraftClient Minecraft 客户端实例
 * @param config 客户端配置
 */
async function initializeViewerManager(minecraftClient: MinecraftClient, config: ClientConfig): Promise<void> {
  const screenshotConfig = config.screenshot;
  if (!screenshotConfig || !screenshotConfig.enabled) {
    return;
  }

  const bot = minecraftClient.getBot();
  if (!bot) {
    throw new Error('Minecraft 客户端未连接，无法初始化 ViewerManager');
  }

  try {
    // 动态导入 ViewerManager，避免不必要的依赖加载
    const viewerModule = await import('./minecraft/ViewerManager.js');
    const { ViewerManager } = viewerModule;

    // 创建 ViewerManager 配置选项
    const viewerOptions = {
      viewDistance: screenshotConfig.viewDistance || 12,
      width: screenshotConfig.width || 1920,
      height: screenshotConfig.height || 1080,
      jpgQuality: screenshotConfig.jpgQuality || 95,
      loadWaitTime: screenshotConfig.loadWaitTime || 2000,
      renderLoops: screenshotConfig.renderLoops || 10,
    };

    const viewerManager = new ViewerManager(viewerOptions);
    await viewerManager.initialize(bot);

    // 将 ViewerManager 设置到 MinecraftClient 中
    minecraftClient.setViewerManager(viewerManager);

    console.log('ViewerManager 初始化成功');
  } catch (error) {
    console.error('ViewerManager 初始化失败:', error);
    throw error;
  }
}

/** 初始化配置文件 */
function initConfig() {
  const templatePath = resolve(__dirname, '../config-template.yaml');
  const targetPath = resolve(process.cwd(), 'config.yaml');
  
  if (!fs.existsSync(templatePath)) {
    tempLogger.error('配置文件模板不存在');
    process.exit(1);
  }
  
  if (fs.existsSync(targetPath)) {
    tempLogger.warn('config.yaml 已存在，跳过初始化');
    return;
  }
  
  try {
    const template = fs.readFileSync(templatePath, 'utf8');
    fs.writeFileSync(targetPath, template);
    tempLogger.info(`配置文件已创建: ${targetPath}`);
  } catch (error) {
    tempLogger.error('创建配置文件失败:', error);
    process.exit(1);
  }
}

interface CliArgs {
  initConfig: boolean;
  configPath?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  auth?: 'offline' | 'microsoft' | 'mojang';
  version?: string;
  logLevel?: string;
  mcpName?: string;
  mcpVersion?: string;
  toolsEnabled?: string[];
  toolsDisabled?: string[];
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { initConfig: false };
  const tokens = [...argv];
  if (tokens.includes('--init-config')) args.initConfig = true;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const next = tokens[i + 1];
    if (t === '--config' && next) { args.configPath = resolve(process.cwd(), next); i++; continue; }
    if (t === '--host' && next) { args.host = next; i++; continue; }
    if (t === '--port' && next) { const p = Number(next); if (!Number.isNaN(p)) args.port = p; i++; continue; }
    if (t === '--username' && next) { args.username = next; i++; continue; }
    if (t === '--password' && next) { args.password = next; i++; continue; }
    if (t === '--auth' && next) { if (['offline','microsoft','mojang'].includes(next)) args.auth = next as any; i++; continue; }
    if (t === '--version' && next) { args.version = next; i++; continue; }
    if (t === '--log-level' && next) { args.logLevel = next; i++; continue; }
    if (t === '--mcp-name' && next) { args.mcpName = next; i++; continue; }
    if (t === '--mcp-version' && next) { args.mcpVersion = next; i++; continue; }
    if (t === '--tools-enabled' && next) { args.toolsEnabled = next.split(',').map(s=>s.trim()).filter(Boolean); i++; continue; }
    if (t === '--tools-disabled' && next) { args.toolsDisabled = next.split(',').map(s=>s.trim()).filter(Boolean); i++; continue; }
  }
  // 兼容第一个位置参数作为 config 路径
  if (!args.configPath && tokens[0] && !tokens[0].startsWith('-')) {
    const abs = resolve(process.cwd(), tokens[0]);
    const ext = extname(abs).toLowerCase();
    if (ext === '.yaml' || ext === '.yml') args.configPath = abs;
  }
  return args;
}

function getConfigPath(cli: CliArgs): string | undefined {
  if (cli.configPath) return cli.configPath;
  const cwd = process.cwd();
  const yamlPath = resolve(cwd, 'config.yaml');
  const ymlPath = resolve(cwd, 'config.yml');
  if (fs.existsSync(yamlPath)) return yamlPath;
  if (fs.existsSync(ymlPath)) return ymlPath;
  return undefined;
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

  const args = parseArgs(process.argv.slice(2));
  if (args.initConfig) { initConfig(); process.exit(0); }

  let config: ClientConfig;
  const configPath = getConfigPath(args);
  if (!configPath) {
    // 无配置文件时，尝试从 CLI 参数构建最小可运行配置
    const missing: string[] = [];
    if (!args.host) missing.push('--host');
    if (typeof args.port !== 'number') missing.push('--port');
    if (!args.username) missing.push('--username');
    if (missing.length > 0) {
      tempLogger.warn('未找到配置文件，将尝试使用命令行参数运行。');
      tempLogger.error(`缺少必要参数: ${missing.join(', ')}`);
      tempLogger.error('示例: npx -y maicraft --host 127.0.0.1 --port 25565 --username BotName');
      process.exit(1);
    }
    config = {
      minecraft: {
        host: args.host!,
        port: args.port!,
        username: args.username!,
        password: args.password,
        auth: args.auth || 'offline',
        version: args.version,
      },
      // 默认不限制事件、工具：保持空配置，由下游使用默认值放开
      logging: { useStderr: true },
      mcp: {},
    } as ClientConfig;
  } else {
    try {
      const raw = fs.readFileSync(configPath, 'utf8');
      config = yamlLoad(raw) as ClientConfig;
    } catch (err) {
      tempLogger.error('读取或解析配置文件失败:', err);
      process.exit(1);
    }
  }

  if (args.host) config.minecraft.host = args.host;
  if (typeof args.port === 'number') config.minecraft.port = args.port;
  if (args.username) config.minecraft.username = args.username;
  if (args.password) config.minecraft.password = args.password;
  if (args.auth) config.minecraft.auth = args.auth;
  if (args.version) config.minecraft.version = args.version;
  if (args.logLevel) {
    config.logging = { ...(config.logging || {}), level: args.logLevel } as any;
  }
  if (args.mcpName || args.mcpVersion || args.toolsEnabled || args.toolsDisabled) {
    config.mcp = config.mcp || {};
    if (args.mcpName) config.mcp.name = args.mcpName;
    if (args.mcpVersion) config.mcp.version = args.mcpVersion;
    if (args.toolsEnabled || args.toolsDisabled) {
      const tools = config.mcp.tools || {};
      if (args.toolsEnabled) tools.enabled = args.toolsEnabled;
      if (args.toolsDisabled) tools.disabled = args.toolsDisabled;
      config.mcp.tools = tools;
    }
  }

  // 创建正式的日志器
  const logger = Logger.fromConfig('Maicraft', config.logging || {});

  // 构建核心组件
  const minecraftClient = new MinecraftClient({
    ...config.minecraft,
    logging: config.logging,
    blocksCantBreak: config.blocksCantBreak,
  });
  const actionExecutor = new ActionExecutor();

  // 自动发现并注册动作 + 工具说明
  try {
    const tools = await actionExecutor.discoverAndRegisterActions();
    const actionNames = actionExecutor.getRegisteredActions();
    logger.info(`已自动发现并注册动作: ${actionNames.join(', ')}`);
    if (tools.length > 0) {
      logger.info(`已自动发现 MCP 工具: ${tools.map(t => t.toolName).join(', ')}`);
    }
  } catch (e) {
    logger.warn('自动发现动作时出错，但不影响后续流程:', e as Error);
  }

  // 事件过滤
  if (Array.isArray(config.enabledEvents) && config.enabledEvents.length > 0) {
    // @ts-ignore: allow string[] tolerant mapping inside MinecraftClient
    minecraftClient.setEnabledEvents(config.enabledEvents as any);
  }

  // 监听游戏事件
  minecraftClient.on('gameEvent', (event: GameEvent) => {
    try {
      const { enabledEvents } = config;
      if (enabledEvents && !enabledEvents.includes(event.type)) return;
      logger.debug(`游戏事件: ${event.type}`);
    } catch (e) {
      logger.error('处理游戏事件时发生错误:', e);
    }
  });

  // 连接生命周期
  minecraftClient.on('connected', () => {
    logger.info('Minecraft 客户端已连接');
  });
  minecraftClient.on('disconnected', () => {
    logger.warn('Minecraft 客户端连接断开');
  });

  // 启动 MCP server (stdio)
  let mcpServer: MaicraftMcpServer | null = null;
  try {
    mcpServer = new MaicraftMcpServer({
      minecraftClient,
      actionExecutor,
      config: {
        name: config.mcp?.name || 'Maicraft MCP',
        version: config.mcp?.version || '0.1.0',
        tools: config.mcp?.tools,
      },
    });
  } catch (e: unknown) {
    logger.error('创建 MCP 服务器失败:', e as Error);
  }

  // 退出时停止客户端
  process.on('SIGINT', async () => {
    logger.info('收到 SIGINT，正在停止客户端...');
    try {
      await minecraftClient.disconnect();
    } catch {}
    process.exit(0);
  });

  // 启动客户端
  try {
    try {
      await minecraftClient.connect();
      logger.info('Minecraft 连接成功');

      // 如果截图功能启用，在连接成功后立即初始化 ViewerManager
      if (config.screenshot?.enabled) {
        try {
          await initializeViewerManager(minecraftClient, config);
          logger.info('ViewerManager 初始化成功');
        } catch (error) {
          logger.error('ViewerManager 初始化失败:', error);
        }

        // 额外添加连接事件监听器，以防后续重连时需要重新初始化
        minecraftClient.on('connected', async () => {
          try {
            await initializeViewerManager(minecraftClient, config);
            logger.info('ViewerManager 重连后重新初始化成功');
          } catch (error) {
            logger.error('ViewerManager 重连后重新初始化失败:', error);
          }
        });
      }
    } catch (error) {
      logger.error('Minecraft 连接失败，但程序将继续运行:', error);
    }
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