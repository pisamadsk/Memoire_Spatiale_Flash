const http = require('http')
const { Server } = require('socket.io')

const server = http.createServer()
const io = new Server(server, { cors: { origin: '*' } })

const rooms = new Map()
const MAX_LEVEL = 5

function finalizeRound(code) {
  const room = rooms.get(code)
  if (!room) return
  room.maxLevel = MAX_LEVEL
  room.level = Math.min(room.level, room.maxLevel)
  const results = []
  let allCorrect = true
  for (const [pid, pdata] of room.players.entries()) {
    const motorScore = room.motorScores.get(pid) || 0
    const times = room.reactionTimes.get(pid) || []
    const avgReaction = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0
    const correctRes = room.submissions.get(pid)?.correct || false
    if (!correctRes) allCorrect = false
    const points = 100 + motorScore * 10 - Math.floor(avgReaction / 10)
    const newScore = pdata.score + (correctRes ? points : 0)
    const newLevel = Math.min(MAX_LEVEL, pdata.level + (correctRes ? 1 : 0))
    room.players.set(pid, { ...pdata, score: newScore, level: newLevel })
    results.push({ id: pid, name: pdata.name, correct: correctRes, motorScore, avgReaction, score: newScore, level: newLevel, points: correctRes ? points : 0 })
  }
  room.phase = 'result'
  rooms.set(code, room)
  io.to(code).emit('round_results', { results, level: room.level, allCorrect })
  io.to(code).emit('room_update', { code, level: Math.min(room.level, room.maxLevel), maxLevel: room.maxLevel, players: Array.from(room.players.values()) })
  if (room.level >= room.maxLevel) {
    io.to(code).emit('game_over', { level: Math.min(room.level, room.maxLevel), players: Array.from(room.players.values()) })
    return
  }
  setTimeout(() => {
    room.level = Math.min(room.level + 1, room.maxLevel)
    const effectiveLevel = Math.min(room.level, room.maxLevel)
    io.to(code).emit('next_level', { level: effectiveLevel })
    io.to(code).emit('info_msg', { message: `Niveau ${effectiveLevel}...` })
    const seq = Array.from({ length: 2 + effectiveLevel }, () => Math.floor(Math.random() * room.gridSize))
    room.sequence = seq
    room.motorScores = new Map()
    room.reactionTimes = new Map()
    room.submissions = new Map()
    room.phase = 'sequence'
    io.to(code).emit('phase_sequence', { sequence: room.sequence, level: Math.min(room.level, room.maxLevel), maxLevel: room.maxLevel })
    setTimeout(() => {
      room.phase = 'motor'
      room.timeLeft = 10 + effectiveLevel * 2
      room.target = newTarget(room.gridSize)
      room.targetSpawnTime = Date.now()
      io.to(code).emit('phase_motor', { timeLeft: room.timeLeft, target: room.target, level: effectiveLevel })
      const timer = setInterval(() => {
        room.timeLeft -= 1
        io.to(code).emit('motor_tick', { timeLeft: room.timeLeft })
        if (room.timeLeft <= 0) {
          clearInterval(timer)
          room.phase = 'recall'
          io.to(code).emit('phase_recall', { level: effectiveLevel })
          room.recallTimer = setTimeout(() => finalizeRound(code), 15000)
        }
      }, 1000)
    }, room.sequence.length * 1300 + 500)
  }, 2000)
}

function genCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase()
}

function newTarget(gridSize) {
  return { id: Date.now(), position: Math.floor(Math.random() * gridSize) }
}

