export function getIO() {
  return (global as any).__socketio
}

export function emit(event: string, data: object) {
  const io = getIO()
  if (io) io.emit(event, data)
}
