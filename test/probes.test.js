// Run the real entrypoint definitions with isolated I/O; never start a tunnel or download binaries.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { EventEmitter } = require('events');
const entrypoint = process.argv[2] || path.join(__dirname, '..', 'index.js');
const entrySource = fs.readFileSync(entrypoint, 'utf8');
// Obfuscators can rewrite .catch to [decoder(...)]. Never execute the entrypoint
// if we cannot locate its startup boundary: that could open a real HTTP server.
const startup = /\bstartserver\s*\(\s*\)\s*(?:\.catch\b|\[)/.exec(entrySource);
assert(startup, 'Cannot isolate startserver invocation; update the test loader for this source format');
const source = entrySource.slice(0, startup.index);

function load(env = {}, platform = 'linux', arch = 'x64', failure = false) {
  const calls = { downloads: [], spawns: [], errors: [], writes: [], children: [], timers: [] };
  const fakeFs = {
    existsSync: () => false, mkdirSync() {}, chmodSync() {},
    writeFileSync: (...args) => calls.writes.push(args)
  };
  const context = vm.createContext({
    require(name) {
      if (name === 'axios') return {};
      if (name === 'fs') return fakeFs;
      if (name === 'path') return path.posix;
      if (name === 'os') return { arch: () => arch };
      if (name === 'child_process') return {
        exec() {}, execSync() {},
        spawn(...args) { calls.spawns.push(args); const child = new EventEmitter(); child.unref = () => {}; calls.children.push(child); return child; }
      };
      if (['crypto', 'util'].includes(name)) return require(name);
      // Even a future loader regression must not create a live listener.
      if (name === 'http') return { createServer() { throw new Error('Tests must not start the HTTP server'); } };
      throw new Error(`Unexpected module in probe test: ${name}`);
    },
    process: { env, platform, stdout: { write() {} } },
    console: { log() {}, error: (...args) => calls.errors.push(args.join(' ')) },
    setTimeout(callback, delay) { calls.timers.push({ callback, delay }); return { unref() {} }; }, URL, Buffer,
    downloadStub(file, url, callback) { calls.downloads.push({ file, url }); callback(failure ? 'download failed' : null); }
  });
  vm.runInContext(source, context, { timeout: 2000 });
  vm.runInContext('downloadFile = downloadStub', context);
  return { calls, run: code => vm.runInContext(code, context) };
}

(async () => {
  const nezha = { PROBE_TYPE: 'nezha', NEZHA_SERVER: 'nz.example.com', NEZHA_KEY: 'test-key' };
  for (const port of ['', '5555']) {
    const app = load({ ...nezha, NEZHA_PORT: port });
    assert.strictEqual(app.run("getFilesForArchitecture('amd').length"), 3);
    assert(app.run("getFilesForArchitecture('amd')[0].fileUrls[0]").endsWith(port ? '/agent' : '/v1'));
    await app.run('startLiteAgent()');
    assert.strictEqual(app.calls.downloads.length, 0);
  }
  for (const type of ['lite', 'none', 'invalid']) {
    const app = load({ ...nezha, PROBE_TYPE: type });
    assert.strictEqual(app.run("getFilesForArchitecture('amd').length"), 2);
  }
  assert.strictEqual(load().run("getFilesForArchitecture('amd').length"), 2);
  const config = { PROBE_TYPE: ' LiTe ', LITE_SERVER: 'https://lite.example.com', LITE_TOKEN: "secret ' $(touch /tmp/no)" };
  for (const [arch, asset] of [['x64', 'amd64'], ['arm64', 'arm64'], ['arm', 'arm'], ['ia32', '386']]) {
    const app = load({ ...nezha, ...config }, 'linux', arch);
    await app.run('startLiteAgent()');
    assert(app.calls.downloads[0].url.endsWith(`/latest/download/Lite-agent-linux-${asset}`));
    assert.strictEqual(app.calls.spawns.length, 1);
    const [binary, args, options] = app.calls.spawns[0];
    assert(binary.endsWith('/lite/Lite-agent'));
    assert(args.includes('--disable-auto-update=false'));
    assert(args.includes('--enable-remote-control=true'));
    assert(!args.includes(config.LITE_TOKEN));
    assert.strictEqual(options.env.AGENT_TOKEN, config.LITE_TOKEN);
    assert.strictEqual(options.env.LITE_AGENT_SKIP_RELOCATE, '1');
    assert.strictEqual(options.shell, undefined);
    assert.strictEqual(options.cwd, path.posix.dirname(binary));
    assert.strictEqual(app.calls.errors.length, 0);
  }
  const latest = load({ ...config, LITE_AGENT_VERSION: 'latest' });
  assert(latest.run('getLiteDownloadUrl()').includes('/releases/latest/download/'));
  const pinned = load({ ...config, LITE_AGENT_VERSION: '2.3.10.1', AGENT_DISABLE_AUTO_UPDATE: 'true', AGENT_REMOTE_CONTROL_ENABLED: 'false' });
  await pinned.run('startLiteAgent()');
  assert(pinned.calls.downloads[0].url.includes('/download/2.3.10.1/'));
  pinned.calls.children[0].emit('exit', 42, null);
  const restarts = pinned.calls.timers.filter(timer => timer.delay === 1000);
  assert.strictEqual(restarts.length, 1);
  restarts[0].callback();
  assert.strictEqual(pinned.calls.spawns.length, 2);
  assert.strictEqual(pinned.calls.downloads.length, 1);
  assert.deepStrictEqual(pinned.calls.spawns[1], pinned.calls.spawns[0]);
  assert(pinned.calls.spawns[1][1].includes('--disable-auto-update=false'));
  assert(pinned.calls.spawns[1][1].includes('--enable-remote-control=true'));
  for (const [code, signal] of [[1, null], [0, null], [null, 'SIGTERM']]) {
    const stopped = load(config);
    await stopped.run('startLiteAgent()');
    stopped.calls.children[0].emit('exit', code, signal);
    assert.strictEqual(stopped.calls.timers.filter(timer => timer.delay === 1000).length, 0);
  }
  for (const overrides of [
    // Whitespace reaches validation even if a deployment has nonempty defaults.
    { LITE_TOKEN: ' ' }, { LITE_SERVER: ' ' }, { LITE_SERVER: 'lite.example.com' },
    { LITE_SERVER: 'ftp://lite.example.com' }, { LITE_SERVER: 'https://user:secret@lite.example.com' },
    { LITE_AGENT_VERSION: '../bad' }
  ]) {
    const app = load({ ...config, ...overrides });
    await app.run('startLiteAgent()');
    assert.strictEqual(app.calls.spawns.length, 0);
    assert.strictEqual(app.calls.downloads.length, 0);
    assert.strictEqual(app.calls.errors.length, 1);
    assert(!app.calls.errors.join('').includes(config.LITE_TOKEN));
  }
  for (const [platform, arch] of [['win32', 'x64'], ['linux', 's390x']]) {
    const app = load(config, platform, arch);
    await app.run('startLiteAgent()');
    assert.strictEqual(app.calls.downloads.length, 0);
    assert.strictEqual(app.calls.errors.length, 1);
  }
  const failed = load(config, 'linux', 'x64', true);
  await failed.run('startLiteAgent()');
  assert.strictEqual(failed.calls.spawns.length, 0);
  assert.strictEqual(failed.calls.errors.length, 1);
  console.log('Probe tests passed: Nezha v0/v1, Lite selection, architecture, validation, safe launch, download failure.');
})().catch(error => { console.error(error); process.exitCode = 1; });
