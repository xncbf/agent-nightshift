# Claude Code Nightshift (CCN)

AI-powered overnight development tool that works while you sleep.

## Quick Start

```bash
# Install dependencies
npm install

# Run in development mode
npm start

# Build for production
npm run dist
```

## Features

- PRD-based autonomous development
- Real-time progress monitoring
- Live output streaming
- Job management and history
- Checkpoint and recovery system

## Architecture

- **Frontend**: Electron + React + Tailwind CSS
- **State Management**: Zustand
- **Process Control**: Node.js child_process
- **Integration**: Claude Code MCP Server