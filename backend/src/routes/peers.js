const express = require('express');
const net = require('net');
const { z } = require('zod');
const peerController = require('../controllers/peerController');
const { verifyToken, requireRole } = require('../middleware/auth');
const validateRequest = require('../middleware/validateRequest');

const router = express.Router();
const empty = z.object({});
const id = z.string().regex(/^peer_[a-f0-9]{12,64}$/);
const idRequest = z.object({ body: empty, params: z.object({ id }), query: empty });
const dns = z.string().max(200).refine((value) => value.split(',').every((item) => net.isIP(item.trim())), 'DNS must contain comma-separated IP addresses');
const createRequest = z.object({
  body: z.object({ name: z.string().trim().min(1).max(100), dns: dns.optional(), splitTunnel: z.boolean().default(true) }).strict(),
  params: empty, query: empty
});
const updateRequest = z.object({
  body: z.object({ enabled: z.boolean() }).strict(), params: z.object({ id }), query: empty
});

router.use(verifyToken);
router.get('/', peerController.getPeers);
router.post('/', requireRole('admin'), validateRequest(createRequest), peerController.createPeer);
router.get('/:id', validateRequest(idRequest), peerController.getPeerById);
router.patch('/:id', requireRole('admin'), validateRequest(updateRequest), peerController.updatePeer);
router.delete('/:id', requireRole('admin'), validateRequest(idRequest), peerController.deletePeer);
router.get('/:id/config', requireRole('admin'), validateRequest(idRequest), peerController.downloadPeerConfig);
router.get('/:id/qrcode', requireRole('admin'), validateRequest(idRequest), peerController.getPeerQRCode);

module.exports = router;
