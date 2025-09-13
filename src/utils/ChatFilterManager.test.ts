import { ChatFilterManager } from './ChatFilterManager.js';

describe('ChatFilterManager', () => {
  describe('默认过滤规则', () => {
    it('当调试命令未启用时，应该过滤以!开头的消息', () => {
      const manager = new ChatFilterManager({ enabled: true }, false);

      expect(manager.shouldFilterMessage('player1', '!help')).toBe(true);
      expect(manager.shouldFilterMessage('player1', '!status')).toBe(true);
      expect(manager.shouldFilterMessage('player1', 'hello')).toBe(false);
      expect(manager.shouldFilterMessage('player1', 'normal message')).toBe(false);
    });

    it('当调试命令启用时，不应该过滤以!开头的消息', () => {
      const manager = new ChatFilterManager({ enabled: true }, true);

      expect(manager.shouldFilterMessage('player1', '!help')).toBe(false);
      expect(manager.shouldFilterMessage('player1', '!status')).toBe(false);
      expect(manager.shouldFilterMessage('player1', 'hello')).toBe(false);
    });

    it('当过滤器被禁用时，不应该过滤任何消息', () => {
      const manager = new ChatFilterManager({ enabled: false }, false);

      expect(manager.shouldFilterMessage('player1', '!help')).toBe(false);
      expect(manager.shouldFilterMessage('player1', 'hello')).toBe(false);
    });
  });

  describe('玩家黑名单', () => {
    it('应该过滤黑名单玩家的消息', () => {
      const manager = new ChatFilterManager({
        enabled: true,
        blockedPlayers: ['spamBot', 'annoyingPlayer']
      }, false);

      expect(manager.shouldFilterMessage('spamBot', 'hello')).toBe(true);
      expect(manager.shouldFilterMessage('annoyingPlayer', 'hi there')).toBe(true);
      expect(manager.shouldFilterMessage('normalPlayer', 'hello')).toBe(false);
    });
  });

  describe('消息模式黑名单', () => {
    it('应该过滤匹配正则表达式的消息', () => {
      const manager = new ChatFilterManager({
        enabled: true,
        blockedMessagePatterns: ['spam', '^广告']
      }, false);

      expect(manager.shouldFilterMessage('player1', 'this is spam')).toBe(true);
      expect(manager.shouldFilterMessage('player1', '广告信息')).toBe(true);
      expect(manager.shouldFilterMessage('player1', 'normal message')).toBe(false);
    });
  });

  describe('综合过滤', () => {
    it('应该按优先级应用所有过滤规则', () => {
      const manager = new ChatFilterManager({
        enabled: true,
        blockedPlayers: ['spamBot'],
        blockedMessagePatterns: ['spam']
      }, false);

      // 玩家黑名单优先
      expect(manager.shouldFilterMessage('spamBot', 'normal message')).toBe(true);

      // 消息模式过滤
      expect(manager.shouldFilterMessage('player1', 'this is spam')).toBe(true);

      // 默认!开头过滤
      expect(manager.shouldFilterMessage('player1', '!command')).toBe(true);

      // 正常消息通过
      expect(manager.shouldFilterMessage('player1', 'hello world')).toBe(false);
    });
  });
});
