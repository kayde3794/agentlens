import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentLens — AI Agent Debugger & Replay Inspector",
  description: "Time-travel debugging for AI agent workflows. Capture, replay, and inspect every LLM call, tool invocation, and decision in your multi-agent systems. Chrome DevTools for AI Agents.",
  keywords: "AI agent debugger, LLM observability, agent replay, MCP inspector, multi-agent debugging, AI agent trace, agent workflow visualization",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="bg-gradient-mesh" />
        {children}
      </body>
    </html>
  );
}
