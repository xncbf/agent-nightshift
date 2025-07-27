# Contributing to Agent Nightshift 🌙

Thank you for your interest in contributing to Agent Nightshift! This guide will help you get started with development and testing.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- macOS (primary development platform)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/agent-nightshift.git
   cd agent-nightshift
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   - Copy `.env.example` to `.env` (if exists)
   - Add your API keys for testing

4. **Start development server**
   ```bash
   npm run dev
   ```

## 🧪 Testing

We use Vitest for unit and integration testing. Tests are crucial for ensuring the reliability of Agent Nightshift, especially for critical features like loop execution and workflow management.

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (recommended during development)
npm test:watch

# Run tests with coverage
npm test -- --coverage
```

### Test Structure

```
src/renderer/__tests__/
├── setup.ts                 # Test environment setup
├── loopExecution.test.ts    # Loop detection and execution logic
├── loopIntegration.test.ts  # Integration tests for loop functionality
└── ... (other test files)
```

### Writing Tests

#### Unit Tests
Test individual functions and components in isolation:

```typescript
import { describe, it, expect } from 'vitest'
import { LoopDetector } from '../services/loopDetector'

describe('LoopDetector', () => {
  it('should detect loops from task patterns', () => {
    const tasks = [
      { id: 'task1', title: 'Run tests', ... },
      { id: 'task2', title: 'Fix errors', ... }
    ]
    
    const loops = LoopDetector.detectLoops(tasks)
    expect(loops).toHaveLength(1)
  })
})
```

#### Integration Tests
Test how different parts work together:

```typescript
import { renderHook, act } from '@testing-library/react-hooks'
import { useStore } from '../store/useStore'

describe('Loop Integration', () => {
  it('should handle loop execution on task failure', async () => {
    const { result } = renderHook(() => useStore())
    // Test the full loop execution flow
  })
})
```

### Testing Guidelines

1. **Test Naming**: Use descriptive test names that explain what is being tested
   - ✅ `should retry task when it fails within a loop`
   - ❌ `test loop`

2. **Test Coverage**: Aim for high coverage on critical paths
   - Loop execution logic
   - Workflow state management
   - Error handling

3. **Mock External Dependencies**
   ```typescript
   // Mock Electron API
   global.window.electronAPI = {
     executeTask: vi.fn(),
     // ... other mocks
   }
   ```

4. **Test Both Success and Failure Cases**
   ```typescript
   it('should handle successful task execution', () => { ... })
   it('should handle task failure and retry', () => { ... })
   ```

## 🏗️ Architecture Overview

### Key Components

1. **Store (Zustand)**
   - Central state management
   - Job and workflow state
   - Loop execution logic

2. **Loop System**
   - `LoopDetector`: Analyzes tasks for loop patterns
   - `LoopConfig`: Loop configuration interface
   - Execution logic in `useStore`

3. **UI Components**
   - `WorkflowDAG`: Visual workflow representation
   - `LoopNotification`: Loop suggestion UI
   - `PlanEditor`: Manual loop creation

### Adding New Features

1. **Update Types** (`src/renderer/types/`)
2. **Implement Logic** (store or services)
3. **Create UI Components**
4. **Write Tests**
5. **Update Documentation**

## 📝 Code Style

- TypeScript for type safety
- React functional components with hooks
- Tailwind CSS for styling
- Follow existing patterns in the codebase

### Linting

```bash
# Run linter
npm run lint

# Fix linting issues
npm run lint -- --fix
```

## 🐛 Debugging

### Electron DevTools
- Press `Cmd+Option+I` (macOS) to open DevTools
- Use React DevTools extension for component debugging

### Logging
```typescript
console.log('🔄 Loop detected:', loop)
console.error('❌ Task failed:', error)
```

## 📚 Key Features to Test

### Loop Functionality
- Loop detection from PRD
- Manual loop creation
- Loop execution and retry logic
- Visual indicators in DAG

### Workflow Execution
- Task dependencies
- Parallel execution
- Error handling
- State persistence

## 🤝 Submitting Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write tests for new functionality
   - Ensure all tests pass
   - Follow code style guidelines

3. **Commit with clear messages**
   ```bash
   git commit -m "feat: add loop visualization in DAG"
   ```

4. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

### Commit Message Format
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `test:` Test additions/changes
- `refactor:` Code refactoring
- `style:` Code style changes

## 🔍 Testing Checklist

Before submitting a PR, ensure:

- [ ] All tests pass (`npm test`)
- [ ] New features have tests
- [ ] No linting errors (`npm run lint`)
- [ ] Documentation is updated
- [ ] Commit messages follow convention

## 💡 Tips for Contributors

1. **Start Small**: Pick a small issue or bug fix to familiarize yourself with the codebase
2. **Ask Questions**: Don't hesitate to ask for clarification in issues or discussions
3. **Test Thoroughly**: Especially for loop and workflow execution features
4. **Document Your Changes**: Update relevant documentation and add code comments where necessary

## 🆘 Getting Help

- Open an issue for bugs or feature requests
- Join discussions for questions about the architecture
- Tag maintainers for code review

Thank you for contributing to Agent Nightshift! Together, we're building the future of AI-powered overnight development. 🚀🌙