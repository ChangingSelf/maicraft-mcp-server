import { Bot } from 'mineflayer';
import { GameAction, ActionResult, BaseActionParams } from '../minecraft/ActionInterface';

interface ChatParams extends BaseActionParams {
  message: string;
}

export class ChatAction implements GameAction<ChatParams> {
  name = 'chat';
  description = '发送聊天消息';

  async execute(bot: Bot, params: ChatParams): Promise<ActionResult> {
    try {
      await bot.chat(params.message);

      return {
        success: true,
        message: `成功发送聊天消息: ${params.message}`,
        data: { message: params.message }
      };
    } catch (error) {
      return {
        success: false,
        message: `发送聊天消息失败: ${error instanceof Error ? error.message : String(error)}`,
        error: 'CHAT_FAILED'
      };
    }
  }

  validateParams(params: ChatParams): boolean {
    return typeof params.message === 'string' && params.message.length > 0;
  }

  getParamsSchema(): Record<string, string> {
    return {
      message: '要发送的聊天消息 (字符串)'
    };
  }
} 