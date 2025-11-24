import http from 'http'
import { Server } from 'socket.io'
import { verifyToken } from '../config/jwt'

let io: Server | null = null

export function initRealtime(server: http.Server) {
  if (io) return io
  io = new Server(server, {
    cors: {
      origin: (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
      credentials: true,
    },
  })

  io.use((socket, next) => {
    try {
      const token = (socket.handshake.auth as any)?.token || socket.handshake.query?.token
      if (!token || typeof token !== 'string') return next(new Error('Unauthorized'))
      const payload = verifyToken(token)
      ;(socket as any).user = payload
      socket.join(`user:${payload.userId}`)
      next()
    } catch (e) {
      next(new Error('Unauthorized'))
    }
  })

  io.on('connection', socket => {
    socket.on('chat:join', (chatId: string) => {
      if (!chatId) return
      socket.join(`chat:${chatId}`)
    })
    socket.on('chat:leave', (chatId: string) => {
      if (!chatId) return
      socket.leave(`chat:${chatId}`)
    })
  })

  return io
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.io not initialized')
  return io
}

export function emitToUser(userId: string | bigint, event: string, payload: any) {
  if (!io) return
  io.to(`user:${userId.toString()}`).emit(event, payload)
}

export function emitToChat(chatId: string | bigint, event: string, payload: any) {
  if (!io) return
  io.to(`chat:${chatId.toString()}`).emit(event, payload)
}


