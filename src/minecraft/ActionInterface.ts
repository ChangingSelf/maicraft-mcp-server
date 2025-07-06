import { Bot } from 'mineflayer';

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
 * 动作参数基础接口
 */
export interface BaseActionParams {
  [key: string]: any;
}

/**
 * 高级动作接口
 * 所有高级动作都需要实现这个接口
 */
export interface GameAction<T extends BaseActionParams = BaseActionParams> {
  /**
   * 动作名称，用于注册和调用
   */
  name: string;

  /**
   * 动作描述
   */
  description: string;

  /**
   * 执行动作
   * @param bot mineflayer 机器人实例
   * @param params 动作参数
   */
  execute(bot: Bot, params: T): Promise<ActionResult>;

  /**
   * 验证参数是否有效
   * @param params 动作参数
   */
  validateParams(params: T): boolean;

  /**
   * 获取参数说明
   */
  getParamsSchema(): Record<string, string>;
}

/**
 * 动作注册器接口
 */
export interface ActionRegistry {
  /**
   * 注册动作
   */
  register(action: GameAction): void;

  /**
   * 获取动作
   */
  get(name: string): GameAction | undefined;

  /**
   * 获取所有动作名称
   */
  getActionNames(): string[];

  /**
   * 执行动作
   */
  execute(name: string, bot: Bot, params: BaseActionParams): Promise<ActionResult>;
} 