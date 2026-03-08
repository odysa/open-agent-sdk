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

declare module "@google/gemini-cli-core" {
  export class Config {
    constructor(params: any);
    initialize(): Promise<void>;
    dispose(): void;
    model: string;
    getActiveModel(): string;
    getToolRegistry(): any;
    getMessageBus(): any;
    modelConfigService: any;
  }
  export class GeminiChat {
    constructor(config: any, systemInstruction?: string, tools?: any[], history?: any[]);
    sendMessageStream(...args: any[]): AsyncGenerator<any>;
    clearHistory(): void;
    getHistory(curated?: boolean): any[];
    setTools(tools: any[]): void;
  }
  export class Turn {
    constructor(chat: any, promptId: string);
    run(...args: any[]): AsyncGenerator<any>;
  }
  export class BaseDeclarativeTool {
    constructor(...args: any[]);
  }
  export class ToolRegistry {
    registerTool(tool: any): void;
    getAllToolNames(): string[];
    getFunctionDeclarationsFiltered(names: string[], modelId?: string): any[];
  }
  export const GeminiEventType: {
    Content: string;
    ToolCallRequest: string;
    ToolCallResponse: string;
    ToolCallConfirmation: string;
    UserCancelled: string;
    Error: string;
    Thought: string;
    Finished: string;
    Citation: string;
    Retry: string;
    [key: string]: string;
  };
  export const ApprovalMode: {
    DEFAULT: string;
    AUTO_EDIT: string;
    YOLO: string;
    PLAN: string;
  };
  export const DEFAULT_GEMINI_MODEL: string;
  export function convertToFunctionResponse(
    toolName: string,
    callId: string,
    content: any,
    model: string,
  ): any[];
}

declare module "@moonshot-ai/kimi-agent-sdk" {
  export function createSession(options: any): any;
  export function createExternalTool(options: any): any;
}
