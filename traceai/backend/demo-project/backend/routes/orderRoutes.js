const express = require('express')
const router  = express.Router()
const orderController = require('../controllers/orderController')
const authMiddleware  = require('../middleware/auth')

router.get('/:orderId/tracking', authMiddleware, orderController.getTracking)
router.get('/history/:userId',   authMiddleware, orderController.getHistory)
router.post('/:orderId/cancel',  authMiddleware, orderController.cancelOrder)
router.get('/:orderId',          authMiddleware, orderController.getOrder)

module.exports = router
