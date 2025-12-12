#!/usr/bin/env node

// SentryFrogg MCP Server v4.2

process.on('unhandledRejection', (reason, promise) => {
  process.stderr.write(`🔥 Unhandled Promise Rejection: ${reason}\n`);
  process.stderr.write(`Promise: ${promise}\n`);
});

process.on('uncaughtException', (error) => {
  process.stderr.write(`🔥 Uncaught Exception: ${error.message}\n`);
  process.exit(1);
});

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} = require('@modelcontextprotocol/sdk/types.js');

const ServiceBootstrap = require('./src/bootstrap/ServiceBootstrap.cjs');

const toolCatalog = [
  {
    name: 'help',
    description: 'Краткая справка по использованию SentryFrogg MCP сервера и доступным инструментам.',
    inputSchema: {
      type: 'object',
      properties: {
        tool: {
          type: 'string',
          description: 'Название инструмента для детализации. Оставьте пустым для общего описания.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'mcp_psql_manager',
    description: 'PostgreSQL toolchain. Flow: setup_profile → action. setup_profile accepts credentials or connection_url plus optional TLS (ssl_mode, ssl_ca, ssl_cert, ssl_key, ssl_passphrase, ssl_servername, ssl_reject_unauthorized); secrets stored encrypted. Subsequent calls reuse profile_name: quick_query (adds LIMIT 100 if absent; supports params array for $ placeholders), show_tables, describe_table, sample_data, database_info, insert_data, update_data, delete_data, list_profiles.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['setup_profile', 'list_profiles', 'quick_query', 'show_tables', 'describe_table', 'sample_data', 'insert_data', 'update_data', 'delete_data', 'database_info'] },
        profile_name: { type: 'string', description: "Profile name (defaults to 'default')" },
        connection_url: { type: 'string', description: 'postgres://user:pass@host:port/db url' },
        host: { type: 'string' },
        port: { type: 'integer' },
        username: { type: 'string' },
        password: { type: 'string' },
        database: { type: 'string' },
        ssl: { type: ['boolean', 'object'] },
        ssl_mode: { type: 'string', description: 'disable | require | verify-ca | verify-full' },
        ssl_ca: { type: 'string', description: 'PEM encoded certificate authority chain' },
        ssl_cert: { type: 'string', description: 'PEM encoded client certificate' },
        ssl_key: { type: 'string', description: 'PEM encoded client private key' },
        ssl_passphrase: { type: 'string', description: 'Optional passphrase for the private key' },
        ssl_servername: { type: 'string', description: 'Override servername for TLS verification' },
        ssl_reject_unauthorized: { type: ['boolean', 'string'], description: 'Set to false to trust self-signed certificates' },
        sql: { type: 'string' },
        params: { type: 'array', items: { type: ['string', 'number', 'boolean', 'null'] } },
        table_name: { type: 'string' },
        schema: { type: 'string', description: 'Optional schema name for table operations' },
        data: { type: ['object', 'string', 'number', 'boolean'], description: 'Optional request body; objects are JSON-encoded' },
        where: { type: 'string' },
        limit: { type: 'integer' }
      },
      required: ['action']
    }
  },
  {
    name: 'mcp_ssh_manager',
    description: 'SSH executor. setup_profile stores host credentials (password or PEM private_key with optional passphrase); data encrypted. list_profiles enumerates profiles, system_info returns collected facts, check_host validates reachability, execute runs one trimmed command (pipes/redirects allowed) sequentially per profile; no concurrent runs.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['setup_profile', 'list_profiles', 'execute', 'system_info', 'check_host'] },
        profile_name: { type: 'string', description: "Profile name (defaults to 'default')" },
        host: { type: 'string' },
        port: { type: 'integer' },
        username: { type: 'string' },
        password: { type: 'string' },
        private_key: { type: 'string', description: 'PEM encoded private key' },
        passphrase: { type: 'string' },
        ready_timeout: { type: 'integer' },
        keepalive_interval: { type: 'integer' },
        command: { type: 'string' }
      },
      required: ['action']
    }
  },
  {
    name: 'mcp_api_client',
    description: 'HTTP caller. Fields: action ∈ {get, post, put, delete, patch, check_api}, url (required), data (JSON body for mutating verbs), headers (string map), auth_token (prefixed into Authorization unless headers.Authorization supplied). Local URLs allowed. Responses are structured results or MCP errors.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['get', 'post', 'put', 'delete', 'patch', 'check_api'] },
        url: { type: 'string' },
        data: { type: 'object' },
        headers: { type: 'object' },
        auth_token: { type: 'string' }
      },
      required: ['action']
    }
  }
];

