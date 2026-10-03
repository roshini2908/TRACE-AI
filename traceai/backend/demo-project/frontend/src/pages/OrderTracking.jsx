import React, { useEffect, useState } from 'react'
import DeliveryMap from '../components/DeliveryMap'
import orderService from '../services/orderService'

export default function OrderTracking({ orderId }) {
  const [order, setOrder] = useState(null)
  const [location, setLocation] = useState(null)

  useEffect(() => {
    orderService.getOrderStatus(orderId).then(data => {
      setOrder(data.order)
      setLocation(data.location)
    })
  }, [orderId])

  return (
    <div className="tracking-page">
      <h1>Track Your Order</h1>
      {order && (
        <div>
          <p>Status: {order.status}</p>
          <p>Driver: {order.driverName}</p>
        </div>
      )}
      <DeliveryMap location={location} />
    </div>
  )
}
