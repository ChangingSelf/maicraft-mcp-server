// 简单的测试脚本，用于验证 ViewerManager 初始化逻辑
const fs = require('fs');

// 读取配置文件
let config;
try {
  const raw = fs.readFileSync('config.yaml', 'utf8');
  const yaml = require('js-yaml');
  config = yaml.load(raw);
} catch (error) {
  console.error('读取配置文件失败:', error);
  process.exit(1);
}

console.log('配置文件截图设置:');
console.log('enabled:', config.screenshot?.enabled);
console.log('width:', config.screenshot?.width);
console.log('height:', config.screenshot?.height);
console.log('viewDistance:', config.screenshot?.viewDistance);

console.log('\n测试初始化逻辑:');
if (config.screenshot?.enabled) {
  console.log('✅ 截图功能已启用，将在连接成功后初始化 ViewerManager');
  console.log('配置参数:');
  console.log('- viewDistance:', config.screenshot.viewDistance || 12);
  console.log('- width:', config.screenshot.width || 1920);
  console.log('- height:', config.screenshot.height || 1080);
  console.log('- jpgQuality:', config.screenshot.jpgQuality || 95);
  console.log('- loadWaitTime:', config.screenshot.loadWaitTime || 2000);
  console.log('- renderLoops:', config.screenshot.renderLoops || 10);
} else {
  console.log('❌ 截图功能未启用');
}
