const fs = require('fs');

jest.mock('../src/config/env', () => ({
  env: {
    MOCK_WIREGUARD: false,
    WG_INTERFACE: 'wg0',
    WG_CONFIG_PATH: require('path').join(process.env.TEST_RUNTIME_DIR, 'real-wg0.conf'),
    WG_SERVER_PRIVATE_KEY_PATH: require('path').join(process.env.TEST_RUNTIME_DIR, 'real-server.key'),
    WG_SERVER_ADDRESS: '10.99.0.1/29',
    WG_SERVER_PORT: 51820
  }
}));
jest.mock('../src/db/database', () => ({ all: jest.fn() }));

const { env } = require('../src/config/env');
const wireguardService = require('../src/services/wireguardService');

const peer = { id: 'peer_1', name: 'Laptop', publicKey: 'peer-public', allowedIPs: '10.99.0.2/32' };

function runnerFor({ interfacePresent = true, syncFailure = false, stripFailure = false, peers = [peer] } = {}) {
  return {
    runFile: jest.fn(async (file, args) => {
      if (file === 'wg-quick' && args[0] === 'strip') {
        if (stripFailure) throw new Error('invalid config');
        return { stdout: '[Interface]\nListenPort = 51820\n' };
      }
      if (file === 'wg' && args[0] === 'show' && args[1] === 'interfaces') {
        return { stdout: interfacePresent ? 'wg0\n' : '' };
      }
      if (file === 'wg' && args[0] === 'syncconf' && syncFailure) throw new Error('sync failed');
      if (file === 'wg' && args[0] === 'show' && args[2] === 'dump') {
        const lines = ['private\tserver-public\t51820\toff', ...peers.map((item) => `${item.publicKey}\t(none)\t(none)\t${item.allowedIPs}\t0\t0\t0\t25`)];
        return { stdout: lines.join('\n') };
      }
      return { stdout: '' };
    })
  };
}

describe('atomic WireGuard configuration synchronization', () => {
  beforeEach(() => {
    fs.mkdirSync(process.env.TEST_RUNTIME_DIR, { recursive: true });
    fs.writeFileSync(env.WG_SERVER_PRIVATE_KEY_PATH, 'server-private\n', { mode: 0o600 });
    if (fs.existsSync(env.WG_CONFIG_PATH)) fs.unlinkSync(env.WG_CONFIG_PATH);
  });

  test.each([
    ['create peer', [peer]],
    ['enable peer', [peer]],
    ['disable peer', []],
    ['delete peer', []]
  ])('%s renders and verifies the expected runtime set', async (name, peers) => {
    const runner = runnerFor({ peers });
    const result = await wireguardService.syncWireGuardConfig({ runner, dbClient: { all: async () => peers } });
    expect(result.peerCount).toBe(peers.length);
    expect(runner.runFile).toHaveBeenCalledWith('wg-quick', ['strip', expect.stringContaining('.tmp')]);
    expect(runner.runFile).toHaveBeenCalledWith('wg', ['show', 'wg0', 'dump']);
    expect(fs.readFileSync(env.WG_CONFIG_PATH, 'utf8').includes('peer-public')).toBe(peers.length === 1);
  });

  test('uses wg-quick up when the interface does not exist', async () => {
    const runner = runnerFor({ interfacePresent: false });
    await wireguardService.syncWireGuardConfig({ runner, dbClient: { all: async () => [peer] } });
    expect(runner.runFile).toHaveBeenCalledWith('wg-quick', ['up', env.WG_CONFIG_PATH]);
  });

  test('restores the previous config and throws when syncconf fails', async () => {
    fs.writeFileSync(env.WG_CONFIG_PATH, 'previous-config', { mode: 0o600 });
    const runner = runnerFor({ syncFailure: true });
    await expect(wireguardService.syncWireGuardConfig({ runner, dbClient: { all: async () => [peer] } }))
      .rejects.toThrow('sync failed');
    expect(fs.readFileSync(env.WG_CONFIG_PATH, 'utf8')).toBe('previous-config');
  });

  test('does not replace the running config when validation fails', async () => {
    fs.writeFileSync(env.WG_CONFIG_PATH, 'known-good', { mode: 0o600 });
    await expect(wireguardService.syncWireGuardConfig({
      runner: runnerFor({ stripFailure: true }), dbClient: { all: async () => [peer] }
    })).rejects.toThrow('invalid config');
    expect(fs.readFileSync(env.WG_CONFIG_PATH, 'utf8')).toBe('known-good');
  });
});
