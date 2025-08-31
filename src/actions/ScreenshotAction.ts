import { Bot } from 'mineflayer';
import { BaseAction, BaseActionParams, ActionResult } from '../minecraft/ActionInterface.js';
import { z } from 'zod';
import { ViewerManager } from '../minecraft/ViewerManager.js';

/**
 * 截图动作参数接口（无参数）
 */
interface ScreenshotParams extends BaseActionParams {
  // 无参数，配置来自配置文件
}

/**
 * 截图动作类
 * 使用预初始化的ViewerManager生成当前时刻的第一视角截图并返回base64格式
 */
export class ScreenshotAction extends BaseAction<ScreenshotParams> {
  name = 'screenshot';
  description = '生成当前时刻的第一人称截图并以base64格式返回';

  /** 参数校验schema（空schema表示无参数） */
  schema = z.object({});

  /**
   * 执行截图动作
   * @param bot Mineflayer机器人实例
   * @param params 动作参数（无参数）
   * @returns 包含base64截图数据的动作结果
   */
  async execute(bot: Bot, params: ScreenshotParams): Promise<ActionResult> {
    try {
      this.logger.info('开始生成第一人称截图');

      // 验证机器人连接状态
      if (!bot || !bot.entity) {
        this.logger.error('机器人未连接或未生成实体');
        return this.createErrorResult('机器人未连接到服务器', 'BOT_NOT_CONNECTED');
      }

      // 验证机器人是否在游戏中
      if (!bot.player || bot.player.gamemode === 3) { // 3 为旁观者模式
        this.logger.warn('机器人处于旁观者模式，可能无法正常生成第一人称截图');
        return this.createErrorResult('机器人处于旁观者模式，无法生成截图', 'BOT_IN_SPECTATOR_MODE');
      }

      // 获取预初始化的ViewerManager，参考QueryRecentEventsAction的方式
      const client = (bot as any).client as any;
      if (!client || !client.getViewerManager) {
        this.logger.warn('无法获取 ViewerManager，返回空结果');
        return this.createSuccessResult('ViewerManager 未初始化，请稍后重试', {
          format: 'base64',
          data: null,
          timestamp: new Date().toISOString(),
          error: 'VIEWER_NOT_READY'
        });
      }

      const viewerManager = client.getViewerManager();
      if (!viewerManager) {
        this.logger.warn('ViewerManager 未初始化，返回空结果');
        return this.createSuccessResult('ViewerManager 未初始化，请检查配置文件', {
          format: 'base64',
          data: null,
          timestamp: new Date().toISOString(),
          error: 'VIEWER_NOT_INITIALIZED'
        });
      }

      if (!viewerManager.isReady()) {
        this.logger.error('ViewerManager 尚未准备就绪，请等待 Minecraft 客户端完全连接');
        return this.createErrorResult('ViewerManager 尚未准备就绪，请稍后重试', 'VIEWER_NOT_READY');
      }

      // 生成截图（内部会自动同步相机位置）
      const screenshotData = await viewerManager.takeScreenshot('base64');

      // 验证截图数据
      if (!screenshotData || typeof screenshotData !== 'string' || !screenshotData.startsWith('data:image/png;base64,')) {
        this.logger.error('生成的截图数据格式不正确');
        return this.createErrorResult('截图数据格式不正确', 'INVALID_SCREENSHOT_DATA');
      }

      this.logger.info('截图生成成功');
      return this.createSuccessResult('截图生成成功', {
        format: 'base64',
        data: screenshotData,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      // 更详细的错误分类处理
      if (error instanceof Error) {
        if (error.message.includes('视图管理器未初始化')) {
          this.logger.error('ViewerManager未初始化');
          return this.createErrorResult('视图管理器未初始化，请重试', 'VIEWER_NOT_INITIALIZED');
        } else if (error.message.includes('不支持的Minecraft版本')) {
          this.logger.error('不支持的Minecraft版本');
          return this.createErrorResult('当前Minecraft版本不支持截图功能', 'UNSUPPORTED_VERSION');
        } else if (error.message.includes('canvas') || error.message.includes('renderer')) {
          this.logger.error('渲染系统错误');
          return this.createErrorResult('渲染系统初始化失败', 'RENDER_SYSTEM_ERROR');
        }
      }

      this.logger.error(`截图生成失败: ${error instanceof Error ? error.message : String(error)}`);
      return this.createExceptionResult(error, '截图生成失败', 'TAKE_SCREENSHOT_FAILED');
    }
  }
}
