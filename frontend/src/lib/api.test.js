import api from './api';

describe('API authentication failures', () => {
  const rejectResponse = api.interceptors.response.handlers[0].rejected;
  let consoleError;

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem('vpn_token', 'lab-token');
    localStorage.setItem('vpn_user', JSON.stringify({ role: 'viewer' }));
  });

  afterEach(() => consoleError.mockRestore());

  test('401 clears the unverified local session', async () => {
    await expect(rejectResponse({ response: { status: 401 } })).rejects.toBeDefined();
    expect(localStorage.getItem('vpn_token')).toBeNull();
  });

  test('403 preserves a valid viewer session so the UI can show authorization errors', async () => {
    await expect(rejectResponse({ response: { status: 403 } })).rejects.toBeDefined();
    expect(localStorage.getItem('vpn_token')).toBe('lab-token');
  });
});
