import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddPeerModal from './AddPeerModal';

test('create peer form submits name, DNS and split tunnel selection', async () => {
  const user = userEvent.setup();
  const onCreate = jest.fn().mockResolvedValue({});
  render(<AddPeerModal isOpen onClose={jest.fn()} onCreate={onCreate} />);
  await user.type(screen.getByPlaceholderText(/Nguyen Van A/i), 'Alice laptop');
  await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: /Tạo kết nối/i }));
  expect(onCreate).toHaveBeenCalledWith({
    name: 'Alice laptop', dns: '1.1.1.1, 8.8.8.8', splitTunnel: true
  });
});
