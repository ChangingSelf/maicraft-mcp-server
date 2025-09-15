import WebSocket, { WebSocketServer } from 'ws';
import { Logger, LogLevel } from './Logger.js';

interface Subscription {
  active: boolean; // 简化：只表示是否订阅
}

interface WebSocketClient {
  ws: WebSocket;
  subscription: Subscription | null;
}

interface LogMessage {
  type: 'log';
  timestamp: number;
  level: string;
  module: string;
  message: string;
}

interface SubscriptionMessage {
  type: 'subscribe';
}

type ClientMessage = SubscriptionMessage;

/**
 * WebSocket日志服务器
 * 提供实时日志推送服务，客户端订阅后将接收所有日志消息
 */
export class WebSocketLogServer {
  private server: WebSocketServer | null = null;
  private clients: Map<WebSocket, WebSocketClient> = new Map();
  private logger: Logger;
  private port: number;
  private isRunning = false;

  constructor(port: number = 20915, logger?: Logger) {
    this.port = port;
    this.logger = logger || new Logger('WebSocketLogServer');
  }

  /**
   * 启动WebSocket服务器
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('WebSocket日志服务器已在运行');
      return;
    }

    try {
      this.server = new WebSocketServer({ port: this.port });

      this.server.on('connection', (ws: WebSocket) => {
        this.handleConnection(ws);
      });

      this.server.on('error', (error) => {
        this.logger.error('WebSocket服务器错误:', error);
      });

      this.isRunning = true;
      this.logger.info(`WebSocket日志服务器已启动，监听端口: ${this.port}`);
      this.logger.info(`日志推送地址: ws://localhost:${this.port}/ws/mcp-logs`);
    } catch (error) {
      this.logger.error('启动WebSocket服务器失败:', error);
      throw error;
    }
  }

  /**
   * 停止WebSocket服务器
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    // 关闭所有客户端连接
    for (const [ws] of this.clients) {
      ws.close();
    }

    // 关闭服务器
    if (this.server) {
      this.server.close();
      this.server = null;
    }

    this.clients.clear();
    this.isRunning = false;
    this.logger.info('WebSocket日志服务器已停止');
  }

  /**
   * 推送日志消息给所有订阅的客户端
   */
  pushLog(level: string, module: string, message: string): void {
    if (!this.isRunning) {
      return;
    }

    const logMessage: LogMessage = {
      type: 'log',
      timestamp: Date.now(),
      level,
      module,
      message
    };

    const messageStr = JSON.stringify(logMessage);
    let sentCount = 0;

    for (const [ws, client] of this.clients) {
      if (this.shouldSendToClient(client, level, module)) {
        try {
          ws.send(messageStr);
          sentCount++;
        } catch (error) {
          this.logger.warn('推送日志消息失败:', error);
          // 清理失败的连接
          this.handleDisconnection(ws);
        }
      }
    }

    if (sentCount > 0) {
      this.logger.debug(`推送日志消息给 ${sentCount} 个客户端`);
    }
  }

  /**
   * 检查是否应该发送消息给指定客户端
   */
  private shouldSendToClient(client: WebSocketClient, level: string, module: string): boolean {
    // 简化逻辑：只要客户端订阅了，就发送所有日志
    return client.subscription?.active === true;
  }

  /**
   * 处理新的WebSocket连接
   */
  private handleConnection(ws: WebSocket): void {
    const client: WebSocketClient = {
      ws,
      subscription: null
    };

    this.clients.set(ws, client);
    this.logger.info(`新客户端连接，当前连接数: ${this.clients.size}`);

    ws.on('message', (data: Buffer) => {
      this.handleMessage(ws, data);
    });

    ws.on('close', () => {
      this.handleDisconnection(ws);
    });

    ws.on('error', (error) => {
      this.logger.warn('客户端连接错误:', error);
      this.handleDisconnection(ws);
    });
  }

  /**
   * 处理客户端消息
   */
  private handleMessage(ws: WebSocket, data: Buffer): void {
    try {
      const message: ClientMessage = JSON.parse(data.toString());

      switch (message.type) {
        case 'subscribe':
          this.handleSubscription(ws, message);
          break;
        default:
          this.logger.warn('未知的消息类型:', message.type);
      }
    } catch (error) {
      this.logger.warn('解析客户端消息失败:', error);
      // 发送错误响应
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }));
    }
  }

  /**
   * 处理订阅消息
   */
  private handleSubscription(ws: WebSocket, message: SubscriptionMessage): void {
    const client = this.clients.get(ws);
    if (!client) {
      return;
    }

    // 简化：直接设置订阅状态
    client.subscription = {
      active: true
    };

    // 发送确认消息
    ws.send(JSON.stringify({
      type: 'subscribed',
      message: 'Successfully subscribed to logs'
    }));

    this.logger.info('客户端订阅成功 - 将接收所有日志消息');
  }

  /**
   * 处理客户端断开连接
   */
  private handleDisconnection(ws: WebSocket): void {
    const client = this.clients.get(ws);
    if (client) {
      this.clients.delete(ws);
      this.logger.info(`客户端断开连接，剩余连接数: ${this.clients.size}`);
    }
  }

  /**
   * 获取服务器状态
   */
  getStatus(): {
    isRunning: boolean;
    port: number;
    clientCount: number;
  } {
    return {
      isRunning: this.isRunning,
      port: this.port,
      clientCount: this.clients.size
    };
  }
}
