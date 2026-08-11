const net = require('net');
const { env } = require('../config/env');
const commandRunner = require('./commandRunner');

function normalizeClientAddress(value) {
  const [ip, prefix] = String(value || '').split('/');
  if (net.isIP(ip) !== 4 || (prefix !== undefined && (!/^\d+$/.test(prefix) || Number(prefix) > 32))) {
    throw new Error('A valid IPv4 address or CIDR is required.');
  }
  return ip;
}

async function blockClientIP(clientAddress, runner = commandRunner) {
  const ip = normalizeClientAddress(clientAddress);
  if (env.MOCK_WIREGUARD) return true;
  try {
    await runner.runFile('iptables', ['-C', 'FORWARD', '-s', ip, '-j', 'DROP']);
  } catch {
    await runner.runFile('iptables', ['-I', 'FORWARD', '-s', ip, '-j', 'DROP']);
  }
  return true;
}

async function unblockClientIP(clientAddress, runner = commandRunner) {
  const ip = normalizeClientAddress(clientAddress);
  if (env.MOCK_WIREGUARD) return true;
  let ruleExists = true;
  while (ruleExists) {
    try {
      await runner.runFile('iptables', ['-C', 'FORWARD', '-s', ip, '-j', 'DROP']);
      await runner.runFile('iptables', ['-D', 'FORWARD', '-s', ip, '-j', 'DROP']);
    } catch {
      ruleExists = false;
    }
  }
  return true;
}

module.exports = { normalizeClientAddress, blockClientIP, unblockClientIP };
