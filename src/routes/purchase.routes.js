const { Router } = require('express');
const auth = require('../middlewares/auth.middleware');
const { createPurchaseOrder } = require('../controllers/purchase.controller');

const router = Router();

// create PO (admin only)
router.post('/', auth(['ADMIN']), createPurchaseOrder);

// later: router.get('/:id', auth(['ADMIN']), getPurchaseOrder);
// later: router.post('/:id/verify', auth(['ADMIN']), verifyPurchaseOrder);

module.exports = router;