class SentryFroggServer {
  constructor() {
    this.server = new Server(
      {
        name: 'sentryfrogg',
        version: '4.2.0',
      },
      {
        capabilities: {
          tools: { list: true, call: true },
        },
        protocolVersion: '2025-06-18',
      }
    );
    this.container = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      this.container = await ServiceBootstrap.initialize();
      await this.setupHandlers();
      this.initialized = true;
      const logger = this.container.get('logger');
      logger.info('SentryFrogg MCP Server v4.2.0 ready');
    } catch (error) {
      process.stderr.write(`Failed to initialize SentryFrogg MCP Server: ${error.message}\n`);
      throw error;
    }
  }

  async setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolCatalog }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        let result;
        switch (name) {
          case 'help':
            result = this.handleHelp(args);
            break;
          case 'mcp_psql_manager':
            result = await this.handlePostgreSQL(args);
            break;
          case 'mcp_ssh_manager':
            result = await this.handleSSH(args);
            break;
          case 'mcp_api_client':
            result = await this.handleAPI(args);
            break;
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const logger = this.container?.get('logger');
        logger?.error('Tool execution failed', {
          tool: name,
          action: args?.action,
          error: error.message,
        });

        throw new McpError(ErrorCode.InternalError, `Ошибка выполнения ${name}: ${error.message}`);
      }
    });
  }

  async handlePostgreSQL(args) {
    this.ensureInitialized();
    return this.container.get('postgresqlManager').handleAction(args);
  }

  async handleSSH(args) {
    this.ensureInitialized();
    return this.container.get('sshManager').handleAction(args);
  }

  async handleAPI(args) {
    this.ensureInitialized();
    return this.container.get('apiManager').handleAction(args);
  }

  handleHelp(args = {}) {
    this.ensureInitialized();
    const tool = args.tool?.toLowerCase();
    const summaries = {
      help: {
        description: 'Показывает справку. Вы можете передать `tool` чтобы получить сведения о конкретном инструменте.',
        usage: "call_tool → name: 'help', arguments: { tool?: string }",
      },
      mcp_psql_manager: {
        description: 'Управление PostgreSQL: профили, запросы, CRUD, метаданные.',
        usage: "setup_profile → quick_query/show_tables/describe_table/sample_data/insert/update/delete/database_info",
      },
      mcp_ssh_manager: {
        description: 'Выполнение SSH команд и диагностика хоста по профилю.',
        usage: "setup_profile → execute/system_info/check_host/list_profiles",
      },
      mcp_api_client: {
        description: 'HTTP клиент с поддержкой токенов, заголовков и JSON-данных.',
        usage: "action: get/post/put/delete/patch/check_api + url [+ data/headers/auth_token]",
      },
    };

    if (tool && summaries[tool]) {
      return summaries[tool];
    }

    return {
      overview: 'SentryFrogg MCP подключает PostgreSQL, SSH и HTTP инструменты. Сначала настройте профиль (setup_profile), затем запускайте операции.',
      tools: Object.entries(summaries).map(([key, value]) => ({
        name: key,
        description: value.description,
        usage: value.usage,
      })),
    };
  }

  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('SentryFrogg MCP Server not initialized');
    }
  }

  async run() {
    await this.initialize();

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    const cleanup = async () => {
      try {
        await ServiceBootstrap.cleanup();
        process.exit(0);
      } catch (error) {
        process.stderr.write(`Cleanup failed: ${error.message}\n`);
        process.exit(1);
      }
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('uncaughtException', (error) => {
      process.stderr.write(`Uncaught exception: ${error.message}\n`);
      cleanup();
    });
  }

  getStats() {
    if (!this.initialized) {
      return { error: 'Server not initialized' };
    }

    return {
      version: '4.2.0',
      architecture: 'lightweight-service-layer',
      ...ServiceBootstrap.getStats(),
    };
  }
}

if (require.main === module) {
  const server = new SentryFroggServer();
  server.run().catch((error) => {
    process.stderr.write(`Server run failed: ${error.message}\n`);
    process.exit(1);
  });
}

module.exports = SentryFroggServer;
