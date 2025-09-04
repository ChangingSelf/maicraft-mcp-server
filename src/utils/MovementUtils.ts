import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import pathfinder from 'mineflayer-pathfinder';
import { Logger } from './Logger.js';


/**
 * 移动参数接口
 */
export interface MovementParams {
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
  /** 目标实体类型 (当 type 为 entity 时必需)，例如cow,pig,zombie等 */
  entity?: string;
  /** 到达距离，默认 1 */
  distance?: number;
  /** 最大移动距离，默认 200 */
  maxDistance?: number;
}

/**
 * 移动结果接口 - 精简的结构化数据
 */
export interface MovementResult {
  /** 是否成功 */
  success: boolean;
  /** 移动类型 */
  type: 'coordinate' | 'block' | 'player' | 'entity';
  /** 目标描述 */
  target: string;
  /** 最终距离目标的距离 */
  distance: number;
  /** 目标坐标 */
  targetPosition: {
    x: number;
    y: number;
    z: number;
  };
  /** 最终 bot 位置坐标 */
  finalPosition: {
    x: number;
    y: number;
    z: number;
  };
  /** 移动状态信息 */
  status: {
    /** 是否已到达目标范围内 */
    reached: boolean;
    /** 是否因距离过远而失败 */
    tooFar: boolean;
    /** 是否因参数错误而失败 */
    invalidParams: boolean;
    /** 是否已在目标范围内（无需移动） */
    alreadyInRange: boolean;
  };
  /** 错误信息（如果有） */
  error?: string;
  /** 详细状态描述 */
  message: string;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 移动工具类
 * 提供统一的移动功能，基于 mineflayer-pathfinder
 */
export class MovementUtils {
  private static logger = new Logger('MovementUtils');

  /**
   * 检查 pathfinder 插件是否可用
   */
  private static checkPathfinderAvailable(bot: Bot): boolean {
    if (!bot.pathfinder) {
      this.logger.error('路径寻找插件未加载，请先加载 mineflayer-pathfinder 插件');
      return false;
    }
    return true;
  }

  /**
   * 验证移动参数
   */
  private static validateMovementParams(params: MovementParams): { isValid: boolean; error?: string } {
    const { type, x, y, z, block, player, entity } = params;

    switch (type) {
      case 'coordinate':
        if (x === undefined || y === undefined || z === undefined) {
          return { isValid: false, error: '坐标移动需要提供 x, y, z 参数' };
        }
        break;
      case 'block':
        if (!block) {
          return { isValid: false, error: '方块移动需要提供 block 参数' };
        }
        break;
      case 'player':
        if (!player) {
          return { isValid: false, error: '玩家移动需要提供 player 参数' };
        }
        break;
      case 'entity':
        if (!entity) {
          return { isValid: false, error: '实体移动需要提供 entity 参数' };
        }
        break;
      default:
        return { isValid: false, error: `不支持的移动类型: ${type}` };
    }

    return { isValid: true };
  }

  /**
   * 计算目标位置
   */
  private static async calculateTargetPosition(
    bot: Bot,
    params: MovementParams
  ): Promise<{ position: Vec3; description: string } | null> {
    const { type, x, y, z, block, player, entity, useRelativeCoords = false } = params;

    switch (type) {
      case 'coordinate': {
        let targetX = x!;
        let targetY = y!;
        let targetZ = z!;

        if (useRelativeCoords) {
          // 相对坐标：基于当前位置，确保方块坐标为整数
          const botPos = bot.entity.position;
          targetX = Math.floor(botPos.x) + targetX;
          targetY = Math.floor(botPos.y) + targetY;
          targetZ = Math.floor(botPos.z) + targetZ;
        }

        const position = new Vec3(targetX, targetY, targetZ);
        const description = `坐标 (${targetX}, ${targetY}, ${targetZ})`;
        return { position, description };
      }

      case 'block': {
        const mcData = bot.registry;
        const blockByName = mcData.blocksByName[block!];
        if (!blockByName) {
          throw new Error(`未找到名为 ${block} 的方块`);
        }

        const blockPositions = bot.findBlocks({
          matching: [blockByName.id],
          maxDistance: 64,
          count: 1
        });

        if (blockPositions.length === 0) {
          throw new Error(`附近未找到 ${block} 方块`);
        }

        const blockPos = blockPositions[0];
        const position = new Vec3(blockPos.x, blockPos.y, blockPos.z);
        const description = `${block} 方块`;
        return { position, description };
      }

      case 'player': {
        const targetPlayer = bot.players[player!];
        if (!targetPlayer || !targetPlayer.entity) {
          throw new Error(`未找到玩家 ${player}，请确保其在附近`);
        }

        const position = targetPlayer.entity.position.clone();
        const description = `玩家 ${player}`;
        return { position, description };
      }

      case 'entity': {
        const targetEntity = bot.nearestEntity((e: any) =>
          e.name?.toLocaleLowerCase() === entity?.toLocaleLowerCase()
        );
        if (!targetEntity) {
          throw new Error(`附近未找到 ${entity} 类型的实体`);
        }

        const position = targetEntity.position.clone();
        const description = `${entity} 类型实体`;
        return { position, description };
      }

      default:
        throw new Error(`不支持的移动类型: ${type}`);
    }
  }

