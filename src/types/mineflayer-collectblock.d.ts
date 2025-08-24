import { Bot } from 'mineflayer';
import { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';

export type Callback = (err?: Error) => void;

export interface ItemFilter {
  (item: any): boolean;
}

export interface CollectOptions {
  /**
   * 如果为 true，目标将被追加到现有目标列表而不是开始新任务。默认为 false。
   */
  append?: boolean;
  /**
   * 如果为 true，当无法找到到目标方块的路径时不会抛出错误。
   * 机器人将尝试选择它能找到的最佳可用位置。
   * 如果机器人无法从其最终位置与方块交互，仍会抛出错误。默认为 false。
   */
  ignoreNoPath?: boolean;
  /**
   * 获取当机器人库存满时用于存储物品的箱子位置列表。
   * 如果未定义，默认为 bot.collectBlock 插件上的箱子位置列表。
   */
  chestLocations?: Vec3[];
  /**
   * 将物品转移到箱子时，此过滤器用于确定允许移动哪些物品，
   * 以及不允许移动哪些物品。默认为在 bot.collectBlock 插件上指定的物品过滤器。
   */
  itemFilter?: ItemFilter;
  /**
   * 要收集的物品总数
   */
  count?: number;
}

export type Collectable = Block | any; // Block 或 item drop

export declare class CollectBlock {
  /**
   * 机器人实例
   */
  private readonly bot: Bot;
  
  /**
   * 正在收集的活动目标列表
   */
  private readonly targets: any[];
  
  /**
   * 要发送到 pathfinder 插件的移动配置
   */
  movements?: any;
  
  /**
   * 机器人被允许在其库存满时将库存清空到的箱子位置列表
   */
  chestLocations: Vec3[];
  
  /**
   * 收集物品时，此过滤器用于确定如果机器人库存满时哪些物品应放入箱子。
   * 默认情况下，除工具、武器和盔甲外的所有物品都返回 true。
   */
  itemFilter: ItemFilter;
  
  /**
   * 创建 collect block 插件的新实例
   */
  constructor(bot: Bot);
  
  /**
   * 如果目标是方块：
   * 使机器人破坏并收集目标方块。
   * 
   * 如果目标是物品掉落：
   * 使机器人收集物品掉落。
   * 
   * 如果目标是包含物品或方块的数组，对数组中的所有目标执行正确的操作，
   * 按距离动态排序。
   */
  collect(
    target: Collectable | Collectable[],
    options?: CollectOptions | Callback,
    cb?: Callback
  ): Promise<void>;
  
  /**
   * 加载与给定方块相同类型的所有相邻方块并将它们作为数组返回。
   * 这有效地充当洪水填充算法来检索同一矿脉中的方块等。
   */
  findFromVein(
    block: Block,
    maxBlocks?: number,
    maxDistance?: number,
    floodRadius?: number
  ): Block[];
  
  /**
   * 取消当前收集任务（如果仍然活动）
   */
  cancelTask(cb?: Callback): Promise<void>;
}

// 扩展 Bot 类型以包含 collectBlock 属性
declare module 'mineflayer' {
  interface Bot {
    collectBlock: CollectBlock;
  }
}
