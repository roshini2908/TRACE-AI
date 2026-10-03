const Order          = require('../models/Order')
const deliveryService = require('../services/deliveryService')

exports.getTracking = async (req, res) => {
  const order    = await Order.findById(req.params.orderId)
  const location = await deliveryService.getDriverLocation(order.driverId)
  res.json({ order, location })
}

exports.getHistory = async (req, res) => {
  const orders = await Order.find({ userId: req.params.userId }).sort('-createdAt')
  res.json({ orders })
}

exports.cancelOrder = async (req, res) => {
  await Order.findByIdAndUpdate(req.params.orderId, { status: 'cancelled' })
  res.json({ success: true })
}

exports.getOrder = async (req, res) => {
  const order = await Order.findById(req.params.orderId)
  res.json({ order })
}
