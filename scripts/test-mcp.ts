import { spawn } from 'child_process';
import { McpClient } from '@modelcontextprotocol/sdk/dist/cjs/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/dist/cjs/client/stdio.js';

async function main() {
  // 启动本地 MCP Server（stdio）
  const child = spawn('node', ['dist/main.js', 'config.yaml'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  child.stderr.on('data', (buf) => {
    // 将服务端日志转发到当前进程的 stderr，便于调试
    process.stderr.write(buf);
  });

  // 连接到子进程的 stdio
  const transport = new StdioClientTransport({
    input: child.stdout as any,
    output: child.stdin as any,
  });

  const client = new McpClient({ name: 'maicraft-cli-test', version: '0.0.1' });
  await client.connect(transport);

  // 调用基础工具
  const ping = await client.callTool({ name: 'ping', arguments: {} });
  console.log('PING RESULT:', JSON.stringify(ping, null, 2));

  const state = await client.callTool({ name: 'query_state', arguments: {} });
  console.log('STATE RESULT:', JSON.stringify(state, null, 2));

  // 结束
  child.kill();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


