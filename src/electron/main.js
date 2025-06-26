const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1520,
    height: 980,
    minWidth: 1300,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0a0a0f',
    icon: path.join(__dirname, '../../public/icon.png')
  })

  // Development vs Production
  const isDev = process.env.NODE_ENV !== 'production'
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC Handlers for Claude Code interactions
ipcMain.handle('submit-prd', async (event, prd) => {
  // TODO: Implement PRD submission to Claude Code
  console.log('PRD Submitted:', prd)
  return { success: true, jobId: Date.now().toString() }
})

ipcMain.handle('get-job-status', async (event, jobId) => {
  // TODO: Implement job status retrieval
  return {
    status: 'running',
    progress: 45,
    currentTask: 'Building components...',
    logs: []
  }
})