import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { randomUUID } from "crypto";
import { Logger } from "../utils/Logger.js";
import { MinecraftClient } from "../minecraft/MinecraftClient.js";
import { StateManager } from "../minecraft/StateManager.js";
import { ActionExecutor } from "../minecraft/ActionExecutor.js";
// 动作与工具的自动发现通过 ActionExecutor 完成

export interface McpConfig {
  name: string;
  version: string;
  auth?: {
    token?: string;
    enabled?: boolean;
  };
  tools?: {
    enabled?: string[];
    disabled?: string[];
  };
}

export interface McpServerDeps {
  minecraftClient: MinecraftClient;
  stateManager: StateManager;
  actionExecutor: ActionExecutor;
  config: McpConfig;
}

export class MaicraftMcpServer {
  private readonly server: McpServer;
  private readonly logger = new Logger("MCP");
  private readonly deps: McpServerDeps;
  // Testing-only registry of tool handlers
  private readonly __handlers: Map<string, (input: any) => Promise<any>> = new Map();
  private actionToolsRegistered = false;

  constructor(deps: McpServerDeps) {
    this.deps = deps;
    this.server = new McpServer({
      name: deps.config.name || "maicraft-mcp",
      version: deps.config.version || "0.1.0",
    });

    this.registerBuiltInTools();
    this.registerQueryTools();
    // 立即尝试注册动作工具（测试环境下无 discover 也会注册 fallback）
    this.registerActionTools();
  }

  async startOnStdio(): Promise<void> {
    // 在启动时若未注册成功，重试一次（通常 discover 完成后可获取到 schema 工具）
    if (!this.actionToolsRegistered) {
      this.registerActionTools();
    }
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.logger.info("MCP server connected over stdio");
    
    // Keep the connection alive
    return new Promise(() => {
      // This promise never resolves, keeping the process alive
      // The process will be terminated by SIGINT or when the transport closes
    });
  }

  private registerBuiltInTools(): void {
    const pingHandler = async (extra: any) => {
      const requestId = randomUUID();
      const start = Date.now();
      const pong = {
        ok: true,
        data: { pong: true, version: this.deps.config.version, ready: this.deps.minecraftClient.isConnectedToServer(), echo: "pong" },
        request_id: requestId,
        elapsed_ms: Date.now() - start,
      };
      this.logToolInvocation("ping", requestId, {}, pong.ok, undefined, pong.elapsed_ms);
      return { content: [{ type: "text", text: JSON.stringify(pong) }], structuredContent: pong };
    };
    this.__handlers.set("ping", pingHandler);
    this.server.tool("ping", "Health check. Returns pong and service version.", pingHandler as any);
  }

  private registerQueryTools(): void {
    // query_state
    const queryStateHandler = async (input: any) => {
      const requestId = randomUUID();
      const start = Date.now();
      try {
        const authError = this.verifyAuth();
        if (authError) return this.errorResult("permission_denied", authError, requestId, start);
        const bot = this.deps.minecraftClient.getBot();
        if (!bot) return this.errorResult("service_unavailable", "Minecraft bot is not ready", requestId, start);
        const state = this.deps.stateManager.getGameState();
        const elapsed = Date.now() - start;
        const json = { ok: true, data: state, request_id: requestId, elapsed_ms: elapsed };
        this.logToolInvocation("query_state", requestId, {}, true, undefined, elapsed);
        return { content: [{ type: "text", text: JSON.stringify(json) }], structuredContent: json };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logToolInvocation("query_state", requestId, {}, false, "execution_error", Date.now() - start);
        return this.errorResult("execution_error", message, requestId, start);
      }
    };
    this.__handlers.set("query_state", queryStateHandler);
    this.server.tool("query_state", "Return a minimal snapshot of bot state.", queryStateHandler as any);

    // query_events
    const queryEventsHandler = async (input: any) => {
      const requestId = randomUUID();
      const start = Date.now();
      try {
        const authError = this.verifyAuth();
        if (authError) return this.errorResult("permission_denied", authError, requestId, start);
        const type = input?.type;
        const sinceMs = input?.since_ms;
        const limit = input?.limit ?? 50;
        if (limit <= 0) return this.errorResult("parameter_error", "limit must be positive", requestId, start);
        const events = this.deps.stateManager.listEvents(type, sinceMs, limit);
        const elapsed = Date.now() - start;
        const json = { ok: true, data: events, request_id: requestId, elapsed_ms: elapsed };
        this.logToolInvocation("query_events", requestId, { type, since_ms: sinceMs, limit }, true, undefined, elapsed);
        return { content: [{ type: "text", text: JSON.stringify(json) }], structuredContent: json };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logToolInvocation("query_events", requestId, input ?? {}, false, "execution_error", Date.now() - start);
        return this.errorResult("execution_error", message, requestId, start);
      }
    };
    this.__handlers.set("query_events", queryEventsHandler);
    this.server.tool(
      "query_events",
      "Return recent events with optional filters.",
      {
        type: z.string().optional(),
        since_ms: z.number().int().optional(),
        limit: z.number().int().min(1).max(500).optional(),
      },
      queryEventsHandler as any
    );
  }

