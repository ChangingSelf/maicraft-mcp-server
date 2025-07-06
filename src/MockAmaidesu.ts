import WebSocket, { WebSocketServer } from 'ws';
import readline from 'readline';

const PORT = Number(process.env.MOCK_PORT ?? 8080);
const PATH = '/ws';

const wss = new WebSocketServer({ port: PORT, path: PATH });

console.log(`\n🛰️  Mock Amaidesu WebSocket 服务器已启动: ws://localhost:${PORT}${PATH}`);
console.log(' - 收到消息将打印到控制台');
console.log(' - 在 "mock> " 提示符输入内容可发送给客户端');
console.log('   • 直接输入 JSON 字符串，原样发送');
console.log('   • 或输入:  actionName {"x":1}  将自动包装为 {type:"action"} 格式');
console.log('   • 快捷命令示例:');
console.log('     chat Hello world');
console.log('     craft diamond_sword 2');
console.log('     dig 10 64 10');
console.log('     move 10 64 10');
console.log('     place 10 64 10 stone');

// 帮助函数：在不打断用户输入的情况下打印信息
function safeLog(fn: () => void, rl: readline.Interface) {
  // 保存当前用户已输入的内容
  const savedLine = rl.line;

  // 将光标移到行首并清空整行（包含提示符和输入内容），避免重复字符残留
  readline.cursorTo(process.stdout, 0);
  readline.clearLine(process.stdout, 0);

  // 输出实际日志内容
  fn();

  // 重新打印提示符并恢复用户输入
  rl.prompt(true);
  if (savedLine) {
    rl.write(savedLine);
  }
}

// 提取 maim_message 内部 payload 文本并解析
function extractPayload(message: any): any | null {
  const seg = message?.message_segment;
  if (!seg) return null;

  const collectText = (segment: any): string => {
    if (!segment) return '';
    if (segment.type === 'text') return segment.data || '';
    if (segment.type === 'seglist' && Array.isArray(segment.data)) {
      return segment.data.map(collectText).join('');
    }
    return '';
  };

  const text = collectText(seg);
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

wss.on('connection', (ws, req) => {
  console.log(`\n[连接] 来自 ${req.socket.remoteAddress}`);

  ws.on('message', (data) => {
    safeLog(() => {
      const text = data.toString();
      let printed = false;
      try {
        const obj = JSON.parse(text);
        const payload = extractPayload(obj);
        if (payload) {
          console.log('\n<<< 解码 payload');
          console.dir(payload, { depth: null, colors: true });
          printed = true;
        }
      } catch {
        /* 解析失败，稍后回退打印 */
      }

      if (!printed) {
        console.log('\n<<< 原始数据 (未能解析 payload)');
        console.log(text);
      }
      console.log('<<< 结束\n');
    }, rl);
  });

  ws.on('close', () => safeLog(() => console.log('[断开] 客户端已断开连接'), rl));
});

// 交互输入
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'mock> ' });
rl.prompt();

// 在 "输入解析" 部分上方插入快捷命令解析函数
function parseCommand(input: string): { action: string; params: any } | null {
  const tokens = input.trim().split(/\s+/);
  if (tokens.length === 0) return null;
  const cmd = tokens[0];

  switch (cmd) {
    // 聊天: chat Hello world
    case 'chat':
    case 'say':
      return {
        action: 'chat',
        params: { message: tokens.slice(1).join(' ') }
      };

    // 合成: craftItem diamond_sword 2 或 craft diamond_sword
    case 'craft':
    case 'craftItem': {
      const item = tokens[1];
      if (!item) return null;
      const count = tokens[2] ? Number(tokens[2]) : undefined;
      return {
        action: 'craftItem',
        params: count ? { item, count } : { item }
      };
    }

    // 挖掘: dig 10 64 10
    case 'dig':
    case 'digBlock': {
      const [x, y, z] = tokens.slice(1, 4).map(Number);
      if ([x, y, z].some((v) => isNaN(v))) return null;
      return {
        action: 'digBlock',
        params: { x, y, z }
      };
    }

    // 移动: move 10 64 10
    case 'move':
    case 'moveToPosition': {
      const [x, y, z] = tokens.slice(1, 4).map(Number);
      if ([x, y, z].some((v) => isNaN(v))) return null;
      return {
        action: 'moveToPosition',
        params: { x, y, z }
      };
    }

    // 放置: place 10 64 10 stone 或 placeBlock 10 64 10 stone
    case 'place':
    case 'placeBlock': {
      const [xStr, yStr, zStr, ...itemParts] = tokens.slice(1);
      const x = Number(xStr);
      const y = Number(yStr);
      const z = Number(zStr);
      if ([x, y, z].some((v) => isNaN(v)) || itemParts.length === 0) return null;
      const item = itemParts.join(' ');
      return {
        action: 'placeBlock',
        params: { x, y, z, item }
      };
    }
  }
  return null;
}

// 构造最小化的 MaimMessage，文本段内放入 payload 字符串
function buildMaimMessage(text: string) {
  const now = Date.now();
  return {
    message_info: {
      platform: 'mock',
      message_id: `mock-${now}`,
      time: Math.floor(now / 1000),
      user_info: {
        platform: 'mock',
        user_id: 'tester'
      }
    },
    message_segment: {
      type: 'seglist',
      data: [{ type: 'text', data: text }]
    },
    raw_message: text
  };
}

rl.on('line', (line) => {
  const text = line.trim();
  if (!text) {
    rl.prompt();
    return;
  }

  let payload: string;

  if (text.startsWith('{')) {
    // 直接 JSON
    payload = text;
  } else {
    // 尝试快捷命令解析
    const parsed = parseCommand(text);
    if (parsed) {
      payload = JSON.stringify({ type: 'action', action: parsed.action, params: parsed.params });
    } else {
      // 回退到原有: actionName {jsonParams}
      const spaceIdx = text.indexOf(' ');
      const actionName = spaceIdx === -1 ? text : text.slice(0, spaceIdx);
      const paramsStr = spaceIdx === -1 ? '{}' : text.slice(spaceIdx + 1).trim();
      let params: any = {};
      try {
        params = JSON.parse(paramsStr || '{}');
      } catch (e) {
        console.error('参数 JSON 解析失败:', e);
        rl.prompt();
        return;
      }
      payload = JSON.stringify({ type: 'action', action: actionName, params });
    }
  }

  // 包装为 maim_message
  const maimMessage = JSON.stringify(buildMaimMessage(payload));

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(maimMessage);
    }
  });
  console.log('>>> 已发送 (maim_message):', payload);
  rl.prompt();
});

rl.on('close', () => {
  console.log('CLI 结束，关闭服务器');
  wss.close();
  process.exit(0);
}); 