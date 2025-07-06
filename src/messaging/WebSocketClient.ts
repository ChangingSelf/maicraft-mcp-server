import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { MessageBase, MessageParser } from './MaimMessage.js';
import { Logger } from '../utils/Logger.js';

export interface WebSocketClientOptions {
  url: string;
  token?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  connectionTimeout?: number;
}

export interface WebSocketClientEvents {
  'connected': () => void;
  'disconnected': (code: number, reason: string) => void;
  'message': (message: MessageBase) => void;
  'error': (error: Error) => void;
  'reconnecting': (attempt: number) => void;
  'reconnected': () => void;
  'reconnectFailed': () => void;
}

export declare interface WebSocketClient {
  on<U extends keyof WebSocketClientEvents>(
    event: U,
    listener: WebSocketClientEvents[U]
  ): this;
  emit<U extends keyof WebSocketClientEvents>(
    event: U,
    ...args: Parameters<WebSocketClientEvents[U]>
  ): boolean;
}

// 认证响应结构
interface AuthResponse {
  success: boolean;
  message?: string;
}

/**
 * WebSocket 客户端类
 * 负责与 MaiBot 服务器建立和维护 WebSocket 连接
 */
export class WebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private options: WebSocketClientOptions & {
    reconnectInterval: number;
    maxReconnectAttempts: number;
    heartbeatInterval: number;
    connectionTimeout: number;
  };
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private isConnected = false;
  private isReconnecting = false;
  private shouldReconnect = true;
  private logger: Logger;

  constructor(options: WebSocketClientOptions) {
    super();
    
    this.options = {
      url: options.url,
      token: options.token,
      reconnectInterval: options.reconnectInterval ?? 5000,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 10,
      heartbeatInterval: options.heartbeatInterval ?? 30000,
      connectionTimeout: options.connectionTimeout ?? 10000
    };

    this.logger = new Logger('WebSocketClient');
  }

  /**
   * 连接到 WebSocket 服务器
   */
  async connect(): Promise<void> {
    if (this.isConnected || this.ws?.readyState === WebSocket.CONNECTING) {
      this.logger.warn('WebSocket 已连接或正在连接中');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.logger.info(`正在连接到 ${this.options.url}`);
        
        // 创建 WebSocket 连接
        this.ws = new WebSocket(this.options.url);
        
        // 连接超时处理
        const timeout = setTimeout(() => {
          if (this.ws?.readyState === WebSocket.CONNECTING) {
            this.ws.terminate();
            reject(new Error('连接超时'));
          }
        }, this.options.connectionTimeout);

        // 连接成功
        this.ws.onopen = () => {
          clearTimeout(timeout);
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.isReconnecting = false;
          
          this.logger.info('WebSocket 连接成功');
          this.emit('connected');
          
          // 发送认证信息（如果有 token）
          if (this.options.token) {
            this.sendAuthMessage();
          }
          
          // 启动心跳
          this.startHeartbeat();
          
          resolve();
        };

        // 接收消息
        this.ws.onmessage = (event: WebSocket.MessageEvent) => {
          this.handleMessage(event.data as string);
        };

        // 连接关闭
        this.ws.onclose = (event: WebSocket.CloseEvent) => {
          clearTimeout(timeout);
          this.handleDisconnect(event.code, event.reason);
        };

        // 连接错误
        this.ws.onerror = (error: WebSocket.ErrorEvent) => {
          clearTimeout(timeout);
          this.logger.error('WebSocket 连接错误:', error);
          this.emit('error', new Error(`WebSocket 连接错误: ${error.message || '未知错误'}`));
          
          if (!this.isConnected) {
            reject(new Error(`WebSocket 连接错误: ${error.message || '未知错误'}`));
          }
        };

      } catch (error) {
        this.logger.error('创建 WebSocket 连接失败:', error);
        reject(error);
      }
    });
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    this.shouldReconnect = false;
    this.stopHeartbeat();
    this.stopReconnect();

    if (this.ws) {
      this.ws.close(1000, '正常关闭');
      this.ws = null;
    }

    this.isConnected = false;
    this.logger.info('WebSocket 连接已断开');
  }

  /**
   * 发送消息
   */
  async sendMessage(message: MessageBase): Promise<void> {
    if (!this.isConnected || !this.ws) {
      throw new Error('WebSocket 未连接');
    }

    try {
      const messageData = MessageParser.toDict(message);
      const jsonData = JSON.stringify(messageData);
      
      this.ws.send(jsonData);
      this.logger.debug('消息已发送:', message.message_info.message_id);
    } catch (error) {
      this.logger.error('发送消息失败:', error);
      throw error;
    }
  }

  /**
   * 发送原始数据
   */
  async sendRaw(data: string): Promise<void> {
    if (!this.isConnected || !this.ws) {
      throw new Error('WebSocket 未连接');
    }

    try {
      this.ws.send(data);
      this.logger.debug('原始数据已发送');
    } catch (error) {
      this.logger.error('发送原始数据失败:', error);
      throw error;
    }
  }

  /**
   * 获取连接状态
   */
  getConnectionState(): {
    connected: boolean;
    reconnecting: boolean;
    reconnectAttempts: number;
  } {
    return {
      connected: this.isConnected,
      reconnecting: this.isReconnecting,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(data: string): void {
    try {
      const messageData = JSON.parse(data);
      
      // 处理心跳响应
      if (messageData.type === 'pong') {
        this.logger.debug('收到心跳响应');
        return;
      }

      // 处理认证响应
      if (messageData.type === 'auth_response') {
        this.handleAuthResponse(messageData);
        return;
      }

      // 仅处理符合 MaimMessage 规范的数据
      if (!messageData || !messageData.message_info) {
        this.logger.warn('收到非 MaimMessage 格式数据，已忽略');
        return;
      }

      const message: MessageBase = MessageParser.fromDict(messageData);

      this.logger.debug('收到消息:', message.message_info.message_id);
      this.emit('message', message);
      
    } catch (error) {
      this.logger.error('解析消息失败:', error, '原始数据:', data);
      this.emit('error', new Error(`解析消息失败: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  /**
   * 处理断开连接
   */
  private handleDisconnect(code: number, reason: string): void {
    this.isConnected = false;
    this.stopHeartbeat();
    
    this.logger.warn(`WebSocket 连接断开: ${code} - ${reason}`);
    this.emit('disconnected', code, reason);

    // 如果需要重连且不是正常关闭
    if (this.shouldReconnect && code !== 1000) {
      this.startReconnect();
    }
  }

  /**
   * 开始重连
   */
  private startReconnect(): void {
    if (this.isReconnecting || this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
        this.logger.error('达到最大重连次数，停止重连');
        this.emit('reconnectFailed');
      }
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;
    
    this.logger.info(`开始第 ${this.reconnectAttempts} 次重连...`);
    this.emit('reconnecting', this.reconnectAttempts);

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
        this.logger.info('重连成功');
        this.emit('reconnected');
      } catch (error) {
        this.logger.error('重连失败:', error);
        this.isReconnecting = false;
        this.startReconnect(); // 继续尝试重连
      }
    }, this.options.reconnectInterval);
  }

  /**
   * 停止重连
   */
  private stopReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.isReconnecting = false;
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected && this.ws) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
          this.logger.debug('发送心跳');
        } catch (error) {
          this.logger.error('发送心跳失败:', error);
        }
      }
    }, this.options.heartbeatInterval);
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 发送认证消息
   */
  private sendAuthMessage(): void {
    if (this.ws && this.options.token) {
      const authMessage = {
        type: 'auth',
        token: this.options.token,
        timestamp: Date.now()
      };
      
      this.ws.send(JSON.stringify(authMessage));
      this.logger.debug('认证消息已发送');
    }
  }

  /**
   * 处理认证响应
   */
  private handleAuthResponse(response: AuthResponse): void {
    if (response.success) {
      this.logger.info('认证成功');
    } else {
      this.logger.error('认证失败:', response.message);
      this.emit('error', new Error(`认证失败: ${response.message}`));
    }
  }
} 