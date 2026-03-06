// Ambient module declarations for optional peer dependencies.
// These are loaded dynamically at runtime; users install them as needed.

declare module "@anthropic-ai/claude-agent-sdk" {
  export function query(options: any): AsyncIterable<any>;
  export function createSdkMcpServer(options: any): any;
  export function tool(
    name: string,
    description: string,
    parameters: any,
    handler: (args: any) => Promise<any>,
  ): any;
}

declare module "@openai/codex-sdk" {
  class Codex {
    constructor(options?: Record<string, unknown>);
    startThread(options?: Record<string, unknown>): Thread;
    resumeThread(id: string, options?: Record<string, unknown>): Thread;
  }
  class Thread {
    get id(): string | null;
    run(input: string, options?: Record<string, unknown>): Promise<any>;
    runStreamed(
      input: string,
      options?: Record<string, unknown>,
    ): Promise<{ events: AsyncGenerator<any> }>;
  }
  export { Codex, Thread };
}

declare module "@moonshot-ai/kimi-agent-sdk" {
  export function createSession(options: any): any;
  export function createExternalTool(options: any): any;
}

declare module "@github/copilot-sdk" {
  class CopilotClient {
    constructor(options?: Record<string, unknown>);
    start(): Promise<void>;
    stop(): Promise<Error[]>;
    createSession(config?: Record<string, unknown>): Promise<CopilotSession>;
  }
  class CopilotSession {
    sessionId: string;
    send(options: { prompt: string }): Promise<string>;
    sendAndWait(
      options: { prompt: string },
      timeout?: number,
    ): Promise<{ data: { content: string } } | undefined>;
    on(eventType: string, handler: (event: any) => void): () => void;
    on(handler: (event: any) => void): () => void;
    abort(): Promise<void>;
    destroy(): Promise<void>;
  }
  function defineTool(options: {
    name: string;
    description: string;
    parameters: any;
    handler: (args: any) => Promise<any>;
  }): any;
  function approveAll(request: any): any;
  export { CopilotClient, CopilotSession, defineTool, approveAll };
}
