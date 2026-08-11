const os = require('os');
const statsService = require('../services/statsService');

async function getSystemStats(req, res, next) {
  try {
    const peers = await statsService.getPeersStats();
    const totalMemory = os.totalmem();
    const usedMemory = totalMemory - os.freemem();
    return res.json({
      peers,
      server: {
        cpuUsage: null,
        cpuStatus: 'unavailable',
        ramUsage: totalMemory ? Math.round((usedMemory / totalMemory) * 100) : null,
        uptime: os.uptime()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getSystemStats };
