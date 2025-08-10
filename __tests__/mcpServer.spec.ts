import { MaicraftMcpServer } from '../src/mcp/MaicraftMcpServer';

class FakeMinecraftClient {
  ready = true;
  getBot() { return this.ready ? ({} as any) : null; }
  isConnectedToServer() { return this.ready; }
}

class FakeStateManager {
  getGameState() { return { status: 'ready' }; }
  listEvents() { return [{ type: 'chat', timestamp: Date.now() }]; }
}

class FakeActionExecutor {
  async execute(name: string) {
    if (name === 'mineBlock') return { success: true, message: 'mined' };
    return { success: false, message: 'unknown', error: 'EXECUTION_ERROR' };
  }
  getRegisteredActions() { return []; }
  register() {}
}

describe('MaicraftMcpServer tools', () => {
  test('ping/query tools respond', async () => {
    const deps = {
      minecraftClient: new FakeMinecraftClient() as any,
      stateManager: new FakeStateManager() as any,
      actionExecutor: new FakeActionExecutor() as any,
      config: { name: 'm', version: '0.0.1' },
    };
    const server = new MaicraftMcpServer(deps);
    const ping = await (server as any).__testInvokeTool('ping', {});
    expect(ping.content[0].type).toBe('text');

    const state = await (server as any).__testInvokeTool('query_state', {});
    expect(state.structuredContent.ok).toBe(true);
  });

  test('action tool maps to executor', async () => {
    const deps = {
      minecraftClient: new FakeMinecraftClient() as any,
      stateManager: new FakeStateManager() as any,
      actionExecutor: new FakeActionExecutor() as any,
      config: { name: 'm', version: '0.0.1' },
    };
    const server = new MaicraftMcpServer(deps);
    const res = await (server as any).__testInvokeTool('mine_block', { blockName: 'dirt', count: 1 });
    expect(res.structuredContent.ok).toBe(true);
  });
});


