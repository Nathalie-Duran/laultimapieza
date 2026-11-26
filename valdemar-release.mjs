import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { ApiError } from './auth-provider.mjs';

export const VALDEMAR_RELEASE = 'valdemar-s1-v1';
const algorithm = 'aes-256-gcm';
const context = Buffer.from('La Ultima Pieza\0' + VALDEMAR_RELEASE + '\0A256GCM', 'utf8');
const envelopeUrl = new URL('./valdemar-release.enc.json', import.meta.url);

function unavailable() {
  return new ApiError(503, 'El contenido de la temporada todavía está en preparación.', 'VALDEMAR_RELEASE_PENDING');
}

function fromBase64Url(value, bytes) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('INVALID_ENCODING');
  const buffer = Buffer.from(value, 'base64url');
  if ((bytes && buffer.length !== bytes) || buffer.toString('base64url') !== value) throw new Error('INVALID_ENCODING');
  return buffer;
}

function validateContent(content) {
  if (!Array.isArray(content?.stories) || content.stories.length !== 12 ||
      !Array.isArray(content.samples) || content.samples.length !== 11 ||
      typeof content.stationScript !== 'string' || !content.stationScript.trim()) throw new Error('INVALID_RELEASE');
  const ids = records => [...new Set(records.map(record => record?.id))].sort((a, b) => a - b);
  const ordered = ids(content.stories), samples = ids(content.samples);
  if (ordered.length !== 12 || ordered.some((id, i) => id !== i + 1) ||
      samples.length !== 11 || samples.some((id, i) => id !== i + 2)) throw new Error('INVALID_CASES');
}

// Build-time helper. The deployment key is generated outside the repository.
export function encryptValdemarRelease(content, key) {
  validateContent(content);
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('INVALID_KEY');
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, key, iv);
  cipher.setAAD(context);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(content), 'utf8'), cipher.final()]);
  return { release: VALDEMAR_RELEASE, algorithm: 'A256GCM', iv: iv.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'), ciphertext: ciphertext.toString('base64url') };
}

function decrypt(envelope, key) {
  if (envelope?.release !== VALDEMAR_RELEASE || envelope.algorithm !== 'A256GCM') throw new Error('INVALID_RELEASE');
  const decipher = createDecipheriv(algorithm, key, fromBase64Url(envelope.iv, 12));
  decipher.setAAD(context);
  decipher.setAuthTag(fromBase64Url(envelope.tag, 16));
  const plaintext = Buffer.concat([decipher.update(fromBase64Url(envelope.ciphertext)), decipher.final()]);
  try {
    const result = JSON.parse(plaintext.toString('utf8'));
    validateContent(result);
    return result;
  } finally { plaintext.fill(0); }
}

export function createValdemarReleaseReader(loadEnvelope) {
  let storedEnvelope;
  async function envelope() {
    // The bundle is static for the application process. Cache only ciphertext.
    storedEnvelope ||= Promise.resolve().then(loadEnvelope).catch(() => {
      storedEnvelope = undefined;
      throw unavailable();
    });
    return storedEnvelope;
  }
  return {
    async activate(store, payload) {
      const source = await envelope();
      let key;
      try {
        if (payload?.release !== VALDEMAR_RELEASE) throw new Error('INVALID_RELEASE');
        key = fromBase64Url(payload.key, 32);
        decrypt(source, key);
      } catch {
        key?.fill(0);
        throw new ApiError(400, 'El archivo de activación no corresponde a esta edición.', 'VALDEMAR_RELEASE_INVALID');
      }
      try {
        const previous = await store.installValdemarKey(VALDEMAR_RELEASE, key);
        if (!Buffer.isBuffer(previous) || previous.length !== key.length || !timingSafeEqual(previous, key)) {
          throw new ApiError(409, 'Esta edición ya tiene otro archivo de activación.', 'VALDEMAR_RELEASE_CONFLICT');
        }
      } finally { key.fill(0); }
      return { active: true, release: VALDEMAR_RELEASE };
    },
    async read(store) {
      const key = await store.getValdemarKey(VALDEMAR_RELEASE);
      if (!Buffer.isBuffer(key) || key.length !== 32) throw unavailable();
      const source = await envelope();
      try { return decrypt(source, key); }
      catch { throw unavailable(); }
    }
  };
}

const reader = createValdemarReleaseReader(async () => JSON.parse(await readFile(envelopeUrl, 'utf8')));
export const activateValdemarRelease = reader.activate;
export const readValdemarRelease = reader.read;
