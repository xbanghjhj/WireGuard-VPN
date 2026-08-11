import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from './page';
import api from '../../lib/api';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: jest.fn() }) }));
jest.mock('../../lib/api', () => ({ __esModule: true, default: { post: jest.fn() } }));
jest.mock('../../lib/auth', () => ({ setSession: jest.fn(), isAuthenticated: jest.fn(() => false) }));

test('shows a backend login error', async () => {
  const user = userEvent.setup();
  api.post.mockRejectedValueOnce({ response: { data: { message: 'Invalid username or password.' } } });
  render(<Login />);
  await user.type(screen.getByRole('textbox'), 'viewer');
  await user.type(screen.getByPlaceholderText(/mật khẩu của bạn/i), 'wrong-password');
  await user.click(screen.getByRole('button', { name: /Đăng nhập Hệ thống/i }));
  expect(await screen.findByText('Invalid username or password.')).toBeInTheDocument();
});
