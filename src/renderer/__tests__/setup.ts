import '@testing-library/jest-dom'

// Mock window.electronAPI
global.window = global.window || {}
global.window.electronAPI = {
  onJobUpdate: () => () => {},
  onLogUpdate: () => () => {},
  executeTask: async () => {},
  registerJob: async () => {},
  selectDirectory: async () => ({ filePaths: [] }),
}

// Mock localStorage
const localStorageMock = {
  getItem: (key: string) => null,
  setItem: (key: string, value: string) => {},
  clear: () => {},
  removeItem: (key: string) => {},
  key: (index: number) => null,
  length: 0,
}
global.localStorage = localStorageMock as Storage