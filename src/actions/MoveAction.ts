import { Bot } from 'mineflayer';
import { BaseAction, BaseActionParams } from '../minecraft/ActionInterface.js';
import { z } from 'zod';
import pathfinder from 'mineflayer-pathfinder';
import { Vec3 } from 'vec3';

interface MoveParams extends BaseActionParams {
  /** 移动类型 */
  type: 'coordinate' | 'block' | 'player' | 'entity';
  /** 是否使用绝对坐标，默认 false (相对坐标) */
  useAbsoluteCoords?: boolean;
  /** 目标坐标 X (当 type 为 coordinate 时必需) */
  x?: number;
  /** 目标坐标 Y (当 type 为 coordinate 时必需) */
  y?: number;
  /** 目标坐标 Z (当 type 为 coordinate 时必需) */
  z?: number;
  /** 目标方块名称 (当 type 为 block 时必需) */
  block?: string;
  /** 目标玩家名称 (当 type 为 player 时必需) */
  player?: string;
  /** 目标实体类型 (当 type 为 entity 时必需) */
  entity?: string;
  /** 到达距离，默认 1 */
  distance?: number;
  /** 超时时间 (秒)，默认 60 */
  timeout?: number;
  /** 最大移动距离，默认 100 */
  maxDistance?: number;
}

/**
 * MoveAction - 移动到指定位置
 * 支持多种移动方式：
 * - coordinate: 移动到指定坐标
 * - block: 移动到指定方块附近
 * - player: 移动到指定玩家附近
 * - entity: 移动到指定实体附近
 */
export class MoveAction extends BaseAction<MoveParams> {
  name = 'move';
  description = '移动到指定位置';
  schema = z.object({
    type: z.enum(['coordinate', 'block', 'player', 'entity']).describe('移动类型 (coordinate | block | player | entity)'),
    useAbsoluteCoords: z.boolean().optional().describe('是否使用绝对坐标 (布尔值，可选，默认 false)'),
    x: z.number().optional().describe('目标坐标 X (当 type 为 coordinate 时必需)'),
    y: z.number().optional().describe('目标坐标 Y (当 type 为 coordinate 时必需)'),
    z: z.number().optional().describe('目标坐标 Z (当 type 为 coordinate 时必需)'),
    block: z.string().optional().describe('目标方块名称 (当 type 为 block 时必需)'),
    player: z.string().optional().describe('目标玩家名称 (当 type 为 player 时必需)'),
    entity: z.string().optional().describe('目标实体类型 (当 type 为 entity 时必需)，例如cow,pig,zombie等'),
    distance: z.number().positive().optional().describe('到达距离 (数字，可选，默认 1)'),
    timeout: z.number().int().positive().optional().describe('超时时间 (秒，可选，默认 60)'),
    maxDistance: z.number().positive().optional().describe('最大移动距离 (数字，可选，默认 100)'),
  });

