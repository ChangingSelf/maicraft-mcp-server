import { Bot } from 'mineflayer';
import { BaseAction, BaseActionParams, ActionResult } from '../minecraft/ActionInterface.js';
import { z } from 'zod';

interface QueryRecentEventsParams extends BaseActionParams {
  eventType?: string;
  sinceMs?: number;
  limit?: number;
  includeDetails?: boolean;
}

export class QueryRecentEventsAction extends BaseAction<QueryRecentEventsParams> {
  name = 'queryRecentEvents';
  description = '查询最近发生的游戏事件，包括聊天、玩家加入/离开、方块变化等';
  schema = z.object({
    eventType: z.string().optional().describe('事件类型过滤（如：chat, playerJoin, blockBreak等）'),
    sinceMs: z.number().optional().describe('查询指定时间戳之后的事件（毫秒）'),
    limit: z.number().min(1).max(100).optional().describe('返回事件数量限制（1-100）'),
    includeDetails: z.boolean().optional().describe('是否包含详细事件信息'),
  });

  async execute(bot: Bot, params: QueryRecentEventsParams): Promise<ActionResult> {
    try {
      this.logger.info('查询最近事件信息');
      
      // 由于移除了状态管理器，这个动作现在返回空结果
      // 如果需要事件查询功能，可以通过其他方式实现
      const result = {
        total: 0,
        events: []
      };

      this.logger.info('事件查询功能已移除，返回空结果');
      return this.createSuccessResult('事件查询功能已移除，返回空结果', result);
    } catch (error) {
      this.logger.error(`查询最近事件失败: ${error instanceof Error ? error.message : String(error)}`);
      return this.createExceptionResult(error, '查询最近事件失败', 'QUERY_RECENT_EVENTS_FAILED');
    }
  }
}
