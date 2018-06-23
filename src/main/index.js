import { app, BrowserWindow, Menu, protocol, globalShortcut, powerSaveBlocker, session } from 'electron'
var express = require('express');
var svr = express();
const console = require('console');

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
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({responseHeaders: `default-src *; style-src 'self' http://* 'unsafe-inline'; script-src 'self' http://* 'unsafe-inline' 'unsafe-eval'`})
  })


  mainWindow = new BrowserWindow({
    frame: false,
    transparent: true,
    height: 34,
    useContentSize: true,
    width: 500,
    registerURLSchemeAsSecure:'file://',
    registerURLSchemeAsBypassingCSP: 'file://',
    registerURLSchemeAsPrivileged : 'file://',
  })

  mainWindow.webContents.on('new-window', (event, url, frameName, disposition, options, additionalFeatures) => {
    if (frameName === 'spotifyAuth' || frameName === 'youtubeAuth') {
      // open window as modal
      event.preventDefault()

      if (frameName === 'spotifyAuth') {
        Object.assign(options, {
          width: 400,
          height: 600,
          frame: true,
          transparent: false,
        })
      }

      if (frameName === 'youtubeAuth') {
        Object.assign(options, {
          width: 350,
          height: 600,
          frame: true,
          transparent: false,
        })
      }

      event.newGuest = new BrowserWindow(options)

      if (frameName === 'youtubeAuth') {
        event.newGuest.webContents.on('did-finish-load', (e, title) => {
          if (e.sender.webContents.history[1] !== undefined) {
            if (e.sender.webContents.history[1].startsWith('http://localhost')) {
              mainWindow.webContents.send('YouTubeAuthComplete', e.sender.webContents.history[1]);
              event.newGuest.close();
            }
          }
        });
      }

      event.newGuest.webContents.on('will-navigate', (e, newUrl) => {
        if (frameName === 'spotifyAuth') {
          if (newUrl.startsWith('http://localhost')) {
            mainWindow.webContents.send('SpotifyAuthComplete', newUrl);
            event.newGuest.close();
          }
        }

        if (frameName === 'youtubeAuth') {
          //console.log(newUrl);
          if (newUrl.startsWith('http://localhost')) {
            mainWindow.webContents.send('YouTubeAuthComplete', newUrl);
            event.newGuest.close();
          }
        }

      });
      event.newGuest.loadURL(url);
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
