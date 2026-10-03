const axios = require('axios')

const GPS_API = process.env.GPS_SERVICE_URL || 'http://gps-service:3001'

const deliveryService = {
  getDriverLocation: async (driverId) => {
    const res = await axios.get(`${GPS_API}/location/${driverId}`)
    return res.data
  },

  assignDriver: async (orderId, driverId) => {
    return { orderId, driverId, assigned: true }
  },

  calculateETA: async (driverId, destination) => {
    const location = await deliveryService.getDriverLocation(driverId)
    const distance = Math.sqrt(
      Math.pow(location.lat - destination.lat, 2) +
      Math.pow(location.lng - destination.lng, 2)
    )
    return Math.round(distance * 111 / 30 * 60) // rough minutes
  },
}

module.exports = deliveryService
