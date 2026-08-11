const {
  ipv4ToInt, intToIpv4, parseCidr, allocateIp, withAllocationLock
} = require('../src/services/ipAllocatorService');

describe('IPv4 CIDR allocator', () => {
  test('converts IPv4 values in both directions', () => {
    expect(intToIpv4(ipv4ToInt('10.99.0.7'))).toBe('10.99.0.7');
  });

  test('allocates the first peer without using network or server addresses', () => {
    expect(allocateIp({ subnet: '10.99.0.0/29', serverAddress: '10.99.0.1/29', usedAddresses: [] }))
      .toBe('10.99.0.2/32');
  });

  test('allocates consecutive peers and fills a gap', () => {
    const base = { subnet: '10.99.0.0/29', serverAddress: '10.99.0.1/29' };
    expect(allocateIp({ ...base, usedAddresses: ['10.99.0.2/32'] })).toBe('10.99.0.3/32');
    expect(allocateIp({ ...base, usedAddresses: ['10.99.0.2/32', '10.99.0.4/32'] })).toBe('10.99.0.3/32');
  });

  test('reports pool exhaustion as a conflict', () => {
    expect(() => allocateIp({
      subnet: '10.99.0.0/30', serverAddress: '10.99.0.1/30', usedAddresses: ['10.99.0.2/32']
    })).toThrow(expect.objectContaining({ status: 409 }));
  });

  test.each(['10.99.0.0', '10.99.0.0/33', '999.1.1.1/24', 'invalid/24'])(
    'rejects invalid subnet %s',
    (subnet) => expect(() => parseCidr(subnet)).toThrow()
  );

  test('serializes concurrent allocations', async () => {
    const order = [];
    await Promise.all([
      withAllocationLock(async () => { order.push('first-start'); await Promise.resolve(); order.push('first-end'); }),
      withAllocationLock(async () => { order.push('second'); })
    ]);
    expect(order).toEqual(['first-start', 'first-end', 'second']);
  });
});