  async execute(bot: Bot, params: MoveParams): Promise<any> {
    try {
      // 检查 pathfinder 插件
      if (!bot.pathfinder) {
        return this.createErrorResult('路径寻找插件未加载，请先加载 mineflayer-pathfinder 插件', 'PATHFINDER_NOT_LOADED');
      }

      const distance = params.distance ?? 1;
      const timeoutSec = params.timeout ?? 60;
      const useAbsoluteCoords = params.useAbsoluteCoords ?? false;
      const maxDistance = params.maxDistance ?? 100;

      let targetX: number, targetY: number, targetZ: number;
      let targetDescription: string;

      // 根据移动类型确定目标位置
      switch (params.type) {
        case 'coordinate':
          if (params.x === undefined || params.y === undefined || params.z === undefined) {
            return this.createErrorResult('坐标移动需要提供 x, y, z 参数', 'MISSING_COORDINATES');
          }
          
          if (useAbsoluteCoords) {
            targetX = params.x;
            targetY = params.y;
            targetZ = params.z;
          } else {
            // 相对坐标：基于当前位置
            targetX = bot.entity.position.x + params.x;
            targetY = bot.entity.position.y + params.y;
            targetZ = bot.entity.position.z + params.z;
          }
          targetDescription = `坐标 (${targetX}, ${targetY}, ${targetZ})`;
          break;

        case 'block':
          if (!params.block) {
            return this.createErrorResult('方块移动需要提供 block 参数', 'MISSING_BLOCK');
          }
          
          const mcData = bot.registry;
          const blockByName = mcData.blocksByName[params.block];
          if (!blockByName) {
            return this.createErrorResult(`未找到名为 ${params.block} 的方块`, 'BLOCK_NOT_FOUND');
          }

          const blockPositions = bot.findBlocks({
            matching: [blockByName.id],
            maxDistance: 64,
            count: 1
          });

          if (blockPositions.length === 0) {
            return this.createErrorResult(`附近未找到 ${params.block} 方块`, 'BLOCK_NOT_FOUND');
          }

          const blockPos = blockPositions[0];
          targetX = blockPos.x;
          targetY = blockPos.y;
          targetZ = blockPos.z;
          targetDescription = `${params.block} 方块`;
          break;

        case 'player':
          if (!params.player) {
            return this.createErrorResult('玩家移动需要提供 player 参数', 'MISSING_PLAYER');
          }

          const targetPlayer = bot.players[params.player];
          if (!targetPlayer || !targetPlayer.entity) {
            return this.createErrorResult(`未找到玩家 ${params.player}，请确保其在附近`, 'PLAYER_NOT_FOUND');
          }

          targetX = targetPlayer.entity.position.x;
          targetY = targetPlayer.entity.position.y;
          targetZ = targetPlayer.entity.position.z;
          targetDescription = `玩家 ${params.player}`;
          break;

        case 'entity':
          if (!params.entity) {
            return this.createErrorResult('实体移动需要提供 entity 参数', 'MISSING_ENTITY');
          }

          const targetEntity = bot.nearestEntity((e: any) => 
            e.name?.toLocaleLowerCase() === params.entity?.toLocaleLowerCase()
          );
          if (!targetEntity) {
            return this.createErrorResult(`附近未找到 ${params.entity} 类型的实体`, 'ENTITY_NOT_FOUND');
          }

          targetX = targetEntity.position.x;
          targetY = targetEntity.position.y;
          targetZ = targetEntity.position.z;
          targetDescription = `${params.entity} 类型实体`;
          break;

        default:
          return this.createErrorResult(`不支持的移动类型: ${params.type}`, 'INVALID_MOVE_TYPE');
      }

      this.logger.info(`开始移动到 ${targetDescription}，距离: ${distance}，超时: ${timeoutSec}s`);

      // 检查是否已经在目标位置
      const targetPosition = new Vec3(targetX, targetY, targetZ);
      const currentDistance = bot.entity.position.distanceTo(targetPosition);
      
      // 检查距离是否过远
      if (currentDistance > maxDistance) {
        return this.createErrorResult(
          `目标 ${targetDescription} 距离过远 (${currentDistance.toFixed(2)} > ${maxDistance})，无法到达`, 
          'TARGET_TOO_FAR'
        );
      }
      
      if (currentDistance <= distance) {
        return this.createSuccessResult(`已在 ${targetDescription} 附近 (距离: ${currentDistance.toFixed(2)})`, {
          type: params.type,
          target: targetDescription,
          distance: Number(currentDistance.toFixed(2)),
          position: { x: targetX, y: targetY, z: targetZ }
        });
      }

      // 使用 pathfinder 移动到目标位置
      const { GoalNear } = pathfinder.goals;
      if (!GoalNear) {
        return this.createErrorResult('mineflayer-pathfinder goals 未加载', 'PATHFINDER_NOT_LOADED');
      }

      const goal = new GoalNear(targetX, targetY, targetZ, distance);
      
      // 设置超时
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`移动到 ${targetDescription} 超时 (${timeoutSec}s)`)), timeoutSec * 1000);
      });

      try {
        await Promise.race([
          bot.pathfinder.goto(goal),
          timeoutPromise
        ]);

        // 验证是否成功到达
        const finalDistance = bot.entity.position.distanceTo(targetPosition);
        
        if (finalDistance <= distance) {
           this.logger.info(`成功移动到 ${targetDescription} (距离: ${finalDistance.toFixed(2)})`);
           return this.createSuccessResult(`已成功移动到 ${targetDescription}`, {
             type: params.type,
             target: targetDescription,
             distance: Number(finalDistance.toFixed(2)),
             position: { x: targetX, y: targetY, z: targetZ }
           });
         } else {
           return this.createErrorResult(`移动到 ${targetDescription} 失败，最终距离: ${finalDistance.toFixed(2)}`, 'MOVE_FAILED');
         }
      } catch (error) {
        if (error instanceof Error && error.message.includes('超时')) {
          return this.createErrorResult(error.message, 'MOVE_TIMEOUT');
        }
        throw error;
      }
    } catch (error) {
      this.logger.error(`移动失败: ${error instanceof Error ? error.message : String(error)}`);
      return this.createExceptionResult(error, '移动失败', 'MOVE_FAILED');
    }
  }
}
