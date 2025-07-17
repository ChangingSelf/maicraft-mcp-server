import WebSocket, { WebSocketServer } from 'ws';
import readline from 'readline';
import { PayloadType } from './messaging/PayloadTypes.js';

const PORT = Number(process.env.MOCK_PORT ?? 8080);
const PATH = '/ws';

const wss = new WebSocketServer({ port: PORT, path: PATH });

console.log(`\n🛰️  Mock Amaidesu WebSocket 服务器已启动: ws://localhost:${PORT}${PATH}`);
console.log(' - 收到消息将打印到控制台');
console.log(' - 在 "mock> " 提示符输入内容可发送给客户端');
console.log('   • 直接输入 JSON 字符串，原样发送');
console.log(`   • 或输入:  actionName {"x":1}  将自动包装为 {type:"${PayloadType.ACTION}"} 格式`);
console.log('   • 快捷命令示例:');
console.log('     chat Hello world');
console.log('     craftItem diamond_sword 2');
console.log('     mineBlock dirt 5');
console.log('     placeBlock 10 64 10 stone');
console.log('     killMob cow');
console.log('     followPlayer playerName 3');
console.log('     smeltItem iron_ore coal 3');
console.log('     swimToLand 64');
console.log('     useChest store diamond 5');

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

wss.on('connection', (ws, req) => {
  console.log(`\n[连接] 来自 ${req.socket.remoteAddress}`);

  ws.on('message', (data) => {
    safeLog(() => {
      const text = data.toString();
      try {
        const obj = JSON.parse(text);
        console.log('\n<<< 收到载荷消息');
        console.dir(obj, { depth: null, colors: true });
      } catch {
        console.log('\n<<< 原始数据 (未能解析 JSON)');
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

// 快捷命令解析函数
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

    // 合成: craftItem diamond_sword 2
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

    // 挖掘: mineBlock dirt 5
    case 'mine':
    case 'mineBlock':
    case 'dig':
    case 'digBlock': {
      const name = tokens[1];
      if (!name) return null;
      const count = tokens[2] ? Number(tokens[2]) : undefined;
      return {
        action: 'mineBlock',
        params: count ? { name, count } : { name }
      };
    }

    // 放置: placeBlock 10 64 10 stone
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

    // 击杀生物: killMob cow
    case 'kill':
    case 'killMob': {
      const mob = tokens[1];
      if (!mob) return null;
      const timeout = tokens[2] ? Number(tokens[2]) : undefined;
      return {
        action: 'killMob',
        params: timeout ? { mob, timeout } : { mob }
      };
    }

    // 跟随玩家: followPlayer playerName 3
    case 'follow':
    case 'followPlayer': {
      const player = tokens[1];
      if (!player) return null;
      const distance = tokens[2] ? Number(tokens[2]) : undefined;
      const timeout = tokens[3] ? Number(tokens[3]) : undefined;
      return {
        action: 'followPlayer',
        params: { player, distance, timeout }
      };
    }

    // 熔炼: smeltItem iron_ore coal 3
    case 'smelt':
    case 'smeltItem': {
      const item = tokens[1];
      const fuel = tokens[2];
      if (!item || !fuel) return null;
      const count = tokens[3] ? Number(tokens[3]) : undefined;
      return {
        action: 'smeltItem',
        params: count ? { item, fuel, count } : { item, fuel }
      };
    }

    // 游向陆地: swimToLand 64
    case 'swim':
    case 'swimToLand': {
      const maxDistance = tokens[1] ? Number(tokens[1]) : undefined;
      const timeout = tokens[2] ? Number(tokens[2]) : undefined;
      return {
        action: 'swimToLand',
        params: { maxDistance, timeout }
      };
    }

    // 使用箱子: useChest store diamond 5
    case 'chest':
    case 'useChest': {
      const action = tokens[1];
      const item = tokens[2];
      if (!action || !item) return null;
      const count = tokens[3] ? Number(tokens[3]) : undefined;
      return {
        action: 'useChest',
        params: count ? { action, item, count } : { action, item }
      };
    }
  }
  return null;
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
      payload = JSON.stringify({ type: PayloadType.ACTION, action: parsed.action, params: parsed.params });
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
      payload = JSON.stringify({ type: PayloadType.ACTION, action: actionName, params });
    }
  }

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
  console.log('>>> 已发送载荷:', payload);
  rl.prompt();
});

rl.on('close', () => {
  console.log('CLI 结束，关闭服务器');
  wss.close();
  process.exit(0);
}); 