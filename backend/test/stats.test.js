const { parseWgDump, safePeerDto } = require('../src/services/statsService');

describe('WireGuard dump parser and safe DTO', () => {
  test('parses wg show interface dump output', () => {
    const dump = [
      'private\tserver-public\t51820\toff',
      'peer-public\t(none)\t198.51.100.2:40000\t10.99.0.2/32\t1700000000\t1234\t5678\t25'
    ].join('\n');
    expect(parseWgDump(dump).get('peer-public')).toEqual({
      endpoint: '198.51.100.2:40000',
      lastHandshake: new Date(1700000000 * 1000).toISOString(),
      rxBytes: 1234,
      txBytes: 5678
    });
  });

  test('never copies encrypted or plaintext private key fields to DTO', () => {
    const dto = safePeerDto({
      id: 'peer_abc', name: 'safe', publicKey: 'public', privateKey: 'plain',
      privateKeyEncrypted: 'ciphertext', allowedIPs: '10.99.0.2/32', splitTunnel: 1,
      enabled: 1, needsReprovision: 0, rxBytes: 0, txBytes: 0
    });
    expect(dto).not.toHaveProperty('privateKey');
    expect(dto).not.toHaveProperty('privateKeyEncrypted');
    expect(dto.splitTunnel).toBe(true);
  });
});
