import { Bot } from 'mineflayer';
import { BaseAction, BaseActionParams } from '../minecraft/ActionInterface.js';

interface ChatParams extends BaseActionParams {
  message: string;
}

export class ChatAction extends BaseAction<ChatParams> {
  name = 'chat';
  description = '发送聊天消息';

  async execute(bot: Bot, params: ChatParams): Promise<any> {
    try {
      await bot.chat(params.message);
      return this.createSuccessResult(`成功发送聊天消息: ${params.message}`, { message: params.message });
    } catch (error) {
      return this.createExceptionResult(error, '发送聊天消息失败', 'CHAT_FAILED');
    }
  }

  validateParams(params: ChatParams): boolean {
    return this.validateStringParams(params, ['message']);
  }

  getParamsSchema(): Record<string, string> {
    return {
      message: '要发送的聊天消息 (字符串)'
    };
  }
} 