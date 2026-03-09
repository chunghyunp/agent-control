import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { Server as SocketIOServer } from 'socket.io'
import { initDb } from './src/lib/db'

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(async () => {
  await initDb()

  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true)
    handle(req, res, parsedUrl)
  })

  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*' }
  })

  // Store io globally so API routes can emit
  ;(global as any).__socketio = io

  io.on('connection', (socket) => {
    console.log('[Socket.io] Client connected:', socket.id)
    socket.on('disconnect', () => {
      console.log('[Socket.io] Client disconnected:', socket.id)
    })
  })

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
  })
})
