const {
  emitConnectionTransitions, stopBandwidthSocket, serverStats
} = require('../src/websocket/bandwidthSocket');

describe('WebSocket safe transition events', () => {
  afterEach(() => stopBandwidthSocket());

  test('emits connected/disconnected only on state changes', () => {
    const target = { emit: jest.fn() };
    emitConnectionTransitions(target, [{ id: 'peer_1', online: false, endpoint: null }]);
    expect(target.emit).not.toHaveBeenCalled();
    emitConnectionTransitions(target, [{ id: 'peer_1', online: true, endpoint: '198.51.100.2:5000' }]);
    emitConnectionTransitions(target, [{ id: 'peer_1', online: true, endpoint: '198.51.100.2:5000' }]);
    emitConnectionTransitions(target, [{ id: 'peer_1', online: false, endpoint: null }]);
    expect(target.emit.mock.calls).toEqual([
      ['peer:connected', { peerId: 'peer_1', endpoint: '198.51.100.2:5000' }],
      ['peer:disconnected', { peerId: 'peer_1' }]
    ]);
  });

  test('reports CPU as unavailable instead of inventing a value', () => {
    expect(serverStats()).toEqual(expect.objectContaining({ cpuUsage: null, cpuStatus: 'unavailable' }));
  });
});
