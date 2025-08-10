import { StateManager } from '../src/minecraft/StateManager';

describe('StateManager', () => {
  test('stores and lists events with filters', () => {
    const sm = new StateManager({ maxEventHistory: 3 });
    const now = Date.now();
    sm.addEvent({ type: 'chat', timestamp: now - 100, serverId: 's', playerName: 'p', chatInfo: { json: {}, text: 'hi' } } as any);
    sm.addEvent({ type: 'blockBreak', timestamp: now - 50, serverId: 's', playerName: 'p', block: { type: 1, name: 'stone', position: { x: 0, y: 0, z: 0 } } } as any);
    sm.addEvent({ type: 'chat', timestamp: now, serverId: 's', playerName: 'p', chatInfo: { json: {}, text: 'hello' } } as any);
    // trim to maxEventHistory
    sm.addEvent({ type: 'chat', timestamp: now + 1, serverId: 's', playerName: 'p', chatInfo: { json: {}, text: 'latest' } } as any);

    const all = sm.listEvents(undefined, undefined, 50);
    expect(all.length).toBeLessThanOrEqual(3);

    const chats = sm.listEvents('chat', undefined, 50);
    expect(chats.every(e => e.type === 'chat')).toBe(true);

    const since = sm.listEvents(undefined, now, 50);
    expect(since.every(e => e.timestamp >= now)).toBe(true);
  });
});