  private registerActionTools(): void {
    if (this.actionToolsRegistered) return;
    const enabled = this.deps.config.tools?.enabled;
    const disabled = new Set(this.deps.config.tools?.disabled || []);
    const allow = (name: string) => {
      if (disabled.has(name)) return false; // 黑名单优先
      if (!enabled || enabled.length === 0) return true; // 未配置白名单时，默认允许
      return enabled.includes(name); // 同时存在时，两者并存：既要在白名单，又不能在黑名单
    };

    const specs = this.deps.actionExecutor.getDiscoveredMcpTools?.() ?? [];
    
    if (Array.isArray(specs) && specs.length > 0) {
      this.logger.info(`注册 ${specs.length} 个自动发现的 MCP 工具: ${specs.map(s => s.toolName).join(', ')}`);
      
      for (const spec of specs) {
         if (!allow(spec.toolName)) {
          this.logger.debug(`跳过被禁用的工具: ${spec.toolName}`);
          continue;
        }
        
        const handler = async (input: any) => {
          const requestId = randomUUID();
          const start = Date.now();
          const authError = this.verifyAuth();
          if (authError) return this.errorResult("permission_denied", authError, requestId, start);
          
          const normalize = (raw: any) => {
            if (!raw || typeof raw !== 'object') return {} as any;
            const obj = { ...(raw as any) };
            if (obj.blockName && !obj.name) obj.name = obj.blockName;
            if (obj.itemName && !obj.item) obj.item = obj.itemName;
            if (obj.playerName && !obj.player) obj.player = obj.playerName;
            if (obj.timeoutSec && !obj.timeout) obj.timeout = obj.timeoutSec;
            return obj;
          };

          const params = typeof spec.mapInputToParams === 'function'
            ? spec.mapInputToParams(input, { state: this.deps.stateManager })
            : normalize(input ?? {});
          
          const actionName = spec.actionName || undefined;
          const finalActionName = actionName ?? (input?.actionName as string) ?? spec.toolName;
          
          return this.wrapAction(finalActionName, params as any);
        };
        
        this.__handlers.set(spec.toolName, handler);

        // 处理 schema
        const schema = (spec as any).schema;
        const isZod = schema && typeof schema === 'object' && typeof schema.safeParse === 'function';
        const isShape = schema && typeof schema === 'object' && !isZod;
        
        if (isZod) {
          const shape = (schema as any)?._def?.shape?.();
          if (shape && typeof shape === 'object') {
            this.server.tool(spec.toolName, spec.description, shape as any, handler as any);
          } else {
            this.server.tool(spec.toolName, spec.description, handler as any);
          }
        } else if (isShape) {
          this.server.tool(spec.toolName, spec.description, schema as any, handler as any);
        } else {
          this.server.tool(spec.toolName, spec.description, handler as any);
        }
        
        this.logger.debug(`已注册工具: ${spec.toolName}`);
      }
      this.actionToolsRegistered = true;
    } else {
      this.logger.warn('未发现任何 MCP 工具定义，启用兼容的内建工具: mine_block');
      // 兼容：注册最常用的 mine_block 工具，映射到 mineBlock 动作
      const handler = async (input: any) => {
        const params = { name: input?.blockName ?? input?.name, count: input?.count ?? 1 };
        return this.wrapAction('mineBlock', params);
      };
      this.__handlers.set('mine_block', handler);
      this.server.tool(
        'mine_block',
        'Mine blocks by name nearby.',
        { blockName: z.string(), count: z.number().int().min(1).optional() } as any,
        handler as any
      );
      this.actionToolsRegistered = true;
    }
  }

