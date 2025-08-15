# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agent Nightshift is an Electron-based desktop application that enables autonomous AI-powered development while developers sleep. It integrates with Claude Code via MCP (Model Context Protocol) to execute complex development tasks based on PRD (Product Requirements Document) inputs.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (Vite + Electron)
npm start

# Run Vite dev server only
npm run dev

# Build production version
npm run build

# Package Electron app
npm run dist

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Architecture Overview

### Core Components

1. **Electron Main Process** (`src/electron/main.js`)
   - Manages IPC communication between renderer and AI providers
   - Handles job execution and process management
   - Integrates with Claude CLI and validates environment

2. **Renderer Process** (`src/renderer/`)
   - React + TypeScript UI built with Vite
   - Zustand for state management (`src/renderer/store/useStore.ts`)
   - Tailwind CSS for styling

3. **Workflow System**
   - **WorkflowAI Service** (`src/renderer/services/workflowAI.ts`): Creates DAGs from prompts without AI
   - **Task Separation**: Tasks are separated by double newlines (`\n\n`)
   - **Marker-based Structure**: Uses `===parallel===`, `===parallel-group===` markers (sequential is default)
   - **Loop Detection**: Automatic loop detection in DAGs (`src/renderer/services/loopDetector.ts`)

### Key Features Implementation

1. **Large Prompt Handling**
   - `PromptChunker` service splits prompts by double newlines
   - Supports prompts up to 50,000+ characters
   - No AI required for DAG creation

2. **Workflow Execution**
   - `executeWorkflowTasks` in `useStore.ts` handles task execution
   - Supports resume from failed point (preserves completed tasks)
   - Real-time progress tracking and logging

3. **UI Components**
   - **PromptsEditor**: Main input with marker insertion buttons
   - **WorkflowDAG**: Visual workflow representation using React Flow
   - **ExecutionLogs**: Real-time log streaming
   - **ProgressView**: Task execution progress

## Important Implementation Details

### Task Execution Flow
1. User enters prompts in PromptsEditor
2. WorkflowAI creates DAG without AI (sequential by default, markers for parallel)
3. User approves workflow plan
4. executeWorkflowTasks runs tasks respecting dependencies
5. Resume capability preserves completed task states

### State Management
- Global state in `useStore.ts` using Zustand
- Job states: `draft`, `planning`, `ready`, `running`, `paused`, `failed`, `completed`
- Task states: `pending`, `running`, `completed`, `failed`, `skipped`

### IPC Communication
- Main process exposes methods via `window.electronAPI`
- Renderer subscribes to job updates and log streams
- Bidirectional communication for pause/resume/stop operations

### Testing
- Test files in `src/renderer/__tests__/`
- Uses Vitest with jsdom environment
- Focus on loop execution and integration tests

## Current Limitations & Considerations

1. **No AI in Planning**: DAG creation is deterministic based on markers or parallel arrangement
2. **Task Granularity**: Tasks are defined by double newline separation
3. **Execution**: Currently simulates execution - actual Claude Code integration pending
4. **Platform**: Optimized for macOS, especially Apple Silicon

## Common Modifications

### Adding New Task Types
1. Update `TaskNode` type in `src/renderer/types/workflow.ts`
2. Modify task rendering in `src/renderer/components/nodes/TaskNode.tsx`
3. Update execution logic in `executeWorkflowTasks`

### Modifying Workflow Creation
1. Edit `src/renderer/services/workflowAI.ts`
2. Update marker parsing in `parseMarkerSections`
3. Adjust task extraction in `extractTasksFromContent`

### UI Customization
1. Components use Tailwind CSS with custom properties
2. Color scheme defined in CSS variables (`--color-nightshift-*`)
3. Layout uses flex panels with dynamic sizing