function ipv4ToInt(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part) || Number(part) > 255)) {
    throw new Error(`Invalid IPv4 address: ${ip}`);
  }
  return parts.reduce((value, part) => (value * 256) + Number(part), 0) >>> 0;
}

function intToIpv4(value) {
  return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join('.');
}

function parseCidr(cidr) {
  const [ip, prefixText, extra] = cidr.split('/');
  const prefix = Number(prefixText);
  if (extra !== undefined || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    throw new Error(`Invalid IPv4 CIDR: ${cidr}`);
  }
  const address = ipv4ToInt(ip);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const network = (address & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  return { address, prefix, network, broadcast };
}

function allocateIp({ subnet, serverAddress, usedAddresses }) {
  const range = parseCidr(subnet);
  const server = parseCidr(serverAddress).address;
  if (server < range.network || server > range.broadcast) {
    throw new Error('WG_SERVER_ADDRESS is not inside WG_SERVER_SUBNET.');
  }
  const used = new Set(usedAddresses.map((item) => ipv4ToInt(item.split('/')[0])));
  for (let candidate = range.network + 1; candidate < range.broadcast; candidate += 1) {
    if (candidate !== server && !used.has(candidate)) return `${intToIpv4(candidate)}/32`;
  }
  const error = new Error('WireGuard address pool is exhausted.');
  error.status = 409;
  throw error;
}

let allocationQueue = Promise.resolve();
async function withAllocationLock(callback) {
  const previous = allocationQueue;
  let release;
  allocationQueue = new Promise((resolve) => { release = resolve; });
  await previous;
  try { return await callback(); } finally { release(); }
}

module.exports = { ipv4ToInt, intToIpv4, parseCidr, allocateIp, withAllocationLock };
