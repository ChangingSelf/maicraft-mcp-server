#### 连接地址

````
ws://localhost:20915/ws/mcp-logs
````

#### 消息格式

**客户端发送:**

```json
{
  "type": "subscribe"
}
```

**服务端响应:**

```json
{
  "type": "subscribed",
  "message": "Successfully subscribed to logs"
}
```

**服务端推送日志:**

```json
{
  "type": "log",
  "timestamp": 1704067200000,
  "level": "INFO",
  "module": "Maicraft",
  "message": "Minecraft 客户端已连接"
}
```

#### 功能说明

- 客户端发送 `{"type": "subscribe"}` 即可订阅所有日志
- 订阅后将接收所有级别的日志消息（DEBUG、INFO、WARN、ERROR）
- 每个日志消息包含完整的上下文信息（时间戳、级别、模块、内容）
- 支持多个客户端同时订阅