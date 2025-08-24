import { Bot } from 'mineflayer';
import { BaseAction, BaseActionParams, ActionResult } from '../minecraft/ActionInterface.js';
import { z } from 'zod';
import { Vec3 } from 'vec3';

interface QuerySurroundingsParams extends BaseActionParams {
  range?: number;
  type: 'players' | 'entities' | 'blocks';
  blockRange?: number;
  entityTypes?: string[];
}

export class QuerySurroundingsAction extends BaseAction<QuerySurroundingsParams> {
  name = 'querySurroundings';
  description = '查询周围环境信息，包括附近玩家、实体、方块等';
  schema = z.object({
    type: z.enum(['players', 'entities', 'blocks']).describe('要查询的环境信息类型（必填）：players(玩家)、entities(实体)、blocks(方块)'),
    range: z.number().min(1).max(50).optional().describe('玩家、实体查询范围（1-50格），默认10格'),
    blockRange: z.number().min(1).max(10).optional().describe('方块查询范围（1-10格），默认5格'),
    entityTypes: z.array(z.string()).optional().describe('实体类型过滤，可填多个（如：player, mob, animal等）'),
  });

  async execute(bot: Bot, params: QuerySurroundingsParams): Promise<ActionResult> {
    try {
      this.logger.info(`查询周围环境信息 - 类型: ${params.type}`);
      
      const range = params.range || 10;
      const blockRange = params.blockRange || 5;
      const result: any = {};

      switch (params.type) {
        case 'players':
          // 查询附近玩家
          const nearbyPlayers = Object.values(bot.players)
            .filter(player => {
              if (!player.entity || player.username === bot.username) {
                return false;
              }
              const distance = bot.entity.position.distanceTo(player.entity.position);
              return distance <= range;
            })
            .map(player => ({
              username: player.username,
              position: {
                x: Number(player.entity.position.x.toFixed(2)),
                y: Number(player.entity.position.y.toFixed(2)),
                z: Number(player.entity.position.z.toFixed(2))
              },
              distance: Number(bot.entity.position.distanceTo(player.entity.position).toFixed(2))
            }))
            .sort((a, b) => a.distance - b.distance);

          result.players = {
            count: nearbyPlayers.length,
            list: nearbyPlayers
          };
          break;

        case 'entities':
          // 查询附近实体
          let nearbyEntities = Object.values(bot.entities)
            .filter(entity => {
              if (!entity.position || entity.id === bot.entity.id) {
                return false;
              }
              const distance = bot.entity.position.distanceTo(entity.position);
              return distance <= range;
            });

          // 实体类型过滤
          if (params.entityTypes && params.entityTypes.length > 0) {
            nearbyEntities = nearbyEntities.filter(entity => 
              params.entityTypes!.includes(entity.type)
            );
          }

          const entitiesList = nearbyEntities.map(entity => ({
            // id: entity.id,
            type: entity.type,
            name: entity.name || entity.type,
            position: {
              x: Number(entity.position.x.toFixed(2)),
              y: Number(entity.position.y.toFixed(2)),
              z: Number(entity.position.z.toFixed(2))
            },
            distance: Number(bot.entity.position.distanceTo(entity.position).toFixed(2)),
            health: Number((entity.health || 0).toFixed(2)),
            maxHealth: Number(((entity as any).maxHealth || entity.health || 0).toFixed(2))
          }))
          .sort((a, b) => a.distance - b.distance);

          result.entities = {
            count: entitiesList.length,
            list: entitiesList
          };
          break;

        case 'blocks':
          // 查询附近方块
          const nearbyBlocks: any[] = [];
          const centerX = Math.floor(bot.entity.position.x);
          const centerY = Math.floor(bot.entity.position.y);
          const centerZ = Math.floor(bot.entity.position.z);

          for (let x = -blockRange; x <= blockRange; x++) {
            for (let y = -blockRange; y <= blockRange; y++) {
              for (let z = -blockRange; z <= blockRange; z++) {
                const blockX = centerX + x;
                const blockY = centerY + y;
                const blockZ = centerZ + z;
                
                try {
                  const block = bot.blockAt(new Vec3(blockX, blockY, blockZ));
                  if (block && block.name !== 'air') { // 不是空气方块
                    const distance = Math.sqrt(x * x + y * y + z * z);
                    nearbyBlocks.push({
                      name: block.name,
                      position: {
                        x: blockX,
                        y: blockY,
                        z: blockZ
                      },
                      distance: Number(distance.toFixed(2)),
                    });
                  }
                } catch (error) {
                  // 忽略无法访问的方块
                }
              }
            }
          }

          // 按距离排序并限制数量
          nearbyBlocks.sort((a, b) => a.distance - b.distance);
          result.blocks = {
            count: nearbyBlocks.length,
            list: nearbyBlocks.slice(0, 100) // 限制返回数量
          };
          break;

        default:
          throw new Error(`不支持的环境信息类型: ${params.type}`);
      }

      this.logger.info(`成功查询周围环境信息 - 类型: ${params.type}`);
      return this.createSuccessResult(`成功查询周围环境信息 - 类型: ${params.type}`, result);
    } catch (error) {
      this.logger.error(`查询周围环境失败: ${error instanceof Error ? error.message : String(error)}`);
      return this.createExceptionResult(error, '查询周围环境失败', 'QUERY_SURROUNDINGS_FAILED');
    }
  }
}
