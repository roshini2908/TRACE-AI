const mongoose = require('mongoose')

const orderSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
  driverId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Driver' },
  driverName:  String,
  status:      { type: String, enum: ['pending','preparing','dispatched','delivered','cancelled'], default: 'pending' },
  items:       [{ name: String, qty: Number, price: Number }],
  totalAmount: Number,
  deliveryAddress: String,
  currentLocation: { lat: Number, lng: Number },
}, { timestamps: true })

module.exports = mongoose.model('Order', orderSchema)
