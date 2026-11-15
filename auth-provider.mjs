import { createHash } from 'node:crypto';

export class ApiError extends Error {
  constructor(status, message, code = 'REQUEST_FAILED') { super(message); this.status = status; this.code = code; }
}
export function firebaseConfig(env = process.env) {
  return { apiKey: env.FIREBASE_API_KEY || '', authDomain: env.FIREBASE_AUTH_DOMAIN || '',
    projectId: env.FIREBASE_PROJECT_ID || '', appId: env.FIREBASE_APP_ID || '' };
}
export function isConfigured(config) {
  return !!(config.apiKey && config.projectId && config.authDomain && config.appId);
}

// Google verifies the token through the project's official account lookup endpoint.
// Identity never comes from a profile ID, an email typed by the client or a proxy header.
export function createIdentityVerifier(config, fetcher = fetch, clock = Date.now) {
  const cache = new Map();
  return async function verify(request) {
    const header = request.headers.get('authorization') || '';
    if (!/^Bearer [A-Za-z0-9._-]{100,8192}$/.test(header)) throw new ApiError(401, 'Inicia sesión para continuar.', 'AUTH_REQUIRED');
    if (!isConfigured(config)) throw new ApiError(503, 'El acceso con cuenta todavía no está disponible.', 'AUTH_UNAVAILABLE');
    const token = header.slice(7), key = createHash('sha256').update(token).digest('hex');
    const cached = cache.get(key);
    if (cached && cached.until > clock()) return cached.user;
    let claims;
    try { claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')); } catch { throw new ApiError(401, 'La sesión no es válida.', 'AUTH_REQUIRED'); }
    const seconds = Math.floor(clock() / 1000);
    if (claims.aud !== config.projectId || claims.iss !== `https://securetoken.google.com/${config.projectId}` ||
        typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 128 ||
        !Number.isInteger(claims.exp) || claims.exp <= seconds || !Number.isInteger(claims.iat) || claims.iat > seconds + 30 ||
        !Number.isInteger(claims.auth_time) || claims.auth_time > claims.iat) {
      throw new ApiError(401, 'Tu sesión ha caducado. Vuelve a entrar.', 'AUTH_REQUIRED');
    }
    let response;
    try {
      response = await fetcher(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(config.apiKey)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }),
        signal: AbortSignal.timeout(10000)
      });
    } catch { throw new ApiError(503, 'No podemos comprobar tu acceso ahora. Vuelve a intentarlo.', 'AUTH_UNAVAILABLE'); }
    if (!response.ok) {
      if (response.status >= 500 || response.status === 429) throw new ApiError(503, 'El acceso está temporalmente ocupado. Inténtalo de nuevo.', 'AUTH_UNAVAILABLE');
      throw new ApiError(401, 'La sesión no es válida. Vuelve a entrar.', 'AUTH_REQUIRED');
    }
    const result = await response.json(), account = result.users?.[0];
    if (!account || account.localId !== claims.sub || account.disabled || Number(account.validSince || 0) > claims.auth_time) {
      throw new ApiError(401, 'La sesión no es válida. Vuelve a entrar.', 'AUTH_REQUIRED');
    }
    if (account.emailVerified !== true) throw new ApiError(403, 'Confirma tu correo antes de guardar partidas.', 'EMAIL_NOT_VERIFIED');
    const user = { userId: account.localId, name: String(account.displayName || 'Investigador').slice(0,32), email: account.email || '', emailVerified: true };
    if (cache.size >= 1000) cache.clear();
    cache.set(key, { user, until: Math.min(clock() + 15000, claims.exp * 1000) });
    return user;
  };
}
