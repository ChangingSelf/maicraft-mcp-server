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

  constructor(deps: McpServerDeps) {
    this.deps = deps;
    this.server = new McpServer({
      name: deps.config.name || "maicraft-mcp",
      version: deps.config.version || "0.1.0",
    });

    this.registerBuiltInTools();
    this.registerQueryTools();
    this.registerActionTools();
  }

  async startOnStdio(): Promise<void> {
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
    const enabled = this.deps.config.tools?.enabled;
    const allow = (name: string) => !enabled || enabled.includes(name);

    const specs = this.deps.actionExecutor.getDiscoveredMcpTools?.() ?? [];
    const registeredNames = new Set<string>();
    if (Array.isArray(specs) && specs.length > 0) {
      for (const spec of specs) {
        if (!allow(spec.toolName)) continue;
        const handler = async (input: any) => {
          const requestId = randomUUID();
          const start = Date.now();
          const authError = this.verifyAuth();
          if (authError) return this.errorResult("permission_denied", authError, requestId, start);
          const params = typeof spec.mapInputToParams === 'function'
            ? spec.mapInputToParams(input, { state: this.deps.stateManager })
            : (input ?? {});
          const actionName = spec.actionName || undefined;
          const finalActionName = actionName ?? (input?.actionName as string) ?? spec.toolName;
          return this.wrapAction(finalActionName, params as any);
        };
        this.__handlers.set(spec.toolName, handler);
        registeredNames.add(spec.toolName);

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
      }
    }

    // 回退：注册内建的基础动作工具，保证测试与最小可用集
    const fallbackSpecs = [
      {
        toolName: 'mine_block',
        description: 'Mine blocks by name nearby.',
        schema: {
          blockName: z.string(),
          name: z.string().optional(),
          count: z.number().int().min(1).optional(),
        },
        actionName: 'mineBlock',
        mapInputToParams: (input: any) => ({ name: input.blockName ?? input.name, count: input.count ?? 1 }),
      },
      {
        toolName: 'place_block',
        description: 'Place a block at a position.',
        schema: {
          x: z.number(), y: z.number(), z: z.number(), itemName: z.string(),
        },
        actionName: 'placeBlock',
        mapInputToParams: (input: any) => ({ x: input.x, y: input.y, z: input.z, item: input.itemName }),
      },
      {
        toolName: 'follow_player',
        description: 'Follow a player by name.',
        schema: {
          player: z.string().optional(),
          playerName: z.string().optional(),
          name: z.string().optional(),
          distance: z.number().int().positive().optional(),
          timeout: z.number().int().positive().optional(),
          timeoutSec: z.number().int().positive().optional(),
        },
        actionName: 'followPlayer',
        mapInputToParams: (input: any) => {
          const state = this.deps.stateManager.getGameState?.();
          const defaultPlayer = state?.nearbyPlayers?.[0]?.username;
          const player = input?.playerName ?? input?.player ?? input?.name ?? defaultPlayer;
          const distance = input?.distance ?? 3;
          const timeout = input?.timeoutSec ?? input?.timeout ?? 60;
          return { player, distance, timeout };
        },
      },
      {
        toolName: 'craft_item',
        description: 'Craft an item by name. Will auto-place and approach a crafting table when needed.',
        schema: { item: z.string(), count: z.number().int().min(1).optional() },
        actionName: 'craftItem',
        mapInputToParams: (input: any) => ({ item: input.item, count: input.count ?? 1 }),
      },
    ];

    for (const spec of fallbackSpecs) {
      if (registeredNames.has(spec.toolName)) continue;
      if (!allow(spec.toolName)) continue;
      const handler = async (input: any) => {
        const requestId = randomUUID();
        const start = Date.now();
        const authError = this.verifyAuth();
        if (authError) return this.errorResult('permission_denied', authError, requestId, start);
        const params = spec.mapInputToParams(input);
        return this.wrapAction(spec.actionName!, params);
      };
      this.__handlers.set(spec.toolName, handler);
      this.server.tool(spec.toolName, spec.description, spec.schema as any, handler as any);
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


