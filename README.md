# 🔍 agentlens - Clear visibility for your AI agents

[![](https://img.shields.io/badge/Download-Agentlens-blue.svg)](https://github.com/kayde3794/agentlens/releases)

Agentlens provides the tools to watch and fix your AI agent workflows. You see exactly what your agents do, how much they cost, and when they fail. This tool makes complex AI chains easy to understand.

## 🛠️ What is Agentlens?

AI agents often act like black boxes. You send a request, and you hope for the best result. Agentlens changes this. It sits inside your workflow to track every step, message, and cost. It acts like a flight recorder for your software. You gain the ability to go back in time to see exactly where an agent made a wrong turn or wasted tokens.

## 📋 System Requirements

Agentlens runs on standard Windows hardware. Please ensure your computer meets these minimum specifications for the best experience:

*   Operating System: Windows 10 or Windows 11.
*   Processor: Intel Core i5 or equivalent processor.
*   Memory: 8 GB RAM.
*   Storage: 200 MB of space for the application.
*   Internet Connection: Required for license checks and updates.

## 📥 How to Install

Follow these steps to get the software on your computer:

1. Visit the [official releases page](https://github.com/kayde3794/agentlens/releases).
2. Look for the latest version at the top of the list.
3. Click the file ending in .exe to start your download.
4. Once the download finishes, find the file in your Downloads folder.
5. Double-click the file to start the installer.
6. Follow the on-screen prompts to place the software on your machine.
7. Click Finish to launch the application.

## 🚀 Getting Started

The first time you open Agentlens, you see a clean dashboard. You must connect your project files to the tool.

1. Open Agentlens from your Windows Start menu.
2. Select the "New Project" button in the top corner.
3. Choose the folder where your AI agent code resides.
4. Agentlens scans your files and identifies the active AI workflows.
5. Click the "Start Monitoring" button to begin your session.

The dashboard displays three main areas: the Timeline, the Cost Tracker, and the Anomaly Log.

## 🕰️ Time-Travel Debugging

The Timeline feature records every interaction your agent makes. You see the user input, the internal thought process of the agent, and the final output. If you want to check a past event, click any entry in the Timeline. This restores the exact state of the agent at that moment. You can browse through previous messages to find the exact point where a logic error started.

## 💰 Cost Tracking

AI models use tokens that cost money. Agentlens adds up these costs in real time. You see a live graph of your spending per task. You have the ability to filter costs by model, user, or specific agent. This helps you identify expensive tasks that do not provide enough value.

## ⚠️ Anomaly Detection

Agents sometimes fail in quiet ways. They might loop, output empty responses, or break internal rules. Agentlens watches for these patterns. When it finds a behavior that looks wrong, it highlights it in the Anomaly log. You get a notification so you can inspect the issue before it affects your end users.

## 🧩 Working with MCP

Agentlens supports the Model Context Protocol. This protocol standardizes how your agents talk to external tools and data sources. If your workflow uses MCP connections, Agentlens validates these links automatically. It confirms that the agent successfully reached the external resource and received the expected data.

## 🔧 Frequently Asked Questions

**Does the software send my data to a server?**
No. All your data stays on your local machine. Agentlens runs locally to keep your logs and agent history private.

**Which AI models does it support?**
It supports most common LLMs. If you use a standard framework, Agentlens detects the prompts and response flow automatically.

**What happens if I encounter an error during install?**
Try restarting your computer and running the installer as an administrator. Windows might show a security prompt because the file is from the internet; select "Run anyway" if the system asks.

**Can I export my logs?**
Yes. You can export your session data as a CSV file for your records or to share with your team. Use the "File" menu and select "Export report" to save your data.

**How do I update the application?**
When a new version exists, the app notifies you. Visit the [releases page](https://github.com/kayde3794/agentlens/releases) to download the latest installer. Installing the new version overwrites the old one but keeps your settings.

**Is this tool free to use?**
Agentlens is available for personal and professional use. Check the repository documentation for specific license terms if you use it in a large company.

**Does it slow down my agents?**
The overhead is minimal. Agentlens records data in the background without interrupting the primary AI execution flow. You should notice no difference in speed during normal operations.