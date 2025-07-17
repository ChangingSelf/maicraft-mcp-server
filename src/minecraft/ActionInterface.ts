import { Bot } from 'mineflayer';

/**
 * 动作参数基础接口
 */
export interface BaseActionParams {
  [key: string]: any;
}

/**
 * 动作执行结果
 */
export interface ActionResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

/**
 * 游戏动作接口
 */
export interface GameAction<T extends BaseActionParams = BaseActionParams> {
  name: string;
  description: string;
  execute(bot: Bot, params: T): Promise<ActionResult>;
  validateParams(params: T): boolean;
  getParamsSchema(): Record<string, string>;
}

/**
 * 动作注册表接口
 */
export interface ActionRegistry {
  register(action: GameAction): void;
  execute(name: string, bot: Bot, params: BaseActionParams, timeout?: number): Promise<ActionResult>;
  getRegisteredActions(): string[];
  getActionInfo(name: string): { description: string; params: Record<string, string> } | null;
  getAllActionsInfo(): Record<string, { description: string; params: Record<string, string> }>;
}

/**
 * 通用动作基类，提供常用的错误处理和验证方法
 */
export abstract class BaseAction<T extends BaseActionParams = BaseActionParams> implements GameAction<T> {
  abstract name: string;
  abstract description: string;

  /**
   * 执行动作
   */
  abstract execute(bot: Bot, params: T): Promise<ActionResult>;

  /**
   * 验证参数
   */
  abstract validateParams(params: T): boolean;

  /**
   * 获取参数模式
   */
  abstract getParamsSchema(): Record<string, string>;

  /**
   * 创建成功结果
   */
  protected createSuccessResult(message: string, data?: any): ActionResult {
    return {
      success: true,
      message,
      data
    };
  }

  /**
   * 创建失败结果
   */
  protected createErrorResult(message: string, error: string): ActionResult {
    return {
      success: false,
      message,
      error
    };
  }

  /**
   * 创建异常结果
   */
  protected createExceptionResult(error: unknown, defaultMessage: string, errorCode: string): ActionResult {
    const message = error instanceof Error ? error.message : String(error);
    return this.createErrorResult(`${defaultMessage}: ${message}`, errorCode);
  }

  /**
   * 验证必需参数
   */
  protected validateRequiredParams(params: T, requiredKeys: (keyof T)[]): boolean {
    return requiredKeys.every(key => {
      const value = params[key];
      return value !== undefined && value !== null && value !== '';
    });
  }

  /**
   * 验证数字参数
   */
  protected validateNumberParams(params: T, numberKeys: (keyof T)[]): boolean {
    return numberKeys.every(key => {
      const value = params[key];
      return typeof value === 'number' && !isNaN(value);
    });
  }

  /**
   * 验证字符串参数
   */
  protected validateStringParams(params: T, stringKeys: (keyof T)[]): boolean {
    return stringKeys.every(key => {
      const value = params[key];
      return typeof value === 'string' && value.length > 0;
    });
  }
} 