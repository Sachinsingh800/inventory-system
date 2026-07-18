// routes/purchase.routes.js
const { Router } = require('express');
const auth = require('../middlewares/auth.middleware');
const {
  createPurchaseOrder,
  verifyPurchaseOrder,
  listPurchaseOrders,
} = require('../controllers/purchase.controller');

const router = Router();

router.post('/', auth(['ADMIN']), createPurchaseOrder);
router.post('/:id/verify', auth(['ADMIN']), verifyPurchaseOrder);
router.get('/', auth(['ADMIN']), listPurchaseOrders); // NEW

module.exports = router;