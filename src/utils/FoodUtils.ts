import { Bot } from 'mineflayer';
import minecraftData from 'minecraft-data';

/**
 * 食物信息接口
 */
export interface FoodInfo {
  id: number;
  name: string;
  displayName: string;
  stackSize: number;
  foodPoints: number;
  saturation: number;
  effectiveQuality: number;
  saturationRatio: number;
}

/**
 * 判断物品是否为食物
 * @param bot mineflayer 机器人实例
 * @param itemName 物品名称（如 "apple", "cooked_beef"）
 * @returns 是否为食物
 */
export function isFoodItem(bot: Bot, itemName: string): boolean {
  try {
    const mcData = minecraftData(bot.version);
    return isFoodItemWithData(mcData, itemName);
  } catch (error) {
    console.error(`判断食物失败: ${error}`);
    return false;
  }
}

/**
 * 使用 minecraft-data 实例判断物品是否为食物
 * @param mcData minecraft-data 实例
 * @param itemName 物品名称
 * @returns 是否为食物
 */
export function isFoodItemWithData(mcData: any, itemName: string): boolean {
  // 方法1：通过 foodsByName 检查
  if (mcData.foodsByName && mcData.foodsByName[itemName]) {
    return true;
  }

  // 方法2：通过物品ID在foods中查找
  if (mcData.itemsByName && mcData.foods) {
    const itemMeta = mcData.itemsByName[itemName];
    if (itemMeta && mcData.foods[itemMeta.id]) {
      return true;
    }
  }

  return false;
}

/**
 * 获取食物信息
 * @param bot mineflayer 机器人实例
 * @param itemName 物品名称
 * @returns 食物信息或 null
 */
export function getFoodInfo(bot: Bot, itemName: string): FoodInfo | null {
  try {
    const mcData = minecraftData(bot.version);
    return getFoodInfoWithData(mcData, itemName);
  } catch (error) {
    console.error(`获取食物信息失败: ${error}`);
    return null;
  }
}

/**
 * 使用 minecraft-data 实例获取食物信息
 * @param mcData minecraft-data 实例
 * @param itemName 物品名称
 * @returns 食物信息或 null
 */
export function getFoodInfoWithData(mcData: any, itemName: string): FoodInfo | null {
  // 方法1：通过 foodsByName 获取
  if (mcData.foodsByName && mcData.foodsByName[itemName]) {
    return mcData.foodsByName[itemName] as FoodInfo;
  }

  // 方法2：通过物品ID在foods中获取
  if (mcData.itemsByName && mcData.foods) {
    const itemMeta = mcData.itemsByName[itemName];
    if (itemMeta && mcData.foods[itemMeta.id]) {
      return mcData.foods[itemMeta.id] as FoodInfo;
    }
  }

  return null;
}

/**
 * 获取所有食物列表
 * @param bot mineflayer 机器人实例
 * @returns 食物信息数组
 */
export function getAllFoods(bot: Bot): FoodInfo[] {
  try {
    const mcData = minecraftData(bot.version);
    if (mcData.foodsArray) {
      return mcData.foodsArray as FoodInfo[];
    }
    return [];
  } catch (error) {
    console.error(`获取食物列表失败: ${error}`);
    return [];
  }
}

/**
 * 获取最佳食物（按有效质量排序）
 * @param bot mineflayer 机器人实例
 * @param limit 返回数量限制，默认返回前10个
 * @returns 最佳食物列表
 */
export function getBestFoods(bot: Bot, limit: number = 10): FoodInfo[] {
  const allFoods = getAllFoods(bot);
  return allFoods
    .sort((a, b) => b.effectiveQuality - a.effectiveQuality)
    .slice(0, limit);
}

/**
 * 判断物品是否为高营养食物（有效质量 >= 10）
 * @param bot mineflayer 机器人实例
 * @param itemName 物品名称
 * @returns 是否为高营养食物
 */
export function isHighNutritionFood(bot: Bot, itemName: string): boolean {
  const foodInfo = getFoodInfo(bot, itemName);
  return foodInfo ? foodInfo.effectiveQuality >= 10 : false;
}

/**
 * 根据饱食度和饥饿值推荐食物
 * @param bot mineflayer 机器人实例
 * @param currentHunger 当前饥饿值 (0-20)
 * @param currentSaturation 当前饱食度
 * @returns 推荐的食物信息
 */
export function recommendFood(bot: Bot, currentHunger: number, currentSaturation: number): FoodInfo | null {
  const allFoods = getAllFoods(bot);

  // 如果饥饿值很低，推荐高饱和度的食物
  if (currentHunger >= 18) {
    return allFoods
      .filter(food => food.saturationRatio >= 1.2)
      .sort((a, b) => b.effectiveQuality - a.effectiveQuality)[0] || null;
  }

  // 如果饥饿值中等，推荐平衡的食物
  if (currentHunger >= 10) {
    return allFoods
      .filter(food => food.effectiveQuality >= 8)
      .sort((a, b) => b.effectiveQuality - a.effectiveQuality)[0] || null;
  }

  // 如果饥饿值很低，推荐快速恢复的食物
  return allFoods
    .filter(food => food.foodPoints >= 4)
    .sort((a, b) => b.effectiveQuality - a.effectiveQuality)[0] || null;
}
