#!/usr/bin/env node
/**
 * 日志查看脚本
 * 用法：node scripts/watch-log.js [logFile]
 */

import fs from 'fs';
import path from 'path';

// 获取日志文件路径
function getLogFilePath() {
  const userPath = process.argv[2];
  if (userPath) {
    return path.resolve(userPath);
  }

  // 查找最新的日志文件
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    console.error('日志目录不存在:', logsDir);
    process.exit(1);
  }

  const files = fs.readdirSync(logsDir)
    .filter(file => file.endsWith('.log'))
    .map(file => ({
      name: file,
      path: path.join(logsDir, file),
      mtime: fs.statSync(path.join(logsDir, file)).mtime
    }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  if (files.length === 0) {
    console.error('未找到日志文件');
    process.exit(1);
  }

  return files[0].path;
}

// 主函数
function main() {
  const logFile = getLogFilePath();
  console.log(`正在查看日志文件: ${logFile}`);

  // 读取现有内容
  if (fs.existsSync(logFile)) {
    const content = fs.readFileSync(logFile, 'utf8');
    console.log(content);
  }

  // 监听文件变化
  console.log('\n--- 实时日志 (按 Ctrl+C 退出) ---\n');
  
  const watcher = fs.watch(logFile, (eventType, filename) => {
    if (eventType === 'change') {
      try {
        const stats = fs.statSync(logFile);
        const newContent = fs.readFileSync(logFile, 'utf8');
        const lines = newContent.split('\n');
        
        // 只显示新增的行
        const lastLines = lines.slice(-5); // 显示最后5行
        lastLines.forEach(line => {
          if (line.trim()) {
            console.log(line);
          }
        });
      } catch (error) {
        console.error('读取日志文件失败:', error.message);
      }
    }
  });

  // 处理退出
  process.on('SIGINT', () => {
    console.log('\n停止查看日志');
    watcher.close();
    process.exit(0);
  });
}

main();
