import { vi, describe, it, expect, beforeEach } from 'vitest';
vi.mock('../api', () => ({ refreshToken: vi.fn(), tokenExpiresSoon: vi.fn() }));
import { refreshToken, tokenExpiresSoon } from '../api';
import { socketAuth } from './socketAuth';
beforeEach(() => vi.resetAllMocks());
describe('socket renewal', () => {
  it('reads the latest stored token on every reconnect', () => {
    tokenExpiresSoon.mockReturnValue(false);
    let stored = 'old';
    const auth = socketAuth(() => stored), done = vi.fn();
    auth(done);
    stored = 'new';
    auth(done);
    expect(done.mock.calls).toEqual([[{ token: 'old' }], [{ token: 'new' }]]);
  });
  it('renews an expiring token before authenticating', async () => {
    tokenExpiresSoon.mockReturnValue(true);
    refreshToken.mockResolvedValue('renewed');
    const result = await new Promise(resolve => socketAuth(() => 'old')(resolve));
    expect(result).toEqual({ token: 'renewed' });
  });
  it('answers the handshake even when renewal fails', async () => {
    tokenExpiresSoon.mockReturnValue(true);
    refreshToken.mockRejectedValue(new Error('offline'));
    expect(await new Promise(resolve => socketAuth(() => 'old')(resolve))).toEqual({ token: 'old' });
  });
});
