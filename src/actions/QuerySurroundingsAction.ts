import { Bot } from 'mineflayer';
import { BaseAction, BaseActionParams, ActionResult } from '../minecraft/ActionInterface.js';
import { z } from 'zod';
import { Vec3 } from 'vec3';

interface QuerySurroundingsParams extends BaseActionParams {
  range?: number;
  includePlayers?: boolean;
  includeEntities?: boolean;
  includeBlocks?: boolean;
  blockRange?: number;
  entityTypes?: string[];
}

export class QuerySurroundingsAction extends BaseAction<QuerySurroundingsParams> {
  name = 'querySurroundings';
  description = '查询周围环境信息，包括附近玩家、实体、方块等';
  schema = z.object({
    range: z.number().min(1).max(50).optional().describe('查询范围（1-50格）'),
    includePlayers: z.boolean().optional().describe('是否包含附近玩家'),
    includeEntities: z.boolean().optional().describe('是否包含附近实体'),
    includeBlocks: z.boolean().optional().describe('是否包含附近方块'),
    blockRange: z.number().min(1).max(10).optional().describe('方块查询范围（1-10格）'),
    entityTypes: z.array(z.string()).optional().describe('实体类型过滤（如：player, mob, animal等）'),
  });

  async execute(bot: Bot, params: QuerySurroundingsParams): Promise<ActionResult> {
    try {
      this.logger.info('查询周围环境信息');
      
      const range = params.range || 10;
      const blockRange = params.blockRange || 5;
      const result: any = {};

      // 查询附近玩家
      if (params.includePlayers !== false) {
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
            displayName: player.displayName?.toString(),
            uuid: player.uuid,
            ping: player.ping,
            gamemode: player.gamemode,
            position: {
              x: player.entity.position.x,
              y: player.entity.position.y,
              z: player.entity.position.z
            },
            distance: bot.entity.position.distanceTo(player.entity.position)
          }))
          .sort((a, b) => a.distance - b.distance);

        result.players = {
          count: nearbyPlayers.length,
          list: nearbyPlayers
        };
      }

      // 查询附近实体
      if (params.includeEntities !== false) {
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
          id: entity.id,
          type: entity.type,
          name: entity.name || entity.type,
          position: {
            x: entity.position.x,
            y: entity.position.y,
            z: entity.position.z
          },
          distance: bot.entity.position.distanceTo(entity.position),
          health: entity.health,
          maxHealth: (entity as any).maxHealth || entity.health
        }))
        .sort((a, b) => a.distance - b.distance);

        result.entities = {
          count: entitiesList.length,
          list: entitiesList
        };
      }

      // 查询附近方块
      if (params.includeBlocks !== false) {
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
                if (block && block.type !== 0) { // 不是空气方块
                  const distance = Math.sqrt(x * x + y * y + z * z);
                  nearbyBlocks.push({
                    type: block.type,
                    name: block.name,
                    position: {
                      x: blockX,
                      y: blockY,
                      z: blockZ
                    },
                    distance,
                    hardness: block.hardness,
                    material: block.material
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
      }

      this.logger.info('成功查询周围环境信息');
      return this.createSuccessResult('成功查询周围环境信息', result);
    } catch (error) {
      this.logger.error(`查询周围环境失败: ${error instanceof Error ? error.message : String(error)}`);
      return this.createExceptionResult(error, '查询周围环境失败', 'QUERY_SURROUNDINGS_FAILED');
    }
  }
}
