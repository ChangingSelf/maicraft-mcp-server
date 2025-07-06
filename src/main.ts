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

import { MaicraftClient, ClientConfig } from './MaicraftClient';
import { Logger } from './utils/Logger';

const logger = new Logger('Maicraft');

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
  /**
   * 读取配置文件
   */
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    logger.error(`配置文件不存在: ${configPath}`);
    process.exit(1);
  }

  let config: ClientConfig;
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
  } catch (err) {
    logger.error('启动客户端失败:', err);
    process.exit(1);
  }
}

main().catch((err) => {
  logger.error('未知错误:', err);
  process.exit(1);
});