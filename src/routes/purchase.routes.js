const { Router } = require('express');
const auth = require('../middlewares/auth.middleware');
const {
  createPurchaseOrder,
  verifyPurchaseOrder,
  listPurchaseOrders,
  updatePurchaseOrder,
} = require('../controllers/purchase.controller');

const router = Router();

router.post('/', auth(['ADMIN']), createPurchaseOrder);
router.post('/:id/verify', auth(['ADMIN']), verifyPurchaseOrder);
router.get('/', auth(['ADMIN']), listPurchaseOrders);
router.patch('/:id', auth(['ADMIN']), updatePurchaseOrder);

module.exports = router;