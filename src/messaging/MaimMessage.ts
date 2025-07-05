/**
 * maim_message TypeScript 类型定义
 * 基于 Python 版本的 maim_message 库实现
 */

// 基础用户信息
export interface UserInfo {
  platform: string;
  user_id: string;
  user_name?: string;
  user_displayname?: string;
  user_remark?: string;
  user_avatar?: string;
}

// 基础群组信息
export interface GroupInfo {
  platform: string;
  group_id: string;
  group_name?: string;
  group_avatar?: string;
}

// 格式化信息
export interface FormatInfo {
  platform: string;
  format_id: string;
  format_name?: string;
  format_data?: Record<string, any>;
}

// 模板信息
export interface TemplateInfo {
  platform: string;
  template_id: string;
  template_name?: string;
  template_data?: Record<string, any>;
}

// 消息基础信息
export interface BaseMessageInfo {
  platform: string;
  message_id: string;
  time: number;
  user_info: UserInfo;
  group_info?: GroupInfo;
  format_info?: FormatInfo;
  template_info?: TemplateInfo;
  extra_info?: Record<string, any>;
}

// 消息段类型
export interface Seg {
  type: string;
  data: any;
}

// 消息基础结构
export interface MessageBase {
  message_info: BaseMessageInfo;
  message_segment: Seg;
  raw_message?: string;
}

// 路由配置
export interface TargetConfig {
  url: string;
  token?: string;
  ssl_verify?: string;
  reconnect_interval?: number;
  max_reconnect_attempts?: number;
}

export interface RouteConfig {
  route_config: Record<string, TargetConfig>;
}

// 消息段类型枚举
export enum SegType {
  TEXT = 'text',
  IMAGE = 'image',
  SEGLIST = 'seglist',
}

// 消息段构造器
export class SegBuilder {
  static text(content: string): Seg {
    return { type: SegType.TEXT, data: content };
  }

  static image(base64Data: string): Seg {
    return { type: SegType.IMAGE, data: base64Data };
  }
  static seglist(segments: Seg[]): Seg {
    return { type: SegType.SEGLIST, data: segments };
  }
}

// 消息构造器
export class MessageBuilder {
  private messageInfo: BaseMessageInfo;
  private segments: Seg[] = [];

  constructor(
    platform: string,
    messageId: string,
    userId: string,
    groupId?: string
  ) {
    this.messageInfo = {
      platform,
      message_id: messageId,
      time: Date.now() / 1000,
      user_info: {
        platform,
        user_id: userId
      }
    };

    if (groupId) {
      this.messageInfo.group_info = {
        platform,
        group_id: groupId
      };
    }
  }

  addSegment(segment: Seg): this {
    this.segments.push(segment);
    return this;
  }

  addText(text: string): this {
    return this.addSegment(SegBuilder.text(text));
  }

  addImage(base64Data: string): this {
    return this.addSegment(SegBuilder.image(base64Data));
  }


  setUserInfo(userInfo: Partial<UserInfo>): this {
    this.messageInfo.user_info = { ...this.messageInfo.user_info, ...userInfo };
    return this;
  }

  setGroupInfo(groupInfo: Partial<GroupInfo>): this {
    if (!this.messageInfo.group_info) {
      this.messageInfo.group_info = {
        platform: this.messageInfo.platform,
        group_id: ''
      };
    }
    this.messageInfo.group_info = { ...this.messageInfo.group_info, ...groupInfo };
    return this;
  }

  setExtraInfo(extraInfo: Record<string, any>): this {
    this.messageInfo.extra_info = { ...this.messageInfo.extra_info, ...extraInfo };
    return this;
  }

  build(): MessageBase {
    return {
      message_info: this.messageInfo,
      message_segment: SegBuilder.seglist(this.segments)
    };
  }
}

// 消息解析器
export class MessageParser {
  static fromDict(data: any): MessageBase {
    return {
      message_info: data.message_info,
      message_segment: data.message_segment,
      raw_message: data.raw_message
    };
  }

  static toDict(message: MessageBase): any {
    return {
      message_info: message.message_info,
      message_segment: message.message_segment,
      raw_message: message.raw_message
    };
  }

  static extractText(message: MessageBase): string {
    const segments = this.extractSegments(message.message_segment);
    return segments
      .filter(seg => seg.type === SegType.TEXT)
      .map(seg => seg.data)
      .join('');
  }

  static extractSegments(segment: Seg): Seg[] {
    if (segment.type === SegType.SEGLIST) {
      return segment.data as Seg[];
    }
    return [segment];
  }

  static hasSegmentType(message: MessageBase, type: SegType): boolean {
    const segments = this.extractSegments(message.message_segment);
    return segments.some(seg => seg.type === type);
  }

  static getSegmentsByType(message: MessageBase, type: SegType): Seg[] {
    const segments = this.extractSegments(message.message_segment);
    return segments.filter(seg => seg.type === type);
  }
} 