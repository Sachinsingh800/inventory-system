const { Router } = require('express');
const auth = require('../middlewares/auth.middleware');
const {
  createPurchaseOrder,
  verifyPurchaseOrder,
} = require('../controllers/purchase.controller');

const router = Router();

router.post('/', auth(['ADMIN']), createPurchaseOrder);
router.post('/:id/verify', auth(['ADMIN']), verifyPurchaseOrder);

module.exports = router;