import { useEffect } from 'react'
import { socket } from '../lib/socket'
import { useStore } from '../store/useStore'

export const useSocket = () => {
  const { currentUser } = useStore()
  const userId = currentUser?.id

  useEffect(() => {
    if (!userId) {
      if (socket.connected) {
        console.log('🔌 Desconectando Socket (Usuario deslogueado)')
        socket.disconnect()
      }
      return
    }

    if (!socket.connected) {
      socket.io.opts.query = { userId }
      socket.connect()
    }

    socket.off('connect')
    socket.off('disconnect')

    socket.on('connect', () => console.log('✅ Conectado a WebSockets'))
    socket.on('disconnect', () => console.log('❌ Desconectado de WebSockets'))

    return () => {
      // Mantenemos la conexión viva entre páginas
    }
  }, [userId])

  return socket
}
