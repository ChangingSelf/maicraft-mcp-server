import { Bot } from 'mineflayer';
import { BaseAction, BaseActionParams, McpToolSpec } from '../minecraft/ActionInterface.js';
import { z } from 'zod';

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

  public override getMcpTools(): McpToolSpec[] {
    return [
      {
        toolName: 'chat',
        description: 'Send a chat message to the server.',
        schema: { message: z.string() },
        actionName: 'chat',
        mapInputToParams: (input: any) => ({ message: input.message }),
      },
    ];
  }
} 