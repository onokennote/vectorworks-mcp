#!/usr/bin/env node

/**
 * MCP Bridge: Connects stdio-based MCP client to WebSocket MCP server
 *
 * This bridge allows VS Code extensions (like Claude Dev) that expect
 * stdio-based MCP servers to connect to our WebSocket-based MCP server.
 */

const WebSocket = require('ws');
const readline = require('readline');

const WS_URL = 'ws://localhost:8765';

let ws = null;
let reconnectTimer = null;
let messageQueue = [];

// Create readline interface for stdin/stdout
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

function handleMcpProtocol(req) {
  const method = req.method;
  const id = req.id;

  // Handle standard MCP protocol methods
  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id: id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: 'vectorworks-docs',
          version: '1.0.0'
        }
      }
    };
  }

  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id: id,
      result: {
        tools: [
          {
            name: 'vw_search',
            description: 'Search Vectorworks Python/VectorScript documentation. Returns relevant documentation chunks.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query'
                },
                k: {
                  type: 'number',
                  description: 'Number of results to return (default: 6)',
                  default: 6
                }
              },
              required: ['query']
            }
          },
          {
            name: 'vw_answer',
            description: 'Get an answer to a question about Vectorworks scripting based on documentation. Returns a draft answer with source citations.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Question about Vectorworks scripting'
                },
                k: {
                  type: 'number',
                  description: 'Number of documentation chunks to use (default: 6)',
                  default: 6
                }
              },
              required: ['query']
            }
          },
          {
            name: 'vw_get',
            description: 'Get a specific documentation chunk by ID.',
            inputSchema: {
              type: 'object',
              properties: {
                doc_id: {
                  type: 'string',
                  description: 'Document ID'
                },
                chunk_id: {
                  type: 'number',
                  description: 'Chunk ID within the document'
                }
              },
              required: ['doc_id', 'chunk_id']
            }
          }
        ]
      }
    };
  }

  if (method === 'tools/call') {
    const toolName = req.params.name;
    const args = req.params.arguments || {};

    // Map MCP tool calls to our custom WebSocket methods
    const methodMap = {
      'vw_search': 'vw.search',
      'vw_answer': 'vw.answer',
      'vw_get': 'vw.get'
    };

    const wsMethod = methodMap[toolName];
    if (!wsMethod) {
      return {
        jsonrpc: '2.0',
        id: id,
        error: {
          code: -32601,
          message: `Unknown tool: ${toolName}`
        }
      };
    }

    // Forward to WebSocket server
    return null; // Will be handled by WebSocket
  }

  return null;
}

function connect() {
  ws = new WebSocket(WS_URL);

  ws.on('open', () => {
    console.error('[MCP Bridge] Connected to Vectorworks MCP server');

    // Send queued messages
    while (messageQueue.length > 0) {
      const msg = messageQueue.shift();
      ws.send(msg);
    }
  });

  ws.on('message', (data) => {
    // Forward WebSocket messages to stdout (for MCP client)
    console.error('[MCP Bridge] Received WebSocket message:', data.toString());
    console.log(data.toString());
  });

  ws.on('error', (error) => {
    console.error('[MCP Bridge] WebSocket error:', error.message);
  });

  ws.on('close', () => {
    console.error('[MCP Bridge] Connection closed. Reconnecting...');
    // Attempt to reconnect after 2 seconds
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, 2000);
  });
}

// Forward stdin messages to WebSocket or handle MCP protocol
rl.on('line', (line) => {
  try {
    const req = JSON.parse(line);

    // Handle MCP protocol methods locally
    const localResponse = handleMcpProtocol(req);
    if (localResponse) {
      console.log(JSON.stringify(localResponse));
      return;
    }

    // For tools/call, transform and forward to WebSocket
    if (req.method === 'tools/call') {
      const toolName = req.params.name;
      const args = req.params.arguments || {};

      const methodMap = {
        'vw_search': 'vw.search',
        'vw_answer': 'vw.answer',
        'vw_get': 'vw.get'
      };

      const wsMethod = methodMap[toolName];
      const wsRequest = {
        jsonrpc: '2.0',
        id: req.id,
        method: wsMethod,
        params: args
      };

      if (ws && ws.readyState === WebSocket.OPEN) {
        console.error('[MCP Bridge] Sending WebSocket request:', JSON.stringify(wsRequest));
        ws.send(JSON.stringify(wsRequest));
      } else {
        messageQueue.push(JSON.stringify(wsRequest));
        console.error('[MCP Bridge] WebSocket not connected, queued message');
      }
    }
  } catch (error) {
    console.error('[MCP Bridge] Error processing message:', error.message);
  }
});

// Handle process termination
process.on('SIGINT', () => {
  console.error('[MCP Bridge] Shutting down...');
  if (ws) ws.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('[MCP Bridge] Shutting down...');
  if (ws) ws.close();
  process.exit(0);
});

// Start connection
connect();