  /**
   * 执行移动操作
   */
  static async moveTo(
    bot: Bot,
    params: MovementParams
  ): Promise<MovementResult> {
    try {
      // 检查 pathfinder 插件
      if (!this.checkPathfinderAvailable(bot)) {
        const botPos = bot.entity.position;
        return {
          success: false,
          type: params.type,
          target: '未知目标',
          distance: 0,
          targetPosition: { x: 0, y: 0, z: 0 },
          finalPosition: {
            x: Number(botPos.x.toFixed(2)),
            y: Number(botPos.y.toFixed(2)),
            z: Number(botPos.z.toFixed(2))
          },
          status: {
            reached: false,
            tooFar: false,
            invalidParams: false,
            alreadyInRange: false
          },
          error: 'PATHFINDER_NOT_LOADED',
          message: '路径寻找插件未加载，请先加载 mineflayer-pathfinder 插件',
          timestamp: Date.now()
        };
      }

      // 验证参数
      const validation = this.validateMovementParams(params);
      if (!validation.isValid) {
        const botPos = bot.entity.position;
        return {
          success: false,
          type: params.type,
          target: '未知目标',
          distance: 0,
          targetPosition: { x: 0, y: 0, z: 0 },
          finalPosition: {
            x: Number(botPos.x.toFixed(2)),
            y: Number(botPos.y.toFixed(2)),
            z: Number(botPos.z.toFixed(2))
          },
          status: {
            reached: false,
            tooFar: false,
            invalidParams: true,
            alreadyInRange: false
          },
          error: validation.error,
          message: validation.error || '参数验证失败',
          timestamp: Date.now()
        };
      }

      const distance = params.distance ?? 1;
      const maxDistance = params.maxDistance ?? 200;

      // 计算目标位置
      const targetResult = await this.calculateTargetPosition(bot, params);
      if (!targetResult) {
        const botPos = bot.entity.position;
        return {
          success: false,
          type: params.type,
          target: '未知目标',
          distance: 0,
          targetPosition: { x: 0, y: 0, z: 0 },
          finalPosition: {
            x: Number(botPos.x.toFixed(2)),
            y: Number(botPos.y.toFixed(2)),
            z: Number(botPos.z.toFixed(2))
          },
          status: {
            reached: false,
            tooFar: false,
            invalidParams: true,
            alreadyInRange: false
          },
          error: 'CALCULATE_TARGET_FAILED',
          message: '计算目标位置失败',
          timestamp: Date.now()
        };
      }

      const { position: targetPosition, description: targetDescription } = targetResult;

      this.logger.info(`开始移动到 ${targetDescription}，距离: ${distance}`);

      // 检查是否已经在目标位置
      const currentDistance = bot.entity.position.distanceTo(targetPosition);

      // 检查距离是否过远
      if (currentDistance > maxDistance) {
        const botPos = bot.entity.position;
        return {
          success: false,
          type: params.type,
          target: targetDescription,
          distance: Number(currentDistance.toFixed(2)),
          targetPosition: {
            x: Number(targetPosition.x.toFixed(2)),
            y: Number(targetPosition.y.toFixed(2)),
            z: Number(targetPosition.z.toFixed(2))
          },
          finalPosition: {
            x: Number(botPos.x.toFixed(2)),
            y: Number(botPos.y.toFixed(2)),
            z: Number(botPos.z.toFixed(2))
          },
          status: {
            reached: false,
            tooFar: true,
            invalidParams: false,
            alreadyInRange: false
          },
          error: `目标距离过远 (${currentDistance.toFixed(2)} > ${maxDistance})，无法到达`,
          message: `目标距离过远 (${currentDistance.toFixed(2)} > ${maxDistance})，无法到达`,
          timestamp: Date.now()
        };
      }

      if (currentDistance <= distance) {
        const botPos = bot.entity.position;
        return {
          success: true,
          type: params.type,
          target: targetDescription,
          distance: Number(currentDistance.toFixed(2)),
          targetPosition: {
            x: Number(targetPosition.x.toFixed(2)),
            y: Number(targetPosition.y.toFixed(2)),
            z: Number(targetPosition.z.toFixed(2))
          },
          finalPosition: {
            x: Number(botPos.x.toFixed(2)),
            y: Number(botPos.y.toFixed(2)),
            z: Number(botPos.z.toFixed(2))
          },
          status: {
            reached: true,
            tooFar: false,
            invalidParams: false,
            alreadyInRange: true
          },
          message: `已在 ${targetDescription} 范围内，距离: ${currentDistance.toFixed(2)}`,
          timestamp: Date.now()
        };
      }

      // 使用 pathfinder 移动到目标位置
      const { GoalNear } = pathfinder.goals;
      if (!GoalNear) {
        const botPos = bot.entity.position;
        return {
          success: false,
          type: params.type,
          target: targetDescription,
          distance: 0,
          targetPosition: {
            x: Number(targetPosition.x.toFixed(2)),
            y: Number(targetPosition.y.toFixed(2)),
            z: Number(targetPosition.z.toFixed(2))
          },
          finalPosition: {
            x: Number(botPos.x.toFixed(2)),
            y: Number(botPos.y.toFixed(2)),
            z: Number(botPos.z.toFixed(2))
          },
          status: {
            reached: false,
            tooFar: false,
            invalidParams: false,
            alreadyInRange: false
          },
          error: 'mineflayer-pathfinder goals 未加载',
          message: 'mineflayer-pathfinder goals 未加载',
          timestamp: Date.now()
        };
      }

      const goal = new GoalNear(targetPosition.x, targetPosition.y, targetPosition.z, distance);

      try {
        await bot.pathfinder.goto(goal);

        // 验证是否成功到达
        const finalDistance = bot.entity.position.distanceTo(targetPosition);
        const botPos = bot.entity.position;

        if (finalDistance <= distance) {
          this.logger.info(`成功移动到 ${targetDescription} (距离: ${finalDistance.toFixed(2)})`);
          return {
            success: true,
            type: params.type,
            target: targetDescription,
            distance: Number(finalDistance.toFixed(2)),
            targetPosition: {
              x: Number(targetPosition.x.toFixed(2)),
              y: Number(targetPosition.y.toFixed(2)),
              z: Number(targetPosition.z.toFixed(2))
            },
            finalPosition: {
              x: Number(botPos.x.toFixed(2)),
              y: Number(botPos.y.toFixed(2)),
              z: Number(botPos.z.toFixed(2))
            },
            status: {
              reached: true,
              tooFar: false,
              invalidParams: false,
              alreadyInRange: false
            },
            message: `成功移动到 ${targetDescription}，距离: ${finalDistance.toFixed(2)}`,
            timestamp: Date.now()
          };
        } else {
          this.logger.info(`移动完成，最终距离: ${finalDistance.toFixed(2)} (目标距离: ${distance})`);
          return {
            success: true,
            type: params.type,
            target: targetDescription,
            distance: Number(finalDistance.toFixed(2)),
            targetPosition: {
              x: Number(targetPosition.x.toFixed(2)),
              y: Number(targetPosition.y.toFixed(2)),
              z: Number(targetPosition.z.toFixed(2))
            },
            finalPosition: {
              x: Number(botPos.x.toFixed(2)),
              y: Number(botPos.y.toFixed(2)),
              z: Number(botPos.z.toFixed(2))
            },
            status: {
              reached: false,
              tooFar: false,
              invalidParams: false,
              alreadyInRange: false
            },
            error: `移动完成，最终距离: ${finalDistance.toFixed(2)}`,
            message: `移动完成，最终距离: ${finalDistance.toFixed(2)} (目标距离: ${distance})`,
            timestamp: Date.now()
          };
        }
      } catch (error) {
        throw error;
      }
    } catch (error) {
      this.logger.error(`移动失败: ${error instanceof Error ? error.message : String(error)}`);
      const botPos = bot.entity.position;
      return {
        success: false,
        type: params.type,
        target: '未知目标',
        distance: 0,
        targetPosition: { x: 0, y: 0, z: 0 },
        finalPosition: {
          x: Number(botPos.x.toFixed(2)),
          y: Number(botPos.y.toFixed(2)),
          z: Number(botPos.z.toFixed(2))
        },
        status: {
          reached: false,
          tooFar: false,
          invalidParams: false,
          alreadyInRange: false
        },
        error: error instanceof Error ? error.message : String(error),
        message: `移动失败: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now()
      };
    }
  }

  /**
   * 移动到方块附近（用于挖掘、交互等）
   */
  static async moveToBlock(
    bot: Bot,
    blockName: string,
    distance: number = 4,
    maxDistance: number = 64
  ): Promise<MovementResult> {
    return this.moveTo(bot, {
      type: 'block',
      block: blockName,
      distance,
      maxDistance
    });
  }

  /**
   * 移动到玩家附近
   */
  static async moveToPlayer(
    bot: Bot,
    playerName: string,
    distance: number = 3,
    maxDistance: number = 100
  ): Promise<MovementResult> {
    return this.moveTo(bot, {
      type: 'player',
      player: playerName,
      distance,
      maxDistance
    });
  }

  /**
   * 移动到实体附近
   */
  static async moveToEntity(
    bot: Bot,
    entityName: string,
    distance: number = 2,
    maxDistance: number = 50
  ): Promise<MovementResult> {
    return this.moveTo(bot, {
      type: 'entity',
      entity: entityName,
      distance,
      maxDistance
    });
  }

  /**
   * 移动到指定坐标
   */
  static async moveToCoordinate(
    bot: Bot,
    x: number,
    y: number,
    z: number,
    distance: number = 1,
    maxDistance: number = 200,
    useRelativeCoords: boolean = false
  ): Promise<MovementResult> {
    return this.moveTo(bot, {
      type: 'coordinate',
      x,
      y,
      z,
      distance,
      maxDistance,
      useRelativeCoords
    });
  }
}
