const fs = require('fs');

jest.mock('../src/config/env', () => ({
  env: {
    MOCK_WIREGUARD: false,
    WG_SERVER_PRIVATE_KEY_PATH: require('path').join(process.env.TEST_RUNTIME_DIR, 'service-private.key'),
    WG_SERVER_PUBLIC_KEY_PATH: require('path').join(process.env.TEST_RUNTIME_DIR, 'service-public.key')
  }
}));

const { env } = require('../src/config/env');
const keyService = require('../src/services/keyService');
const iptablesService = require('../src/services/iptablesService');

describe('key generation and supplementary firewall commands', () => {
  beforeEach(() => {
    fs.mkdirSync(process.env.TEST_RUNTIME_DIR, { recursive: true });
    for (const file of [env.WG_SERVER_PRIVATE_KEY_PATH, env.WG_SERVER_PUBLIC_KEY_PATH]) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  });

  test('real key generation pipes wg genkey into wg pubkey without a shell', async () => {
    const runner = { runFile: jest.fn()
      .mockResolvedValueOnce({ stdout: 'private-key\n' })
      .mockResolvedValueOnce({ stdout: 'public-key\n' }) };
    await expect(keyService.generateKeyPair(runner)).resolves.toEqual({
      privateKey: 'private-key', publicKey: 'public-key', mock: false
    });
    expect(runner.runFile).toHaveBeenNthCalledWith(1, 'wg', ['genkey']);
    expect(runner.runFile).toHaveBeenNthCalledWith(2, 'wg', ['pubkey'], { input: 'private-key\n' });
  });

  test('real key generation stops when wg fails', async () => {
    const runner = { runFile: jest.fn().mockRejectedValue(new Error('wg unavailable')) };
    await expect(keyService.generateKeyPair(runner)).rejects.toThrow('wg unavailable');
    expect(runner.runFile).toHaveBeenCalledTimes(1);
  });

  test('server private key file is mode 0600', async () => {
    const runner = { runFile: jest.fn()
      .mockResolvedValueOnce({ stdout: 'private-key\n' })
      .mockResolvedValueOnce({ stdout: 'public-key\n' }) };
    await keyService.ensureServerKeyPair(runner);
    if (process.platform === 'win32') expect(fs.existsSync(env.WG_SERVER_PRIVATE_KEY_PATH)).toBe(true);
    else expect(fs.statSync(env.WG_SERVER_PRIVATE_KEY_PATH).mode & 0o777).toBe(0o600);
  });

  test('block is idempotent and uses argument lists', async () => {
    const runner = { runFile: jest.fn().mockRejectedValueOnce(new Error('missing')).mockResolvedValue({ stdout: '' }) };
    await iptablesService.blockClientIP('10.99.0.2/32', runner);
    expect(runner.runFile).toHaveBeenNthCalledWith(1, 'iptables', ['-C', 'FORWARD', '-s', '10.99.0.2', '-j', 'DROP']);
    expect(runner.runFile).toHaveBeenNthCalledWith(2, 'iptables', ['-I', 'FORWARD', '-s', '10.99.0.2', '-j', 'DROP']);
  });

  test('unblock removes all matching rules and rejects invalid input', async () => {
    const runner = { runFile: jest.fn()
      .mockResolvedValueOnce({ stdout: '' }).mockResolvedValueOnce({ stdout: '' })
      .mockRejectedValueOnce(new Error('missing')) };
    await iptablesService.unblockClientIP('10.99.0.2', runner);
    expect(runner.runFile).toHaveBeenCalledTimes(3);
    expect(() => iptablesService.normalizeClientAddress('10.99.0.2;rm -rf /')).toThrow();
  });
});
