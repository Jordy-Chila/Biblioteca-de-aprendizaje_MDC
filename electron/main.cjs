// Proceso principal de Electron: sirve dist/ con un protocolo propio (app://)
// para que workers (pdf.js, tesseract) y módulos ES funcionen igual que en web.
const { app, BrowserWindow, protocol, net, shell, ipcMain } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
]);

const DIST = path.join(__dirname, '..', 'dist');

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#070b10',
    title: 'SES Lab 3D',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'preload.cjs') },
  });
  // Enlaces externos se abren en el navegador del sistema
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.loadURL('app://local/index.html');
}

// Fuentes médicas que el tutor puede consultar (sin CORS en el navegador, por eso pasan por aquí)
const HOSTS_PERMITIDOS = new Set(['wsearch.nlm.nih.gov', 'medlineplus.gov', 'eutils.ncbi.nlm.nih.gov', 'es.wikipedia.org']);
ipcMain.handle('ses:fetch-text', async (_e, url) => {
  const u = new URL(String(url));
  if (u.protocol !== 'https:' || !HOSTS_PERMITIDOS.has(u.hostname)) throw new Error('Origen no permitido');
  const r = await net.fetch(u.toString(), { headers: { 'User-Agent': 'SES-Lab3D/1.0 (educational)' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
});

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const { pathname } = new URL(req.url);
    const file = path.normalize(path.join(DIST, decodeURIComponent(pathname)));
    if (!file.startsWith(DIST)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
