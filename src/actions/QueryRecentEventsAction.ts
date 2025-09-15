import { Bot } from 'mineflayer';
import { BaseAction, BaseActionParams, ActionResult } from '../minecraft/ActionInterface.js';
import { z } from 'zod';
import { MinecraftClient } from '../minecraft/MinecraftClient.js';

interface QueryRecentEventsParams extends BaseActionParams {
  eventType?: string;
  sinceTick?: number;
  timestampAfter?: number;
  timestampBefore?: number;
  limit?: number;
  includeDetails?: boolean;
}

export class QueryRecentEventsAction extends BaseAction<QueryRecentEventsParams> {
  name = 'queryRecentEvents';
  description = '查询最近发生的游戏事件，包括聊天、玩家加入/离开、方块变化等';
  schema = z.object({
    eventType: z.string().optional().describe('事件类型过滤（如：chat, playerJoin, blockBreak等）'),
    sinceTick: z.number().optional().describe('查询指定游戏刻之后的事件'),
    timestampAfter: z.number().optional().describe('查询指定时间戳（毫秒）之后的事件'),
    timestampBefore: z.number().optional().describe('查询指定时间戳（毫秒）之前的事件'),
    limit: z.number().min(1).max(100).optional().describe('返回事件数量限制（1-100）'),
    includeDetails: z.boolean().optional().describe('是否包含详细事件信息'),
  });

  async execute(bot: Bot, params: QueryRecentEventsParams): Promise<ActionResult> {
    try {
      this.logger.debug('查询最近事件信息');
      
      // 获取事件管理器
      // 注意：这里需要从bot对象中获取MinecraftClient实例
      // 由于mineflayer的Bot对象没有直接暴露MinecraftClient，我们需要通过其他方式获取
      // 这里我们假设bot对象有一个client属性指向MinecraftClient实例
      const client = (bot as any).client as MinecraftClient;
      
      if (!client || !client.getEventManager) {
        this.logger.warn('无法获取事件管理器，返回空结果');
        return this.createSuccessResult('无法获取事件管理器', {
          total: 0,
          events: [],
          stats: {
            total: 0,
            byType: {},
            oldestGameTick: null,
            newestGameTick: null
          }
        });
      }

      const eventManager = client.getEventManager();
      
      // 查询事件
      const { eventType, sinceTick, timestampAfter, timestampBefore, limit, includeDetails } = params;
      const queryResult = eventManager.queryRecentEvents({
        eventType,
        sinceTick,
        timestampAfter,
        timestampBefore,
        limit,
        includeDetails
      });

      // 获取事件统计信息
      const stats = eventManager.getEventStats();

      const result = {
        ...queryResult,
        stats,
        supportedEventTypes: eventManager.getSupportedEventTypes()
      };

      this.logger.debug(`成功查询到 ${queryResult.total} 个事件，返回 ${queryResult.events.length} 个`);
      return this.createSuccessResult(`成功查询到 ${queryResult.total} 个事件`, result);
    } catch (error) {
      this.logger.error(`查询最近事件失败: ${error instanceof Error ? error.message : String(error)}`);
      return this.createExceptionResult(error, '查询最近事件失败', 'QUERY_RECENT_EVENTS_FAILED');
    }
  }
}
