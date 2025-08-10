#!/usr/bin/env node
/**
 * 日志配置测试脚本
 */

import { Logger } from '../dist/utils/Logger.js';

// 测试不同的日志配置
const testConfigs = [
  {
    name: '默认配置',
    config: {}
  },
  {
    name: '调试模式',
    config: {
      level: 'DEBUG',
      enableFileLog: true
    }
  },
  {
    name: '禁用文件日志',
    config: {
      enableFileLog: false
    }
  },
  {
    name: '自定义日志路径',
    config: {
      enableFileLog: true,
      logFilePath: 'logs/test-custom.log'
    }
  }
];

async function testLogging() {
  console.log('=== 日志配置测试 ===\n');

  for (const test of testConfigs) {
    console.log(`测试: ${test.name}`);
    console.log(`配置: ${JSON.stringify(test.config, null, 2)}`);
    
    const logger = Logger.fromConfig('TestLogger', test.config);
    
    logger.debug('这是一条调试日志');
    logger.info('这是一条信息日志');
    logger.warn('这是一条警告日志');
    logger.error('这是一条错误日志');
    
    if (test.config.enableFileLog) {
      console.log(`日志文件位置: ${logger.getLogFilePath()}`);
    }
    
    console.log('---\n');
  }
}

testLogging().catch(console.error);
