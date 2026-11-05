import { it, expect } from 'vitest';
import { configuredRoleGateway, roleGatewayUrl } from '../../src/shared/domain/role-gateway.js';

it('uses the private API loopback when public HTTP points at a LAN address or future domain', () => {
  for (const publicBaseUrl of ['http://192.168.31.20:38480', 'http://assets.example.com']) {
    expect(configuredRoleGateway({ publicBaseUrl, host: '127.0.0.1', port: 38410, codex: {} }).origin).toBe('http://127.0.0.1:38410');
  }
  expect(roleGatewayUrl('http://[::1]:38410').hostname).toBe('[::1]');
  expect(configuredRoleGateway({ publicBaseUrl: 'https://assets.example.com', host: '127.0.0.1', port: 3100,
    codex: { gatewayOrigin: 'http://127.0.0.1:38410' } }).origin).toBe('http://127.0.0.1:38410');
});

it('rejects HTTP capabilities sent to DNS, LAN, external IPs, URL credentials or hidden paths', () => {
  for (const value of ['http://localhost:38410', 'http://192.168.31.20:38480', 'http://example.com', 'http://127.0.0.1.evil.test',
    'http://user:secret@127.0.0.1:38410', 'http://127.0.0.1:38410/path', 'http://127.0.0.1:38410/?secret=1',
    'http://127.0.0.1:38410/#fragment', 'file:///tmp/socket', 'https://host/path', 'https://host/#fragment']) {
    expect(() => roleGatewayUrl(value)).toThrow();
  }
  expect(() => configuredRoleGateway({ publicBaseUrl: 'http://assets.example.com', host: '192.168.31.20', port: 3100, codex: {} })).toThrow();
  expect(roleGatewayUrl('https://gateway.example.com').origin).toBe('https://gateway.example.com');
});