io.on('connection', (socket) => {
  socket.on('create_room', ({ name }) => {
    const code = genCode()
    const room = {
      code,
      gridSize: 9,
      level: 1,
      maxLevel: MAX_LEVEL,
      sequence: [],
      timeLeft: 0,
      target: null,
      targetSpawnTime: 0,
      players: new Map(),
      phase: 'lobby',
      motorScores: new Map(),
      reactionTimes: new Map(),
      submissions: new Map(),
    }
  rooms.set(code, room)
  socket.join(code)
  room.players.set(socket.id, { id: socket.id, name, score: 0, level: 1 })
  io.to(code).emit('room_update', { code, level: Math.min(room.level, room.maxLevel), maxLevel: room.maxLevel, players: Array.from(room.players.values()) })
  socket.emit('room_created', { code })
  })

  socket.on('join_room', ({ code, name }) => {
    const room = rooms.get(code)
    if (!room) {
      socket.emit('error_msg', { message: 'Salon introuvable' })
      return
    }
  socket.join(code)
  room.maxLevel = MAX_LEVEL
  room.players.set(socket.id, { id: socket.id, name, score: 0, level: 1 })
  io.to(code).emit('room_update', { code, level: Math.min(room.level, room.maxLevel), maxLevel: room.maxLevel, players: Array.from(room.players.values()) })
  socket.emit('room_joined', { code })
  })

  socket.on('start_game', ({ code }) => {
    const room = rooms.get(code)
    if (!room) return
    room.maxLevel = MAX_LEVEL
    room.level = Math.min(room.level, room.maxLevel)
    if (room.level >= room.maxLevel) {
      io.to(code).emit('game_over', { level: room.level, players: Array.from(room.players.values()) })
      return
    }
    room.phase = 'sequence'
    const effectiveLevel = Math.min(room.level, room.maxLevel)
    room.sequence = Array.from({ length: 2 + effectiveLevel }, () => Math.floor(Math.random() * room.gridSize))
  room.motorScores = new Map()
  room.reactionTimes = new Map()
  room.submissions = new Map()
  io.to(code).emit('phase_sequence', { sequence: room.sequence, level: Math.min(room.level, room.maxLevel), maxLevel: room.maxLevel })
  setTimeout(() => {
    room.phase = 'motor'
    room.timeLeft = 10 + effectiveLevel * 2
    room.target = newTarget(room.gridSize)
    room.targetSpawnTime = Date.now()
    io.to(code).emit('phase_motor', { timeLeft: room.timeLeft, target: room.target, level: effectiveLevel })
    const timer = setInterval(() => {
      room.timeLeft -= 1
      io.to(code).emit('motor_tick', { timeLeft: room.timeLeft })
      if (room.timeLeft <= 0) {
        clearInterval(timer)
        room.phase = 'recall'
        io.to(code).emit('phase_recall', { level: effectiveLevel })
        room.recallTimer = setTimeout(() => finalizeRound(code), 15000)
      }
    }, 1000)
  }, room.sequence.length * 1300 + 500)
  })

  socket.on('target_hit', ({ code }) => {
    const room = rooms.get(code)
    if (!room || room.phase !== 'motor') return
    const reactionMs = room.targetSpawnTime ? (Date.now() - room.targetSpawnTime) : 0
    const prevScore = room.motorScores.get(socket.id) || 0
    room.motorScores.set(socket.id, prevScore + 1)
    const prevTimes = room.reactionTimes.get(socket.id) || []
    prevTimes.push(reactionMs)
    room.reactionTimes.set(socket.id, prevTimes)
    room.target = null
    io.to(code).emit('target_clear')
    setTimeout(() => {
      if (room.phase === 'motor') {
        room.target = newTarget(room.gridSize)
        room.targetSpawnTime = Date.now()
        io.to(code).emit('target_spawn', { target: room.target })
      }
    }, 300)
  })

  socket.on('submit_sequence', ({ code, userSeq }) => {
    const room = rooms.get(code)
    if (!room || room.phase !== 'recall') return
    const correct = userSeq.every((v, i) => v === room.sequence[i])
    room.submissions.set(socket.id, { correct })
    io.to(code).emit('player_result', { playerId: socket.id, correct })
    if (room.submissions.size === room.players.size) {
      if (room.recallTimer) {
        clearTimeout(room.recallTimer)
        room.recallTimer = null
      }
      finalizeRound(code)
    }
  })

  socket.on('disconnect', () => {
    for (const [code, room] of rooms.entries()) {
      if (room.players.has(socket.id)) {
        room.players.delete(socket.id)
        io.to(code).emit('room_update', { code, players: Array.from(room.players.values()) })
        if (room.players.size === 0) rooms.delete(code)
      }
    }
  })
})

const PORT = process.env.PORT || 3001
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Socket server on http://localhost:${PORT}`)
})
