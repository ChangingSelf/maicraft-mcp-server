import { Bot } from 'mineflayer';
import { z } from 'zod';
import { Logger } from '../utils/Logger.js';

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
 * MCP 工具定义（由各 Action 模块可选导出，用于自动注册 MCP 工具）
 */
export interface McpToolSpec {
  /** MCP 工具名称（例如: "mine_block"） */
  toolName: string;
  /** 工具描述 */
  description: string;
  /**
   * 输入参数校验 Schema。
   * 支持：
   * - 直接传入 z.object({...})
   * - 传入 Zod 原始 shape（Record<string, z.ZodTypeAny>）
   * - 省略（将不进行 schema 校验）
   */
  schema?: z.ZodTypeAny | Record<string, z.ZodTypeAny>;
  /** 映射到的动作名称，缺省为对应 Action 实例的 name */
  actionName?: string;
  /** 将工具输入映射为动作参数 */
  mapInputToParams?: (input: unknown, ctx: unknown) => BaseActionParams;
}

/**
 * 通用动作基类，提供常用的错误处理和验证方法
 */
export abstract class BaseAction<T extends BaseActionParams = BaseActionParams> implements GameAction<T> {
  abstract name: string;
  abstract description: string;
  private _logger?: Logger;

  /**
   * 获取 logger 实例，延迟初始化
   */
  get logger(): Logger {
    if (!this._logger) {
      this._logger = new Logger(this.name);
    }
    return this._logger;
  }

  /**
   * 参数校验器（可选，若提供将自动用于 validateParams 和 MCP schema 暴露）
   */
  public schema?: z.ZodTypeAny;

  /**
   * 执行动作
   */
  abstract execute(bot: Bot, params: T): Promise<ActionResult>;

  /**
   * 验证参数
   */
  validateParams(params: T): boolean {
    if (!this.schema) return true;
    const result = this.schema.safeParse(params);
    return result.success;
  }

  /**
   * 获取参数模式
   */
  getParamsSchema(): Record<string, string> {
    if (!this.schema) return {};
    const shape: Record<string, z.ZodTypeAny> | undefined = (this.schema as any)?._def?.shape?.();
    if (!shape) return {};
    const desc: Record<string, string> = {};
    for (const key of Object.keys(shape)) {
      const def = shape[key] as any;
      // 读取 Zod description 或类型名
      const d: string | undefined = typeof def.description === 'function' ? def.description() : def._def?.description;
      const typeName = def._def?.typeName ?? def._def?.innerType?._def?.typeName;
      desc[key] = d || String(typeName || 'param');
    }
    return desc;
  }

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

  /**
   * 返回与该动作关联的 MCP 工具定义（可选）。
   * 默认：若提供了 schema，则自动生成一个工具定义，名称为动作名的 snake_case。
   */
  public getMcpTools(): McpToolSpec[] {
    if (!this.schema) return [];
    const toSnake = (s: string) => s
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/\s+/g, '_')
      .toLowerCase();
    const toolName = toSnake(this.name);
    return [
      {
        toolName,
        description: this.description,
        schema: this.schema,
        actionName: this.name,
        mapInputToParams: (input: unknown) => (typeof input === 'object' && input !== null ? (input as any) : {}),
      },
    ];
  }
} 

/**
 * 轻量动作工厂：无需继承类，直接定义 name/description/schema/execute
 */
export function defineAction<T extends BaseActionParams>(opts: {
  name: string;
  description: string;
  schema?: z.ZodTypeAny;
  execute: (bot: Bot, params: T) => Promise<ActionResult>;
}): GameAction<T> & { getMcpTools(): McpToolSpec[] } {
  const { name, description, schema, execute } = opts;
  const toSnake = (s: string) => s
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/\s+/g, '_')
    .toLowerCase();

  return {
    name,
    description,
    async execute(bot: Bot, params: T) {
      return execute(bot, params);
    },
    validateParams(params: T): boolean {
      if (!schema) return true;
      return Boolean(schema.safeParse(params).success);
    },
    getParamsSchema(): Record<string, string> {
      if (!schema) return {};
      const shape: Record<string, z.ZodTypeAny> | undefined = (schema as any)?._def?.shape?.();
      if (!shape) return {};
      const desc: Record<string, string> = {};
      for (const key of Object.keys(shape)) {
        const def = shape[key] as any;
        const d: string | undefined = typeof def.description === 'function' ? def.description() : def._def?.description;
        const typeName = def._def?.typeName ?? def._def?.innerType?._def?.typeName;
        desc[key] = d || String(typeName || 'param');
      }
      return desc;
    },
    getMcpTools(): McpToolSpec[] {
      if (!schema) return [];
      return [
        {
          toolName: toSnake(name),
          description,
          schema,
          actionName: name,
          mapInputToParams: (input: unknown) => (typeof input === 'object' && input !== null ? (input as any) : {}),
        },
      ];
    },
  };
}