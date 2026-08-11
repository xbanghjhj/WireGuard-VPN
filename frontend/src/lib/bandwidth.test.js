import { calculateBandwidthSample } from './bandwidth';

const live = (peers) => ({ peers });
const peer = (rxBytes, txBytes, extra = {}) => ({ enabled: true, online: true, rxBytes, txBytes, ...extra });

describe('bandwidth calculation', () => {
  test('the first sample is zero', () => {
    expect(calculateBandwidthSample(null, live([peer(1000, 2000)]), 1000)).toEqual({
      rxSpeed: 0, txSpeed: 0, snapshot: { rx: 1000, tx: 2000, time: 1000 }
    });
  });

  test('calculates increasing RX and TX counters over elapsed seconds', () => {
    expect(calculateBandwidthSample({ rx: 1000, tx: 2000, time: 1000 }, live([peer(5000, 8000)]), 3000))
      .toMatchObject({ rxSpeed: 2000, txSpeed: 3000 });
  });

  test('counter reset never produces a negative speed', () => {
    expect(calculateBandwidthSample({ rx: 9000, tx: 9000, time: 1000 }, live([peer(10, 20)]), 2000))
      .toMatchObject({ rxSpeed: 0, txSpeed: 0 });
  });

  test('a disconnected peer with unchanged traffic produces zero', () => {
    expect(calculateBandwidthSample({ rx: 100, tx: 200, time: 1000 }, live([
      peer(100, 200, { online: false })
    ]), 2000)).toMatchObject({ rxSpeed: 0, txSpeed: 0 });
  });

  test('sums multiple peers and includes recent counters before online state catches up', () => {
    expect(calculateBandwidthSample({ rx: 100, tx: 100, time: 1000 }, live([
      peer(200, 300), peer(400, 500, { online: false })
    ]), 2000)).toMatchObject({ rxSpeed: 500, txSpeed: 700 });
  });
});
