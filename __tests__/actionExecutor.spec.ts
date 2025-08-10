import { ActionExecutor } from '../src/minecraft/ActionExecutor';

describe('ActionExecutor', () => {
  test('register and list actions', () => {
    const exec = new ActionExecutor();
    const dummy = {
      name: 'dummy',
      description: 'd',
      getParamsSchema: () => ({} as any),
      validateParams: () => true,
      execute: async () => ({ success: true, message: 'ok' }),
    };
    exec.register(dummy as any);
    expect(exec.getRegisteredActions()).toContain('dummy');
    const info = exec.getActionInfo('dummy');
    expect(info?.description).toBe('d');
  });

  test('execute unknown action returns error', async () => {
    const exec = new ActionExecutor();
    const result = await exec.execute('unknown', {} as any, {} as any);
    expect(result.success).toBe(false);
    expect(result.error).toBe('ACTION_NOT_FOUND');
  });

  test('queue respects priority (LIFO on equal priority)', async () => {
    const exec = new ActionExecutor();
    const order: string[] = [];
    const bot = {} as any;
    const make = (name: string, delayMs: number) => ({
      name,
      description: name,
      getParamsSchema: () => ({} as any),
      validateParams: () => true,
      execute: async () => {
        await new Promise((r) => setTimeout(r, delayMs));
        order.push(name);
        return { success: true, message: 'ok' };
      },
    });
    exec.register(make('a', 10) as any);
    exec.register(make('b', 10) as any);
    const p1 = exec.queueAction('a', bot, {}, 0);
    const p2 = exec.queueAction('b', bot, {}, 0);
    await Promise.all([p1, p2]);
    expect(order).toEqual(['a', 'b']);
  });
});


