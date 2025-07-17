import { Bot } from 'mineflayer';
import { ActionRegistry, GameAction, BaseActionParams, ActionResult } from './ActionInterface';

// 动作信息接口
export interface ActionInfo {
  description: string;
  params: Record<string, string>;
}

// 队列中的动作项
interface QueuedAction {
  id: string;
  name: string;
  params: BaseActionParams;
  priority: number;
  timeout?: number;
  timestamp: number;
  resolve: (result: ActionResult) => void;
  reject: (error: Error) => void;
}

/**
 * 动作执行器
 * 负责管理和执行所有高级动作
 */
export class ActionExecutor implements ActionRegistry {
  private actions: Map<string, GameAction> = new Map();
  private defaultTimeout = 300000; // 5分钟默认超时
  private actionQueue: QueuedAction[] = [];
  private isProcessingQueue = false;
  private maxConcurrentActions = 1; // 当前限制为串行执行

  /**
   * 注册动作
   */
  register(action: GameAction): void {
    this.actions.set(action.name, action);
    console.log(`已注册高级动作: ${action.name} - ${action.description}`);
  }

  /**
   * 获取所有已注册的动作名称
   */
  getRegisteredActions(): string[] {
    return Array.from(this.actions.keys());
  }

  /**
   * 获取动作信息
   */
  getActionInfo(name: string): ActionInfo | null {
    const action = this.actions.get(name);
    if (!action) return null;

    return {
      description: action.description,
      params: action.getParamsSchema()
    };
  }

  /**
   * 获取所有动作信息
   */
  getAllActionsInfo(): Record<string, ActionInfo> {
    const result: Record<string, ActionInfo> = {};
    for (const [name, action] of this.actions) {
      result[name] = {
        description: action.description,
        params: action.getParamsSchema()
      };
    }
    return result;
  }

  /**
   * 将动作添加到队列
   */
  async queueAction(
    name: string, 
    bot: Bot, 
    params: BaseActionParams, 
    priority: number = 0,
    timeout?: number
  ): Promise<ActionResult> {
    return new Promise<ActionResult>((resolve, reject) => {
      const queuedAction: QueuedAction = {
        id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name,
        params,
        priority,
        timeout,
        timestamp: Date.now(),
        resolve,
        reject
      };

      // 按优先级插入队列
      const insertIndex = this.actionQueue.findIndex(item => item.priority < priority);
      if (insertIndex === -1) {
        this.actionQueue.push(queuedAction);
      } else {
        this.actionQueue.splice(insertIndex, 0, queuedAction);
      }

      // 开始处理队列
      this.processQueue(bot);
    });
  }

  /**
   * 处理动作队列
   */
  private async processQueue(bot: Bot): Promise<void> {
    if (this.isProcessingQueue || this.actionQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.actionQueue.length > 0) {
      const queuedAction = this.actionQueue.shift()!;
      
      try {
        const result = await this.executeAction(queuedAction.name, bot, queuedAction.params, queuedAction.timeout);
        queuedAction.resolve(result);
      } catch (error) {
        queuedAction.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * 执行单个动作（内部方法）
   */
  private async executeAction(name: string, bot: Bot, params: BaseActionParams, timeout?: number): Promise<ActionResult> {
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

      // 执行动作（带超时）
      console.log(`执行高级动作: ${name}`, params);
      const timeoutMs = timeout || this.defaultTimeout;
      
      const result = await Promise.race([
        action.execute(bot, params),
        new Promise<ActionResult>((_, reject) => 
          setTimeout(() => reject(new Error(`动作 ${name} 执行超时 (${timeoutMs}ms)`)), timeoutMs)
        )
      ]);
      
      console.log(`动作 ${name} 执行结果:`, result);
      return result;
    } catch (error) {
      console.error(`执行动作 ${name} 时发生错误:`, error);
      
      // 检查是否是超时错误
      if (error instanceof Error && error.message.includes('超时')) {
        return {
          success: false,
          message: error.message,
          error: 'TIMEOUT'
        };
      }
      
      return {
        success: false,
        message: `执行动作 ${name} 时发生错误: ${error instanceof Error ? error.message : String(error)}`,
        error: 'EXECUTION_ERROR'
      };
    }
  }

  /**
   * 执行动作（带超时机制）
   */
  async execute(name: string, bot: Bot, params: BaseActionParams, timeout?: number): Promise<ActionResult> {
    return this.executeAction(name, bot, params, timeout);
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): { length: number; isProcessing: boolean } {
    return {
      length: this.actionQueue.length,
      isProcessing: this.isProcessingQueue
    };
  }

  /**
   * 清空动作队列
   */
  clearQueue(): void {
    // 拒绝所有待处理的动作
    this.actionQueue.forEach(action => {
      action.reject(new Error('队列已清空'));
    });
    this.actionQueue = [];
  }

  /**
   * 设置默认超时时间
   */
  setDefaultTimeout(timeoutMs: number): void {
    this.defaultTimeout = timeoutMs;
  }

  /**
   * 获取默认超时时间
   */
  getDefaultTimeout(): number {
    return this.defaultTimeout;
  }
} 