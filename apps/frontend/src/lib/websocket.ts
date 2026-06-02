import { io, Socket } from 'socket.io-client'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001'

let socket: Socket | null = null

export const connectWebSocket = (token: string) => {
  if (socket?.connected) return socket

  socket = io(WS_URL, {
    auth: { token },
    transports: ['websocket'],
  })

  socket.on('connect', () => {
    console.log('WebSocket connected')
  })

  socket.on('disconnect', () => {
    console.log('WebSocket disconnected')
  })

  return socket
}

export const disconnectWebSocket = () => {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export const getSocket = () => socket

export const joinBusinessRoom = (businessId: string) => {
  if (!socket) return
  socket.emit('joinBusiness', businessId)
}

export const leaveBusinessRoom = (businessId: string) => {
  if (!socket) return
  socket.emit('leaveBusiness', businessId)
}

export const joinUserRoom = (userId: string) => {
  if (!socket) return
  socket.emit('joinUser', userId)
}

export const leaveUserRoom = (userId: string) => {
  if (!socket) return
  socket.emit('leaveUser', userId)
}

export const subscribeToMessages = (businessId: string, callback: (message: any) => void) => {
  if (!socket) return () => {}

  joinBusinessRoom(businessId)
  const handler = (payload: any) => callback(payload)
  socket.on('newMessage', handler)
  return () => {
    socket?.off('newMessage', handler)
    leaveBusinessRoom(businessId)
  }
}

export const subscribeToAdminNotifications = (callback: (notification: any) => void) => {
  if (!socket) return () => {}

  const handler = (payload: any) => callback(payload)
  socket.on('adminNotification', handler)
  return () => {
    socket?.off('adminNotification', handler)
  }
}

type BotRuleEventPayload = {
  businessId: string
  action: 'created' | 'updated' | 'deleted'
  rule: any
}

export const subscribeToBotRuleEvents = (
  callback: (event: BotRuleEventPayload) => void,
) => {
  if (!socket) return () => {}
  const handler = (payload: BotRuleEventPayload) => callback(payload)
  socket.on('botRuleEvent', handler)
  return () => {
    socket?.off('botRuleEvent', handler)
  }
}
