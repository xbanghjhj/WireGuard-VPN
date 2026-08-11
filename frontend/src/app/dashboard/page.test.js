import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dashboard from './page';

let mockUser = { username: 'viewer', role: 'viewer' };
const mockTogglePeer = jest.fn().mockResolvedValue({ enabled: false });
const mockUsePeers = {
  peers: [{
    id: 'peer_1', name: 'Laptop', publicKey: 'public', allowedIPs: '10.99.0.2/32',
    enabled: true, online: false, rxBytes: 0, txBytes: 0
  }],
  setPeers: jest.fn(), loading: false, error: null,
  fetchPeers: jest.fn().mockResolvedValue([]), createPeer: jest.fn(), togglePeer: mockTogglePeer,
  deletePeer: jest.fn(), downloadConfig: jest.fn(), getQRCode: jest.fn()
};

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));
jest.mock('../../lib/auth', () => ({
  getUser: () => mockUser, clearSession: jest.fn(), isAuthenticated: () => true
}));
jest.mock('../../hooks/usePeers', () => ({ __esModule: true, default: () => mockUsePeers }));
jest.mock('../../hooks/useWebSocket', () => ({
  __esModule: true, default: () => ({ stats: null, isConnected: false })
}));
jest.mock('../../components/BandwidthChart', () => ({ __esModule: true, default: () => <div>chart</div> }));
jest.mock('../../components/AddPeerModal', () => ({ __esModule: true, default: () => <div>add modal</div> }));
jest.mock('../../components/QRCodeModal', () => ({ __esModule: true, default: () => <div>qr modal</div> }));

describe('dashboard role-aware actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('viewer sees peer data without create, disable, delete, download or QR controls', async () => {
    mockUser = { username: 'viewer', role: 'viewer' };
    render(<Dashboard />);
    expect(await screen.findByText('Laptop')).toBeInTheDocument();
    expect(screen.queryByText('Thêm kết nối')).not.toBeInTheDocument();
    expect(screen.queryByTitle(/QR Code/i)).not.toBeInTheDocument();
    expect(screen.queryByTitle(/Tải tệp cấu hình/i)).not.toBeInTheDocument();
    expect(screen.queryByTitle(/Xóa vĩnh viễn/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  test('admin sees actions and can disable a peer', async () => {
    const user = userEvent.setup();
    mockUser = { username: 'admin', role: 'admin' };
    render(<Dashboard />);
    expect(await screen.findByText('Thêm kết nối')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(mockTogglePeer).toHaveBeenCalledWith('peer_1', false));
    expect(screen.getByTitle(/QR Code/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Tải tệp cấu hình/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Xóa vĩnh viễn/i)).toBeInTheDocument();
  });
});
