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

declare module "openai" {
  class OpenAI {
    constructor(options?: { apiKey?: string });
    chat: {
      completions: {
        create(options: any): Promise<AsyncIterable<any>>;
      };
    };
  }
  export default OpenAI;
}

declare module "@moonshot-ai/kimi-agent-sdk" {
  export function createSession(options: any): any;
  export function createExternalTool(options: any): any;
}
