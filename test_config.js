// 简单的测试脚本，用于验证配置读取
import fs from 'fs';
import { load as yamlLoad } from 'js-yaml';

try {
  const raw = fs.readFileSync('config.yaml', 'utf8');
  const config = yamlLoad(raw);

  console.log('📄 配置文件截图设置:');
  console.log('enabled:', config.screenshot?.enabled);
  console.log('width:', config.screenshot?.width);
  console.log('height:', config.screenshot?.height);
  console.log('viewDistance:', config.screenshot?.viewDistance);
  console.log('jpgQuality:', config.screenshot?.jpgQuality);

  if (config.screenshot?.enabled) {
    console.log('\n✅ 截图功能已启用，配置参数：');
    console.log(`- 分辨率: ${config.screenshot.width}x${config.screenshot.height}`);
    console.log(`- 视距: ${config.screenshot.viewDistance}`);
    console.log(`- JPG质量: ${config.screenshot.jpgQuality}`);
  } else {
    console.log('\n❌ 截图功能未启用');
  }
} catch (error) {
  console.error('读取配置文件失败:', error);
}
