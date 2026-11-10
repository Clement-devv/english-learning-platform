import { refreshToken, tokenExpiresSoon } from '../api';

// Read and, when necessary, renew the JWT on every Socket.IO reconnect.
export const socketAuth = (readToken) => (done) => {
  const token = readToken();
  if (!tokenExpiresSoon(token)) return done({ token });
  refreshToken()
    .then(fresh => done({ token: fresh || readToken() || token }))
    .catch(() => done({ token: readToken() || token }));
};
