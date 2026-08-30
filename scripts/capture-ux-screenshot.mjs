import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';

const [url, outputArg, widthArg = '1440', heightArg = '1200', scrollTarget] = process.argv.slice(2);

if (!url || !outputArg) {
  console.error('Usage: node scripts/capture-ux-screenshot.mjs <url> <output.png> [width] [height] [scroll-selector]');
  process.exit(1);
}

const width = Number.parseInt(widthArg, 10);
const height = Number.parseInt(heightArg, 10);
const output = resolve(outputArg);
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = await mkdtemp(resolve(tmpdir(), 'jameslandreth-capture-'));

const browser = spawn(chrome, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--remote-debugging-port=0',
  '--remote-allow-origins=*',
  `--user-data-dir=${profile}`,
  'about:blank',
], { stdio: 'ignore' });

function wait(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function devtoolsPort() {
  const portFile = resolve(profile, 'DevToolsActivePort');
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const [port] = (await readFile(portFile, 'utf8')).trim().split('\n');
      if (port) return port;
    } catch {
      // Chrome creates the file once its debugging endpoint is ready.
    }
    await wait(50);
  }
  throw new Error('Chrome debugging endpoint did not become ready.');
}

async function connect(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  await new Promise((resolvePromise, reject) => {
    socket.addEventListener('open', resolvePromise, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve: resolvePending, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolvePending(message.result);
  });

  return {
    send(method, params = {}) {
      id += 1;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolvePromise, reject) => pending.set(id, { resolve: resolvePromise, reject }));
    },
    close() {
      socket.close();
    },
  };
}

try {
  const port = await devtoolsPort();
  const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
  const page = pages.find((entry) => entry.type === 'page');
  if (!page?.webSocketDebuggerUrl) throw new Error('No capturable Chrome page was found.');

  const client = await connect(page.webSocketDebuggerUrl);
  await client.send('Page.enable');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: width,
    screenHeight: height,
  });
  await client.send('Page.navigate', { url });

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const { result } = await client.send('Runtime.evaluate', {
      expression: 'document.readyState === "complete" && document.fonts.status === "loaded"',
      returnByValue: true,
    });
    if (result.value) break;
    await wait(50);
  }

  await wait(500);
  await client.send('Runtime.evaluate', {
    expression: scrollTarget
      ? `document.querySelector(${JSON.stringify(scrollTarget)})?.scrollIntoView({ block: 'start' })`
      : 'window.scrollTo(0, 0)',
  });
  const { data } = await client.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  });
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, Buffer.from(data, 'base64'));
  client.close();
  console.log(`Captured ${width}×${height}: ${output}`);
} finally {
  await new Promise((resolvePromise) => {
    const timeout = setTimeout(resolvePromise, 1500);
    browser.once('exit', () => {
      clearTimeout(timeout);
      resolvePromise();
    });
    browser.kill('SIGTERM');
  });
  await rm(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
}
