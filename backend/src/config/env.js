const path = require('path');
const net = require('net');
const { z } = require('zod');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const devDefaults = {
  JWT_SECRET: 'test-only-secret-that-is-at-least-32-bytes',
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD: 'test-only-password',
  PEER_KEY_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  WG_INTERFACE: 'wg0',
  WG_CONFIG_PATH: path.resolve(__dirname, '../../data/wg0.conf'),
  WG_SERVER_PRIVATE_KEY_PATH: path.resolve(__dirname, '../../data/server_private.key'),
  WG_SERVER_PUBLIC_KEY_PATH: path.resolve(__dirname, '../../data/server_public.key'),
  WG_SERVER_ADDRESS: '10.99.0.1/24',
  WG_SERVER_SUBNET: '10.99.0.0/24',
  WG_CLIENT_ALLOWED_IPS: '10.10.10.0/24,10.99.0.0/24',
  WG_SERVER_PORT: '51820',
  SERVER_PUBLIC_IP: '127.0.0.1',
  DB_PATH: path.resolve(__dirname, '../../data/database.sqlite'),
  CORS_ORIGIN: 'http://localhost:3001'
};

const encryptionKey = z.string().refine((value) => {
  if (/^[a-fA-F0-9]{64}$/.test(value)) return true;
  try { return Buffer.from(value, 'base64').length === 32; } catch { return false; }
}, 'must be 32 bytes encoded as base64 or 64 hexadecimal characters');

function isIpv4Cidr(value) {
  const [address, prefix, extra] = String(value).split('/');
  return extra === undefined && net.isIP(address) === 4
    && /^\d{1,2}$/.test(prefix) && Number(prefix) >= 0 && Number(prefix) <= 32;
}

function isHostOrIp(value) {
  if (net.isIP(value)) return true;
  return /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(value);
}

const weakSecrets = new Set(['super_secret_wireguard_key_2026', 'admin123', 'changeme123']);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  JWT_SECRET: z.string().min(32).refine((value) => !weakSecrets.has(value), 'must not use a known weak value'),
  JWT_EXPIRES_IN: z.string().min(2).default('2h'),
  ADMIN_USERNAME: z.string().min(3).max(64),
  ADMIN_PASSWORD: z.string().min(12).refine((value) => !weakSecrets.has(value), 'must not use a known weak value'),
  PEER_KEY_ENCRYPTION_KEY: encryptionKey,
  WG_INTERFACE: z.string().regex(/^[a-zA-Z0-9_=+.-]{1,15}$/),
  WG_CONFIG_PATH: z.string().min(1),
  WG_SERVER_PRIVATE_KEY_PATH: z.string().min(1),
  WG_SERVER_PUBLIC_KEY_PATH: z.string().min(1),
  WG_SERVER_ADDRESS: z.string().refine(isIpv4Cidr, 'must be a valid IPv4 CIDR'),
  WG_SERVER_SUBNET: z.string().refine(isIpv4Cidr, 'must be a valid IPv4 CIDR'),
  WG_CLIENT_ALLOWED_IPS: z.string().refine((value) => value.split(',').every((cidr) => isIpv4Cidr(cidr.trim())), 'must contain comma-separated IPv4 CIDRs'),
  WG_SERVER_PORT: z.coerce.number().int().min(1).max(65535),
  SERVER_PUBLIC_IP: z.string().refine(isHostOrIp, 'must be an IP address or hostname'),
  DB_PATH: z.string().min(1),
  STATS_INTERVAL: z.coerce.number().int().min(1000).default(5000),
  STATS_PERSIST_INTERVAL: z.coerce.number().int().min(30000).default(60000),
  MOCK_WIREGUARD: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  CORS_ORIGIN: z.string().url()
});

function loadEnv(source = process.env) {
  const defaults = source.NODE_ENV === 'production' ? {} : devDefaults;
  const result = schema.safeParse({ ...defaults, ...source });
  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid environment configuration: ${fields}`);
  }
  return Object.freeze(result.data);
}

const env = loadEnv();

module.exports = { env, loadEnv };