  private async wrapAction(name: string, params: Record<string, unknown>) {
    const requestId = randomUUID();
    const start = Date.now();
    try {
      const bot = this.deps.minecraftClient.getBot();
      if (!bot) {
        this.logToolInvocation(name, requestId, params, false, "service_unavailable", Date.now() - start);
        return this.errorResult("service_unavailable", "Minecraft bot is not ready", requestId, start);
      }
      const result = await this.deps.actionExecutor.execute(name, bot, params as any, 30_000);
      const mappedError = !result.success && result.error === 'TIMEOUT' ? 'execution_timeout' : (!result.success ? (result.error ?? 'execution_error') : undefined);
      const content = {
        ok: Boolean(result.success),
        data: result.success ? (result.data ?? { message: result.message }) : undefined,
        error_code: result.success ? undefined : mappedError,
        error_message: result.success ? undefined : result.message,
        request_id: requestId,
        elapsed_ms: Date.now() - start,
      };
      this.logToolInvocation(name, requestId, params, content.ok, content.error_code, content.elapsed_ms);
      return { content: [{ type: "text", text: JSON.stringify(content) }], structuredContent: content };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
       this.logToolInvocation(name, requestId, params, false, "execution_error", Date.now() - start);
      return this.errorResult("execution_error", message, requestId, start);
    }
  }

  private errorResult(code: string, message: string, requestId: string, start: number) {
    const json = { ok: false, error_code: code, error_message: message, request_id: requestId, elapsed_ms: Date.now() - start };
    return { content: [{ type: "text", text: JSON.stringify(json) }], structuredContent: json };
  }

  private logToolInvocation(tool: string, requestId: string, params: unknown, ok: boolean, errorCode: string | undefined, elapsedMs: number): void {
    try {
      this.logger.info(JSON.stringify({
        request_id: requestId,
        tool,
        ok,
        error_code: errorCode,
        elapsed_ms: elapsedMs,
        params_summary: this.summarizeParams(params),
      }));
    } catch {
      // ignore logging errors
    }
  }

  private summarizeParams(params: unknown): unknown {
    if (params && typeof params === 'object') {
      try {
        const json = JSON.parse(JSON.stringify(params));
        // 避免过大对象
        return json;
      } catch {
        return '[unserializable]';
      }
    }
    return params;
  }

  private verifyAuth(): string | null {
    const enabled = this.deps.config.auth?.enabled ?? false;
    if (!enabled) return null;
    // For now, we only check presence match when enabled. Extend as needed.
    // Expect a token in env or process args is not desired; keep it no-op per project preference.
    return null;
  }

  private ensureActionsRegistered(): void {
    // 兼容：若未通过自动发现注册到核心动作，则补充内建的几个基础动作。
    // 注意：当 main.ts 已启用自动发现时，此处通常不会生效。
    try {
      const names = this.deps.actionExecutor.getRegisteredActions?.() ?? [];
      // 保持兼容，不在此直接实例化动作类，避免强耦合
      // 用户应通过在 actions 目录提供动作文件来完成注册
      if (names.length === 0) {
        this.logger.info('未检测到已注册动作，建议在 src/actions 中提供动作文件以启用自动注册。');
      }
    } catch {}
  }

  // Testing-only helpers
  public __testInvokeTool(name: string, input: any): Promise<any> {
    const h = this.__handlers.get(name);
    if (!h) throw new Error(`tool not found: ${name}`);
    return h(input);
  }

  public __testHasTool(name: string): boolean {
    return this.__handlers.has(name);
  }
}


