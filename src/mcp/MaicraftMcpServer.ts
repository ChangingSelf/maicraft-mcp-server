import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { randomUUID } from "crypto";
import { Logger } from "../utils/Logger.js";
import { MinecraftClient } from "../minecraft/MinecraftClient.js";
import { ActionExecutor } from "../minecraft/ActionExecutor.js";
// 动作与工具的自动发现通过 ActionExecutor 完成

export interface McpConfig {
  name: string;
  version: string;
  tools?: {
    enabled?: string[];
    disabled?: string[];
  };
}

export interface McpServerDeps {
  minecraftClient: MinecraftClient;
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
    
    // 保持连接存活
    return new Promise(() => {
      // 这个 promise 不会 resolve, 保持进程存活
      // 进程将在 SIGINT 或 transport 关闭时终止
    });
  }

  private registerQueryTools(): void {
    // query_state 和 query_events 已移除，使用对应的查询动作替代
    // queryPlayerStatus, queryGameState, queryRecentEvents, querySurroundings
  }

  /**
   * 注册Minecraft动作作为MCP工具
   * @returns 
   */
  private registerActionTools(): void {
    if (this.actionToolsRegistered) return;

    // 获取配置的白名单和黑名单
    const enabled = this.deps.config.tools?.enabled;
    const disabled = new Set(this.deps.config.tools?.disabled || []);
    const allow = (name: string) => {
      if (disabled.has(name)) return false; // 黑名单优先
      if (!enabled || enabled.length === 0) return true; // 未配置白名单时，默认允许
      return enabled.includes(name); // 同时存在时，两者并存：既要在白名单，又不能在黑名单
    };

    // 获取自动发现的MCP工具
    const specs = this.deps.actionExecutor.getDiscoveredMcpTools?.() ?? [];
    
    if (Array.isArray(specs) && specs.length > 0) {
      this.logger.info(`注册 ${specs.length} 个自动发现的 MCP 工具: ${specs.map(s => s.toolName).join(', ')}`);
      
      for (const spec of specs) {
        // 如果工具被禁用，则跳过
         if (!allow(spec.toolName)) {
          this.logger.debug(`跳过被禁用的工具: ${spec.toolName}`);
          continue;
        }
        
        // 注册工具处理函数
        const handler = async (input: any) => {
          const requestId = randomUUID();
          const start = Date.now();
          
          const params = typeof spec.mapInputToParams === 'function'
            ? spec.mapInputToParams(input, {})
            : (input ?? {});
          
          const actionName = spec.actionName || undefined;
          const finalActionName = actionName ?? (input?.actionName as string) ?? spec.toolName;
          
          return this.wrapAction(finalActionName, params as any);
        };
        
        // 处理 schema
        const {schema, toolName, description} = spec;
        this.__handlers.set(toolName, handler);
        
        const isZod = schema && typeof schema === 'object' && typeof schema.safeParse === 'function';
        const isShape = schema && typeof schema === 'object' && !isZod;
        
        if (isZod) {
          const shape = (schema as any)?._def?.shape?.();
          if (shape && typeof shape === 'object') {
            this.server.tool(toolName, description, shape as any, handler as any);
          } else {
            this.server.tool(toolName, description, handler as any);
          }
        } else if (isShape) {
          this.server.tool(toolName, description, schema as any, handler as any);
        } else {
          this.server.tool(toolName, description, handler as any);
        }
        
        this.logger.debug(`已注册工具: ${toolName}`);
      }
      this.actionToolsRegistered = true;
    } else {
      this.logger.warn('未发现任何 MCP 工具定义');
    }
  }

  /**
   * 包装Minecraft动作并返回MCP结果
   * @param name 动作名称
   * @param params 动作参数
   * @returns 
   */
  private async wrapAction(name: string, params: Record<string, unknown>) {
    const requestId = randomUUID();
    const start = Date.now();
    try {
      const bot = this.deps.minecraftClient.getBot();
      if (!bot) {
        this.logToolInvocation(name, requestId, params, false, "service_unavailable", Date.now() - start);
        return this.errorResult("service_unavailable", "Minecraft bot is not ready", requestId, start);
      }
      const result = await this.deps.actionExecutor.execute(name, bot, params as any, 600_000);
      const mappedError = !result.success && result.error === 'TIMEOUT' ? 'execution_timeout' : (result.success ? undefined : result.error ?? 'execution_error');
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
        return JSON.parse(JSON.stringify(params));
      } catch {
        return '[unserializable]';
      }
    }
    return params;
  }
  
}


