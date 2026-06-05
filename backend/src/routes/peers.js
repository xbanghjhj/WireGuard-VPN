const express = require('express');
const router = express.Router();
const peerController = require('../controllers/peerController');
const verifyToken = require('../middleware/auth');

// Tất cả định tuyến trong này đều yêu cầu đăng nhập bằng JWT
router.use(verifyToken);

router.get('/', peerController.getPeers);
router.post('/', peerController.createPeer);
router.get('/:id', peerController.getPeerById);
router.patch('/:id', peerController.updatePeer);
router.delete('/:id', peerController.deletePeer);

router.get('/:id/config', peerController.downloadPeerConfig);
router.get('/:id/qrcode', peerController.getPeerQRCode);

module.exports = router;
