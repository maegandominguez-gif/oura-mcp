# Oura MCP

Let your LLMs chat about your Oura Ring's health data via an MCP server.

## Overview

Oura MCP is a Model Context Protocol (MCP) server that provides Large Language Models (LLMs) with secure access to your Oura Ring health data. This enables AI assistants like Claude to analyze your sleep patterns, activity levels, readiness scores, and other health metrics from your Oura Ring.

## ⚠️ Privacy Disclaimer

**Important:** This MCP server passes your personal health data directly to the LLM you're using. Be aware that:
- Your Oura Ring data (sleep, activity, heart rate, etc.) will be sent to the LLM provider
- This data may be used by the LLM provider to train their models or for other purposes according to their privacy policy
- Consider reviewing your LLM provider's data handling practices before using this server
- Only use this with LLM providers you trust with your sensitive health information

## Capabilities

The Oura MCP server provides access to the following health data through 7 specialized tools:

### 📊 Available Data Types

1. **Daily Activity** (`daily-activity`) - Steps, calories burned, activity levels, and movement metrics
2. **Daily Readiness** (`daily-readiness`) - Recovery score and readiness to take on the day
3. **Daily Sleep** (`daily-sleep`) - Sleep duration, efficiency, stages, and sleep quality scores
4. **Heart Rate** (`heart-rate`) - Detailed heart rate measurements throughout the day
5. **Daily Stress** (`daily-stress`) - Stress levels and recovery periods
6. **Workouts** (`workouts`) - Exercise sessions, duration, intensity, and calories burned
7. **Daily SpO2** (`daily-spo2`) - Blood oxygen saturation levels

### 🔧 Data Filtering

All tools support date range filtering:
- **Date Format**: YYYY-MM-DD (e.g., "2024-01-15")
- **Default Behavior**: If no dates provided, returns current day's data (last 7 days for workouts)
- **Range Queries**: Specify both `startDate` and `endDate` for historical data analysis

## Requirements

- [Deno](https://deno.com/) runtime
- Oura Ring with an active subscription
- Oura API access token

## Setup

### 1. Get Your Oura API Token

1. Visit the [Oura Developer Portal](https://cloud.ouraring.com/personal-access-tokens)
2. Sign in with your Oura account
3. Generate a new Personal Access Token
4. Copy and securely store this token

### 2. Start the MCP Server

```bash
# Clone the repository
git clone https://github.com/MykalMachon/oura-mcp.git
cd oura-mcp/server

# Start the server
deno task start
```

The server will run on `http://localhost:3000` by default.

## Configuration

### VS Code Configuration

1. Install the MCP extension for VS Code
2. Add the following to your VS Code settings or use the provided `.vscode/mcp.json`:

```json
{
  "inputs": [
    {
      "type": "promptString",
      "description": "oura ring api key",
      "password": true,
      "id": "oura-api-key"
    }
  ],
  "servers": {
    "oura-mcp": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": {
        "authorization": "Bearer ${input:oura-api-key}"
      }
    }
  }
}
```

3. When prompted, enter your Oura API token

### Claude Desktop Configuration

Since this MCP server uses HTTP as a transport, you'll need to use `mcp-remote` as an intermediary to connect Claude Desktop to the HTTP server.

1. Install `mcp-remote`:
```bash
npm install -g @modelcontextprotocol/remote
```

2. Start the Oura MCP server (in a separate terminal):
```bash
cd /path/to/oura-mcp/server
deno task start
```

3. Open your Claude Desktop configuration file:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

4. Add the Oura MCP server configuration using mcp-remote:

```json
{
  "mcpServers": {
    "oura-mcp": {
      "command": "mcp-remote",
      "args": ["http://localhost:3000/mcp"],
      "env": {
        "MCP_REMOTE_HEADERS": "{\"authorization\": \"Bearer YOUR_OURA_API_TOKEN_HERE\"}"
      }
    }
  }
}
```

5. Replace `YOUR_OURA_API_TOKEN_HERE` with your actual Oura API token
6. Restart Claude Desktop

## Example Usage

Once configured, you can ask your LLM questions like:

- *"How has my sleep quality been this week?"*
- *"Show me my activity levels for the past month"*
- *"What's my readiness score today and what factors are affecting it?"*
- *"Compare my heart rate patterns from my last few workouts"*
- *"How do my stress levels correlate with my sleep quality?"*

## Environment Variables

You can customize the server behavior with these environment variables:

- `PORT` - Server port (default: 3000)
- `API_KEY` - Your Oura API token (alternative to header-based auth)
- `REDIRECT_URL` - OAuth callback URL (for future OAuth implementation)
- `CLIENT_ID` - OAuth client ID (for future OAuth implementation)
- `CLIENT_SECRET` - OAuth client secret (for future OAuth implementation)

## Development

```bash
# Start development server with hot reload
deno task dev

# Build executable
deno task build
```

## Fitness Tracker App

This repo also includes [`tracker/`](tracker/README.md) — a local, interactive
fitness journal (workouts, macros, daily journal notes) that pulls in your
Oura readiness/sleep/activity data alongside what you log by hand. See
[`tracker/README.md`](tracker/README.md) for setup.

## License

MIT License - see [LICENSE](LICENSE) file for details.
