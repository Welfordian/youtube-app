import { app, BrowserWindow, Menu, protocol, globalShortcut, powerSaveBlocker } from 'electron'
var express = require('express');
var svr = express();

/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */

if (process.env.NODE_ENV !== 'development') {
  global.__static = require('path').join(__dirname, '/static').replace(/\\/g, '\\\\')
}

let mainWindow
const winURL = process.env.NODE_ENV === 'development'
  ? `http://localhost:9080`
  : `http://localhost:3000`

function createWindow () {
  /**
   * Initial window options
   */
  mainWindow = new BrowserWindow({
    frame: false,
    transparent: true,
    height: 34,
    useContentSize: true,
    width: 500,
    registerURLSchemeAsSecure:'file://',
    registerURLSchemeAsBypassingCSP: 'file://',
    registerURLSchemeAsPrivileged : 'file://',
    webPreferences: {
      webSecurity: false,
      allowRunningInsecureContent: true
    }
  })

  var template = [{
    label: "Application",
    submenu: [
      { label: "About Application", selector: "orderFrontStandardAboutPanel:" },
      { type: "separator" },
      { label: "Quit", accelerator: "Command+Q", click: function() { app.quit(); }}
    ]}, {
    label: "Edit",
    submenu: [
      { label: "Undo", accelerator: "CmdOrCtrl+Z", selector: "undo:" },
      { label: "Redo", accelerator: "Shift+CmdOrCtrl+Z", selector: "redo:" },
      { type: "separator" },
      { label: "Cut", accelerator: "CmdOrCtrl+X", selector: "cut:" },
      { label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:" },
      { label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:" },
      { label: "Select All", accelerator: "CmdOrCtrl+A", selector: "selectAll:" }
    ]}
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  if (process.env.NODE_ENV !== 'development') {
    svr.use(express.static('./src/'));
    svr.use(express.static(require('path').join(__dirname)));
    svr.set('views', __dirname);
    svr.set('view options', {
      layout: false
    });
    svr.listen(3000);
  }

  mainWindow.loadURL(winURL)

  mainWindow.openDevTools();

  const id = powerSaveBlocker.start('prevent-app-suspension')

  powerSaveBlocker.stop(id)

  globalShortcut.register('MediaPlayPause', () => {
    mainWindow.webContents.send('PlayPause', true)
  })

  globalShortcut.register('MediaNextTrack', () => {
    mainWindow.webContents.send('Next', true);
  })

  globalShortcut.register('MediaPreviousTrack', () => {
    mainWindow.webContents.send('Previous', true);
  })

  mainWindow.webContents.on('did-finish-load', () => {
    globalShortcut.register('MediaPlayPause', () => {
      mainWindow.webContents.send('PlayPause', 5)
    })

    globalShortcut.register('MediaNextTrack', () => {
      mainWindow.webContents.send('Next', true);
    })

    globalShortcut.register('MediaPreviousTrack', () => {
      mainWindow.webContents.send('Previous', true);
    })

  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

//app.dock.hide();

app.commandLine.appendSwitch('disable-renderer-backgrounding')

app.commandLine.appendSwitch('ignore-certificate-errors', 'true');

app.on('ready', createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})
