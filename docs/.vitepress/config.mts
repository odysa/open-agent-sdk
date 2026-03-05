import { defineConfig } from "vitepress";

export default defineConfig({
  title: "One Agent SDK",
  description:
    "Provider-agnostic TypeScript SDK for building LLM agents with tools and multi-agent handoffs",
  base: "/one-agent-sdk/", // Change to '/' if using a custom domain

  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "API", link: "/api/run" },
    ],

    sidebar: {
      "/guide/": [
        {
          text: "Introduction",
          items: [
            { text: "What is One Agent SDK?", link: "/guide/what-is-one-agent-sdk" },
            { text: "Getting Started", link: "/guide/getting-started" },
          ],
        },
        {
          text: "Core Concepts",
          items: [
            { text: "Agents", link: "/guide/agents" },
            { text: "Tools", link: "/guide/tools" },
            { text: "Streaming", link: "/guide/streaming" },
            { text: "Multi-Agent Handoffs", link: "/guide/handoffs" },
            { text: "Providers", link: "/guide/providers" },
          ],
        },
      ],
      "/api/": [
        {
          text: "API Reference",
          items: [
            { text: "run()", link: "/api/run" },
            { text: "runToCompletion()", link: "/api/run-to-completion" },
            { text: "defineAgent()", link: "/api/define-agent" },
            { text: "defineTool()", link: "/api/define-tool" },
            { text: "Types", link: "/api/types" },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: "github", link: "https://github.com/anthropics/one-agent-sdk" },
    ],

    search: {
      provider: "local",
    },
  },
});
