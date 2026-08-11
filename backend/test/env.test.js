const { loadEnv } = require('../src/config/env');

const valid = {
  ...process.env,
  NODE_ENV: 'production'
};

describe('environment validation', () => {
  test('accepts a complete production configuration', () => {
    expect(loadEnv(valid).NODE_ENV).toBe('production');
  });

  test.each(['JWT_SECRET', 'ADMIN_USERNAME', 'ADMIN_PASSWORD', 'WG_INTERFACE', 'WG_CONFIG_PATH',
    'WG_SERVER_ADDRESS', 'WG_SERVER_SUBNET', 'WG_CLIENT_ALLOWED_IPS', 'WG_SERVER_PORT',
    'SERVER_PUBLIC_IP', 'DB_PATH', 'CORS_ORIGIN'])(
    'production fails when %s is absent',
    (field) => {
      const source = { ...valid };
      delete source[field];
      expect(() => loadEnv(source)).toThrow(`Invalid environment configuration: ${field}`);
    }
  );

  test('rejects weak secrets and invalid CIDR values', () => {
    expect(() => loadEnv({ ...valid, JWT_SECRET: 'super_secret_wireguard_key_2026' })).toThrow();
    expect(() => loadEnv({ ...valid, WG_SERVER_SUBNET: '10.99.999.0/24' })).toThrow();
  });
});
