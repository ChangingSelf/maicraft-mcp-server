import { Bot } from 'mineflayer';
import { BaseAction, BaseActionParams, ActionResult } from '../minecraft/ActionInterface.js';
import { z } from 'zod';
import { MovementUtils, MovementParams, GoalType } from '../utils/MovementUtils.js';

interface MoveParams extends BaseActionParams {
  /** 移动类型 */
  type: 'coordinate' | 'block' | 'player' | 'entity';
  /** 是否使用相对坐标，默认 false (绝对坐标) */
  useRelativeCoords?: boolean;
  /** 目标坐标 X (整数，当 type 为 coordinate 时必需) */
  x?: number;
  /** 目标坐标 Y (整数，当 type 为 coordinate 时必需) */
  y?: number;
  /** 目标坐标 Z (整数，当 type 为 coordinate 时必需) */
  z?: number;
  /** 目标方块名称 (当 type 为 block 时必需) */
  block?: string;
  /** 目标玩家名称 (当 type 为 player 时必需) */
  player?: string;
  /** 目标实体类型 (当 type 为 entity 时必需) */
  entity?: string;
  /** 到达距离，默认 1 */
  distance?: number;
  /** 最大移动距离，默认 200 */
  maxDistance?: number;
  /** 移动目标类型，默认根据移动类型自动选择 */
  goalType?: GoalType;
}

/**
 * MoveAction - 移动到指定位置
 *
 * 支持多种移动方式：
 * - coordinate: 移动到指定坐标
 * - block: 移动到指定方块附近
 * - player: 移动到指定玩家附近
 * - entity: 移动到指定实体附近
 *
 * 支持多种目标类型（通过 goalType 参数控制）：
 * - goalBlock: 移动到指定方块，玩家站在方块内脚部水平位置
 * - goalNear: 移动到指定位置的指定半径范围内，最常用目标类型
 * - goalXZ: 移动到指定X、Z坐标，不关心具体Y坐标，适用于长距离目标
 * - goalNearXZ: 移动到指定X、Z坐标附近，不关心具体Y坐标，适用于查找建筑
 * - goalY: 移动到指定Y坐标高度，适用于调整垂直位置
 * - goalGetToBlock: 移动到方块旁边（不进入方块），适用于箱子等交互
 * - goalFollow: 跟随实体移动，适用于追踪目标
 * - goalPlaceBlock: 移动到适合放置方块的位置，考虑放置条件
 * - goalLookAtBlock: 移动到可以看到指定方块面的位置
 */
export class MoveAction extends BaseAction<MoveParams> {
  name = 'move';
  description = '移动到指定位置';
  schema = z.object({
    type: z.enum(['coordinate', 'block', 'player', 'entity']).describe('移动类型 (coordinate | block | player | entity)'),
    useRelativeCoords: z.boolean().optional().describe('是否使用相对坐标 (布尔值，可选，默认 false)'),
    x: z.number().int().optional().describe('目标坐标 X (整数，当 type 为 coordinate 时必需)'),
    y: z.number().int().optional().describe('目标坐标 Y (整数，当 type 为 coordinate 时必需)'),
    z: z.number().int().optional().describe('目标坐标 Z (整数，当 type 为 coordinate 时必需)'),
    block: z.string().optional().describe('目标方块名称 (当 type 为 block 时必需)'),
    player: z.string().optional().describe('目标玩家名称 (当 type 为 player 时必需)'),
    entity: z.string().optional().describe('目标实体类型 (当 type 为 entity 时必需)，例如cow,pig,zombie等'),
    distance: z.number().positive().optional().describe('到达距离 (数字，可选，默认 1)'),
    maxDistance: z.number().positive().optional().describe('最大移动距离 (数字，可选，默认 200)'),
    goalType: z.enum([
      'goalBlock', 'goalNear', 'goalXZ', 'goalNearXZ', 'goalY',
      'goalGetToBlock', 'goalFollow', 'goalPlaceBlock', 'goalLookAtBlock'
    ]).optional().describe(`移动目标类型 (可选，默认根据移动类型自动选择)
• goalBlock: 移动到指定方块，玩家站在方块内脚部水平位置
• goalNear: 移动到指定位置的指定半径范围内（最常用）
• goalXZ: 移动到指定X、Z坐标，不关心具体Y坐标
• goalNearXZ: 移动到指定X、Z坐标附近，不关心具体Y坐标
• goalY: 移动到指定Y坐标高度
• goalGetToBlock: 移动到方块旁边（不进入方块），适用于箱子
• goalFollow: 跟随实体移动
• goalPlaceBlock: 移动到适合放置方块的位置
• goalLookAtBlock: 移动到可以看到指定方块面的位置`),
  });

  async execute(bot: Bot, params: MoveParams): Promise<ActionResult> {
    try {
      // 转换参数格式
      const movementParams: MovementParams = {
        type: params.type,
        useRelativeCoords: params.useRelativeCoords,
        x: params.x,
        y: params.y,
        z: params.z,
        block: params.block,
        player: params.player,
        entity: params.entity,
        distance: params.distance,
        maxDistance: params.maxDistance,
        goalType: params.goalType
      };

      // 调用统一的移动工具类
      const result = await MovementUtils.moveTo(bot, movementParams);

      // 返回统一的结构化数据
      return this.createSuccessResult(result.message, result);
    } catch (error) {
      this.logger.error(`移动失败: ${error instanceof Error ? error.message : String(error)}`);
      return this.createExceptionResult(error, '移动失败', 'MOVE_FAILED');
    }
  }
}
