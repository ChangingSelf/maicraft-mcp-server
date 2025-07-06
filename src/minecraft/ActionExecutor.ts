import { Bot } from 'mineflayer';
import { ActionRegistry, GameAction, BaseActionParams, ActionResult } from './ActionInterface';

// 动作信息接口
export interface ActionInfo {
  description: string;
  params: Record<string, string>;
}

/**
 * 动作执行器
 * 负责管理和执行所有高级动作
 */
export class ActionExecutor implements ActionRegistry {
  private actions: Map<string, GameAction> = new Map();

  /**
   * 注册动作
   */
  register(action: GameAction): void {
    this.actions.set(action.name, action);
    console.log(`已注册高级动作: ${action.name} - ${action.description}`);
  }

  /**
   * 获取动作
   */
  get(name: string): GameAction | undefined {
    return this.actions.get(name);
  }

  /**
   * 获取所有动作名称
   */
  getActionNames(): string[] {
    return Array.from(this.actions.keys());
  }

  /**
   * 执行动作
   */
  async execute(name: string, bot: Bot, params: BaseActionParams): Promise<ActionResult> {
    const action = this.actions.get(name);
    
    if (!action) {
      return {
        success: false,
        message: `未找到动作: ${name}`,
        error: 'ACTION_NOT_FOUND'
      };
    }

    try {
      // 验证参数
      if (!action.validateParams(params)) {
        return {
          success: false,
          message: `动作 ${name} 的参数验证失败`,
          error: 'INVALID_PARAMS',
          data: action.getParamsSchema()
        };
      }

      // 执行动作
      console.log(`执行高级动作: ${name}`, params);
      const result = await action.execute(bot, params);
      
      console.log(`动作 ${name} 执行结果:`, result);
      return result;
    } catch (error) {
      console.error(`执行动作 ${name} 时发生错误:`, error);
      return {
        success: false,
        message: `执行动作 ${name} 时发生错误: ${error instanceof Error ? error.message : String(error)}`,
        error: 'EXECUTION_ERROR'
      };
    }
  }

  /**
   * 获取所有动作的信息
   */
  getActionsInfo(): Record<string, ActionInfo> {
    const info: Record<string, ActionInfo> = {};
    
    for (const [name, action] of this.actions) {
      info[name] = {
        description: action.description,
        params: action.getParamsSchema()
      };
    }
    
    return info;
  }
} 