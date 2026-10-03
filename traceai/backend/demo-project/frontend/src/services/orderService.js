import axios from 'axios'

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api'

const orderService = {
  getOrderStatus: (orderId) =>
    axios.get(`${API_BASE}/orders/${orderId}/tracking`).then(r => r.data),

  getOrderHistory: (userId) =>
    axios.get(`${API_BASE}/orders/history/${userId}`).then(r => r.data),

  cancelOrder: (orderId) =>
    axios.post(`${API_BASE}/orders/${orderId}/cancel`).then(r => r.data),
}

export default orderService
