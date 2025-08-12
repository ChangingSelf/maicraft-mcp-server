import { Bot } from 'mineflayer';
import { ActionRegistry, GameAction, BaseActionParams, ActionResult, McpToolSpec, BaseAction } from './ActionInterface.js';
import { Logger } from '../utils/Logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

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
  private isCancelled = false;
  private logger = new Logger('ActionExecutor');
  private discoveredMcpTools: McpToolSpec[] = [];

  /**
   * 注册动作
   */
  register(action: GameAction): void {
    this.actions.set(action.name, action);
    this.logger.info(`已注册高级动作: ${action.name} - ${action.description}`);
  }

  /**
   * 获取所有已注册的动作名称
   */
  getRegisteredActions(): string[] {
    return Array.from(this.actions.keys());
  }

  /**
   * 自动发现并注册 `actions` 目录下的动作，同时收集 MCP 工具定义。
   * 支持在开发环境扫描 `src/actions`，生产环境扫描 `dist/actions`。
   */
  async discoverAndRegisterActions(): Promise<McpToolSpec[]> {
    const discoveredTools: McpToolSpec[] = [];
    
    // 同时支持开发与生产：基于当前模块目录定位
    // - 生产运行：__dirname 指向 dist/minecraft → ../actions => dist/actions
    // - 开发运行：__dirname 指向 src/minecraft  → ../actions => src/actions
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const resolvedActionsDir = path.resolve(__dirname, '../actions');

    // 为了兼容某些非常规运行方式，附加一个基于 cwd 的后备扫描
    const candidateDirs = [resolvedActionsDir, './dist/actions', './src/actions'];

    for (const dir of candidateDirs) {
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
      const files = fs.readdirSync(dir)
        .filter((f) => /\.(mjs|cjs|js|ts)$/.test(f) && !/\.d\.ts$/.test(f));

      for (const file of files) {
        const full = path.join(dir, file);
        try {
          const mod = await import(pathToFileURL(full).href);
          const exportedValues: unknown[] = Object.values(mod);

          // 收集继承了 BaseAction 的类实例
          const maybeActions: GameAction[] = [];
          for (const value of exportedValues) {
            try {
              if (!value) continue;
              
              // 检测是否继承了 BaseAction
              const isBaseActionClass = (cls: any): boolean => {
                if (typeof cls !== 'function') return false;
                
                // 检查原型链，看是否继承自 BaseAction
                let current = cls.prototype;
                while (current) {
                  if (current.constructor === BaseAction) {
                    return true;
                  }
                  current = Object.getPrototypeOf(current);
                }
                return false;
              };

              // 1) 已实例化的对象
              if (typeof value === 'object' && 
                  'execute' in (value as any) && 
                  'validateParams' in (value as any) && 
                  'getParamsSchema' in (value as any)) {
                maybeActions.push(value as GameAction);
                continue;
              }
              
              // 2) 继承了 BaseAction 的类
              if (isBaseActionClass(value)) {
                try {
                  // eslint-disable-next-line new-cap
                  const instance = new (value as any)();
                  maybeActions.push(instance as GameAction);
                } catch (instErr) {
                  this.logger.warn(`实例化动作类失败: ${file}: ${instErr instanceof Error ? instErr.message : String(instErr)}`);
                }
              }
            } catch {}
          }

          for (const action of maybeActions) {
            if (!this.actions.has(action.name)) {
              this.register(action);
            }
            // 收集 MCP 工具定义
            try {
              const fromInstance = (action as any).getMcpTools?.();
              if (Array.isArray(fromInstance) && fromInstance.length > 0) {
                discoveredTools.push(...fromInstance);
              }
            } catch {}
          }

          // 回退：收集模块级 MCP 工具定义
          const toolsExport: unknown = (mod as any).mcpTools ?? (mod as any).MCP_TOOLS ?? null;
          if (Array.isArray(toolsExport)) {
            for (const spec of toolsExport) {
              if (spec && typeof (spec as any).toolName === 'string' && typeof (spec as any).description === 'string') {
                discoveredTools.push(spec as McpToolSpec);
              }
            }
          }
        } catch (err) {
          this.logger.warn(`加载动作模块失败: ${full}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      
      // 如果从当前目录找到了工具，就不再扫描其他目录
      if (discoveredTools.length > 0) break;
    }

    this.discoveredMcpTools = discoveredTools;
    if (discoveredTools.length > 0) {
      this.logger.info(`已发现 MCP 工具定义: ${discoveredTools.map(t => t.toolName).join(', ')}`);
    }
    return discoveredTools;
  }

  getDiscoveredMcpTools(): McpToolSpec[] {
    return [...this.discoveredMcpTools];
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
    if (this.isCancelled) {
      return Promise.resolve({
        success: false,
        message: '动作执行已被取消',
        error: 'CANCELLED'
      });
    }
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
      if (this.isCancelled) {
        // 拒绝余下任务
        while (this.actionQueue.length > 0) {
          const pending = this.actionQueue.shift()!;
          pending.reject(new Error('队列已被取消'));
        }
        break;
      }
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
      this.logger.info(`执行高级动作: ${name}`, params);
      const timeoutMs = timeout || this.defaultTimeout;
      
      const result = await Promise.race([
        action.execute(bot, params),
        new Promise<ActionResult>((_, reject) => 
          setTimeout(() => reject(new Error(`动作 ${name} 执行超时 (${timeoutMs}ms)`)), timeoutMs)
        )
      ]);
      
      this.logger.info(`动作 ${name} 执行结果:`, result);
      return result;
    } catch (error) {
      this.logger.error(`执行动作 ${name} 时发生错误:`, error);
      
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
   * 取消所有动作（包含队列与未来请求）。
   * 正在执行的动作无法强制中断，但将尽快返回。
   */
  cancelAll(): void {
    this.isCancelled = true;
    this.clearQueue();
  }

  /**
   * 重置取消标志（启动新会话时调用）。
   */
  resetCancellation(): void {
    this.isCancelled = false;
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