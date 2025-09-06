import { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import pathfinder from 'mineflayer-pathfinder-mai';
import { Logger } from './Logger.js';

/**
 * 移动目标类型枚举 - 基于 mineflayer-pathfinder-mai 的目标类型
 */
export enum GoalType {
  /** goalBlock: 移动到指定方块，玩家站在方块内脚部水平位置 */
  GoalBlock = 'goalBlock',
  /** goalNear: 移动到指定位置的指定半径范围内 */
  GoalNear = 'goalNear',
  /** goalXZ: 移动到指定X、Z坐标，不关心具体Y坐标 */
  GoalXZ = 'goalXZ',
  /** goalNearXZ: 移动到指定X、Z坐标附近，不关心具体Y坐标 */
  GoalNearXZ = 'goalNearXZ',
  /** goalY: 移动到指定Y坐标高度 */
  GoalY = 'goalY',
  /** goalGetToBlock: 移动到方块旁边（不进入方块），适用于箱子等交互 */
  GoalGetToBlock = 'goalGetToBlock',
  /** goalFollow: 跟随实体移动 */
  GoalFollow = 'goalFollow',
  /** goalPlaceBlock: 移动到适合放置方块的位置 */
  GoalPlaceBlock = 'goalPlaceBlock',
  /** goalLookAtBlock: 移动到可以看到指定方块面的位置 */
  GoalLookAtBlock = 'goalLookAtBlock'
}


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
  /** 移动目标类型，默认根据移动类型自动选择 */
  goalType?: GoalType;
  /** GoalPlaceBlock 的额外参数 */
  placeBlockOptions?: {
    /** 参照方块位置 */
    referencePosition?: Vec3;
    /** 放置面向向量 */
    faceVector?: Vec3;
    /** 放置选项 */
    options?: {
      range?: number;
      LOS?: boolean;
      faces?: Vec3[];
      facing?: string;
    };
  };
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
 * 提供统一的移动功能，基于 mineflayer-pathfinder-mai
 */
export class MovementUtils {
  private static logger = new Logger('MovementUtils');

  /**
   * 检查 pathfinder 插件是否可用
   */
  private static checkPathfinderAvailable(bot: Bot): boolean {
    if (!bot.pathfinder) {
      this.logger.error('路径寻找插件未加载，请先加载 mineflayer-pathfinder-mai 插件');
      return false;
    }
    return true;
  }

  /**
   * 根据移动类型和参数确定目标类型
   */
  private static determineGoalType(params: MovementParams): GoalType {
    // 如果用户指定了目标类型，直接使用
    if (params.goalType) {
      return params.goalType;
    }

    // 根据移动类型选择默认的目标类型
    switch (params.type) {
      case 'coordinate':
        return GoalType.GoalNear; // 移动到坐标附近
      case 'block':
        return GoalType.GoalNearXZ; // 移动到方块所在XZ位置附近，Y坐标自适应
      case 'player':
      case 'entity':
        return GoalType.GoalFollow; // 跟随玩家或实体
      default:
        return GoalType.GoalNear; // 默认使用 GoalNear
    }
  }

  /**
   * 根据目标类型创建相应的路径寻找目标
   */
  private static createGoal(goalType: GoalType, targetPosition: Vec3, distance: number, params: MovementParams, bot: Bot): any {
    const { GoalBlock, GoalNear, GoalXZ, GoalNearXZ, GoalY, GoalGetToBlock, GoalFollow, GoalPlaceBlock, GoalLookAtBlock } = pathfinder.goals;

    switch (goalType) {
      case GoalType.GoalBlock:
        return new GoalBlock(targetPosition.x, targetPosition.y, targetPosition.z);

      case GoalType.GoalNear:
        return new GoalNear(targetPosition.x, targetPosition.y, targetPosition.z, distance);

      case GoalType.GoalXZ:
        return new GoalXZ(targetPosition.x, targetPosition.z);

      case GoalType.GoalNearXZ:
        return new GoalNearXZ(targetPosition.x, targetPosition.z, distance);

      case GoalType.GoalY:
        return new GoalY(targetPosition.y);

      case GoalType.GoalGetToBlock:
        return new GoalGetToBlock(targetPosition.x, targetPosition.y, targetPosition.z);

      case GoalType.GoalFollow:
        // 对于跟随目标，需要找到实体
        if (params.type === 'player' || params.type === 'entity') {
          let entity = null;
          if (params.type === 'player' && params.player) {
            entity = bot.players[params.player]?.entity;
          } else if (params.type === 'entity' && params.entity) {
            entity = bot.nearestEntity((e: any) =>
              e.name?.toLocaleLowerCase() === params.entity?.toLocaleLowerCase()
            );
          }

          if (entity) {
            return new GoalFollow(entity, distance);
          } else {
            // 如果找不到实体，回退到 GoalNear
            this.logger.warn(`找不到实体，使用 GoalNear 作为回退目标`);
            return new GoalNear(targetPosition.x, targetPosition.y, targetPosition.z, distance);
          }
        } else {
          // 非实体移动类型，回退到 GoalNear
          return new GoalNear(targetPosition.x, targetPosition.y, targetPosition.z, distance);
        }

      case GoalType.GoalPlaceBlock:
        const world = bot.world;
        if (!world) {
          this.logger.warn('无法获取世界信息，使用 GoalNear 作为回退目标');
          return new GoalNear(targetPosition.x, targetPosition.y, targetPosition.z, distance);
        }

        // 检查是否有传入的参照方块信息
        const placeBlockOptions = params.placeBlockOptions;
        if (placeBlockOptions?.referencePosition && placeBlockOptions?.faceVector) {
          // 使用传入的参照方块信息
          const options = {
            range: placeBlockOptions.options?.range ?? 4.5,
            LOS: placeBlockOptions.options?.LOS ?? true,
            faces: placeBlockOptions.options?.faces ?? [placeBlockOptions.faceVector],
            facing: (placeBlockOptions.options?.facing ?? 'up') as 'up' | 'north' | 'east' | 'south' | 'west' | 'down'
          };
          return new GoalPlaceBlock(targetPosition, world, options);
        } else {
          // 回退到旧的逻辑（向后兼容）
          this.logger.warn('未提供参照方块信息，使用旧的查找逻辑');

          // 查找参照方块（用于放置方块）
          const referenceBlock = bot.blockAt(targetPosition.offset(0, -1, 0)); // 假设在目标位置下方放置
          if (referenceBlock) {
            return new GoalPlaceBlock(targetPosition, world, {
              range: 4.5,
              LOS: true,
              faces: [
                new Vec3(0, 1, 0),   // up
                new Vec3(0, -1, 0),  // down
                new Vec3(0, 0, -1),  // north
                new Vec3(0, 0, 1),   // south
                new Vec3(1, 0, 0),   // east
                new Vec3(-1, 0, 0)   // west
              ],
              facing: 'up'
            });
          } else {
            this.logger.warn('找不到参照方块，使用 GoalNear 作为回退目标');
            return new GoalNear(targetPosition.x, targetPosition.y, targetPosition.z, distance);
          }
        }

      case GoalType.GoalLookAtBlock:
        const worldForLook = bot.world;
        if (!worldForLook) {
          this.logger.warn('无法获取世界信息，使用 GoalNear 作为回退目标');
          return new GoalNear(targetPosition.x, targetPosition.y, targetPosition.z, distance);
        }

        const blockToLookAt = bot.blockAt(targetPosition);
        if (blockToLookAt) {
          return new GoalLookAtBlock(targetPosition, worldForLook, { reach: distance });
        } else {
          this.logger.warn('找不到要看向的方块，使用 GoalNear 作为回退目标');
          return new GoalNear(targetPosition.x, targetPosition.y, targetPosition.z, distance);
        }

      default:
        this.logger.warn(`不支持的目标类型: ${goalType}，使用 GoalNear 作为默认目标`);
        return new GoalNear(targetPosition.x, targetPosition.y, targetPosition.z, distance);
    }
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
          message: '路径寻找插件未加载，请先加载 mineflayer-pathfinder-mai 插件',
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

      // 根据目标类型创建相应的目标
      const goalType = this.determineGoalType(params);
      const goal = this.createGoal(goalType, targetPosition, distance, params, bot);

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
