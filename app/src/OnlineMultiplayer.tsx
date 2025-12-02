import React, { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { Users, Play, Target, Clock, Trophy } from 'lucide-react'

type Player = { id: string; name: string; score: number; level: number }
type TargetT = { id: number; position: number } | null
type Result = { id: string; name: string; correct: boolean; motorScore: number; avgReaction: number; score: number; level: number; points: number }

export default function OnlineMultiplayer() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [roomCode, setRoomCode] = useState('')
  const [name, setName] = useState('')
  const [players, setPlayers] = useState<Player[]>([])
  const [phase, setPhase] = useState<'lobby'|'sequence'|'motor'|'recall'|'result'>('lobby')
  const [sequence, setSequence] = useState<number[]>([])
  const [highlightedCell, setHighlightedCell] = useState<number | null>(null)
  const [target, setTarget] = useState<TargetT>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [userSequence, setUserSequence] = useState<number[]>([])
  const [results, setResults] = useState<Result[] | null>(null)
  const [roomLevel, setRoomLevel] = useState<number>(1)
  const [maxLevel, setMaxLevel] = useState<number>(5)
  const [info, setInfo] = useState<string>('')
  const gridSize = 9
  const showingRef = useRef(false)
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score)

  useEffect(() => {
    const s = io(import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3001')
    setSocket(s)
    s.on('room_update', ({ players, level, maxLevel }) => {
      setPlayers(players)
      if (typeof maxLevel !== 'undefined') setMaxLevel(Math.min(5, maxLevel))
      if (typeof level !== 'undefined') setRoomLevel(Math.min(5, level))
    })
    s.on('room_created', ({ code }) => setRoomCode(code))
    s.on('room_joined', ({ code }) => setRoomCode(code))
    s.on('phase_sequence', ({ sequence, level, maxLevel }) => {
      const cappedMax = typeof maxLevel !== 'undefined' ? Math.min(5, maxLevel) : 5
      const cappedLevel = typeof level !== 'undefined' ? Math.min(5, level) : roomLevel
      setMaxLevel(cappedMax)
      setRoomLevel(cappedLevel)
      if (cappedLevel >= cappedMax) {
        setResults(null)
        setPhase('result')
        setInfo('Partie terminée — score final')
        return
      }
      setSequence(sequence)
      setPhase('sequence')
      showingRef.current = true
      ;(async () => {
        for (const idx of sequence) {
          await new Promise(r => setTimeout(r, 500))
          setHighlightedCell(idx)
          await new Promise(r => setTimeout(r, 800))
          setHighlightedCell(null)
        }
        showingRef.current = false
      })()
    })
    s.on('phase_motor', ({ timeLeft, target, level }) => {
      setPhase('motor')
      setTimeLeft(timeLeft)
      setTarget(target)
      const cappedLevel = typeof level !== 'undefined' ? Math.min(5, level) : roomLevel
      setRoomLevel(cappedLevel)
      if (cappedLevel >= maxLevel) {
        setPhase('result')
        setInfo('Partie terminée — score final')
      }
    })
    s.on('motor_tick', ({ timeLeft }) => setTimeLeft(timeLeft))
    s.on('target_spawn', ({ target }) => setTarget(target))
    s.on('target_clear', () => setTarget(null))
    s.on('phase_recall', ({ level }) => {
      setPhase('recall')
      setUserSequence([])
      const cappedLevel = typeof level !== 'undefined' ? Math.min(5, level) : roomLevel
      setRoomLevel(cappedLevel)
    })
    s.on('player_result', ({ playerId, correct }) => {
      if (playerId === s.id) {
        // Await final round results from server
      }
    })
    s.on('round_results', ({ results, level, allCorrect }) => {
      setResults(results)
      const cappedLevel = typeof level !== 'undefined' ? Math.min(5, level) : roomLevel
      setRoomLevel(cappedLevel)
      if (cappedLevel >= maxLevel) {
        setInfo('Partie terminée — score final')
      } else {
        setInfo(allCorrect ? 'Tous les joueurs ont réussi ! Prochain niveau...' : 'Certains joueurs ont échoué. Passage au niveau suivant...')
      }
      setPhase('result')
    })
    s.on('next_level', ({ level }) => {
      const cappedLevel = typeof level !== 'undefined' ? Math.min(5, level) : roomLevel
      setRoomLevel(cappedLevel)
      if (cappedLevel >= maxLevel) {
        setPhase('result')
        setInfo('Partie terminée — score final')
      } else {
        setInfo(`Niveau ${cappedLevel}`)
      }
    })
    s.on('retry_level', ({ level }) => {
      if (typeof level !== 'undefined') setRoomLevel(Math.min(5, level))
      setInfo(`Réessai du niveau ${level}`)
    })
    s.on('game_over', ({ level, players }) => {
      if (typeof level !== 'undefined') setRoomLevel(Math.min(5, level))
      setPlayers(players)
      setPhase('result')
      setInfo('Partie terminée — tous les niveaux sont passés !')
    })
    s.on('info_msg', ({ message }) => setInfo(message))
    return () => { s.disconnect() }
  }, [])

  const createRoom = () => {
    if (!socket || !name.trim()) return
    socket.emit('create_room', { name: name.trim() })
  }

  const joinRoom = () => {
    if (!socket || !name.trim() || !roomCode.trim()) return
    socket.emit('join_room', { code: roomCode.trim().toUpperCase(), name: name.trim() })
  }

  const startGame = () => {
    if (!socket || !roomCode) return
    setResults(null)
    socket.emit('start_game', { code: roomCode })
  }

  const handleTargetClick = () => {
    if (!socket || !roomCode || !target) return
    socket.emit('target_hit', { code: roomCode })
  }

  const handleCellClick = (i: number) => {
    if (phase !== 'recall') return
    if (userSequence.length >= sequence.length) return
    const next = [...userSequence, i]
    setUserSequence(next)
    if (next.length === sequence.length && socket) {
      socket.emit('submit_sequence', { code: roomCode, userSeq: next })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20">
          <div className="flex items-center justify-between mb-4">
            <div className="text-white">
              <div className="text-sm">Niveau</div>
              <div className="text-2xl font-bold">{roomLevel} / {maxLevel}</div>
            </div>
            <div className="flex-1 mx-6">
              <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                <div className="h-2 bg-emerald-400" style={{ width: `${Math.min(100, Math.round(roomLevel / maxLevel * 100))}%` }} />
              </div>
            </div>
            <div className="text-white/80 text-sm">{info}</div>
          </div>
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-white flex items-center justify-center gap-3"><Users className="w-8 h-8"/>Multijoueur En Ligne</h1>
            <p className="text-purple-200">Jouez en même temps dans un salon partagé</p>
          </div>

          {phase === 'lobby' && (
            <div className="space-y-4">
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Votre nom"
                className="w-full px-4 py-2 rounded-lg bg-white/20 text-white placeholder-white/50 border border-white/30 focus:outline-none"
              />
              <div className="flex gap-3 items-center">
                <input
                  value={roomCode}
                  onChange={e => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="Code du salon"
                  className="flex-1 px-4 py-2 rounded-lg bg-white/20 text-white placeholder-white/50 border border-white/30 focus:outline-none"
                />
                <button onClick={createRoom} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold">Créer</button>
                <button onClick={joinRoom} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold">Rejoindre</button>
              </div>
              {roomCode && (
                <div className="bg-white/10 rounded-xl p-4 text-white">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">Salon: {roomCode}</span>
                    <button onClick={startGame} className="bg-emerald-600 px-6 py-2 rounded-lg font-bold flex items-center gap-2"><Play className="w-5 h-5"/>Démarrer</button>
                  </div>
                  <div className="mt-4">
                    <div className="text-sm text-white/70 mb-2 flex items-center gap-2"><Trophy className="w-4 h-4"/>Classement</div>
                    <div className="space-y-2">
                      {sortedPlayers.map((p, idx) => (
                        <div key={p.id} className={`bg-white/5 p-2 rounded-lg flex items-center justify-between ${idx===0?'border border-yellow-400/50':''}`}>
                          <span className="font-bold">{idx+1}. {p.name}</span>
                          <span className="text-white/70">{p.score} pts • Niv {Math.min(maxLevel, p.level)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {phase === 'sequence' && (
            <div className="text-center">
              <div className="bg-yellow-500/30 rounded-2xl p-6 mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Mémorisez la séquence</h2>
              </div>
              <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                {Array.from({ length: gridSize }).map((_, i) => (
                  <div key={i} className={`aspect-square rounded-xl ${highlightedCell === i ? 'bg-yellow-400 scale-110 shadow-2xl shadow-yellow-500/50' : 'bg-white/20'}`}/>
                ))}
              </div>
            </div>
          )}

          {phase === 'motor' && (
            <div className="text-center">
              <div className="bg-red-500/30 rounded-2xl p-6 mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Cliquez sur les cibles</h2>
                <p className="text-red-200">Temps restant: <span className="font-bold text-3xl">{timeLeft}s</span></p>
              </div>
              <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                {Array.from({ length: gridSize }).map((_, i) => (
                  <div
                    key={i}
                    onClick={() => target && target.position === i && handleTargetClick()}
                    className={`aspect-square rounded-xl transition-all ${target && target.position === i ? 'bg-red-500 cursor-pointer hover:scale-110 animate-pulse shadow-2xl shadow-red-500/50' : 'bg-white/10'}`}
                  >
                    {target && target.position === i && (
                      <div className="w-full h-full flex items-center justify-center">
                        <Target className="w-12 h-12 text-white"/>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {phase === 'recall' && (
            <div className="text-center">
              <div className="bg-blue-500/30 rounded-2xl p-6 mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Reproduisez la séquence</h2>
                <p className="text-blue-200">{userSequence.length}/{sequence.length}</p>
              </div>
              <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                {Array.from({ length: gridSize }).map((_, i) => (
                  <div
                    key={i}
                    onClick={() => handleCellClick(i)}
                    className={`aspect-square rounded-xl cursor-pointer ${userSequence.includes(i) ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-white/20 hover:bg-white/30'}`}
                  />
                ))}
              </div>
            </div>
          )}

          {phase === 'result' && (
            <div className="text-center space-y-6">
              <div className="rounded-2xl p-8 bg-white/10">
                <h2 className="text-3xl font-bold text-white mb-4">Résultats de la manche</h2>
                {results && results.length > 0 ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {results.map(r => (
                      <div key={r.id} className={`rounded-lg p-4 flex items-center justify-between ${r.correct ? 'bg-green-500/30' : 'bg-red-500/30'}`}>
                        <div className="text-left">
                          <p className="font-bold text-white text-lg">{r.name}</p>
                          <p className="text-sm text-white/70">Cibles: {r.motorScore} • Réaction: {r.avgReaction}ms</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-white">{r.correct ? `+${r.points} pts` : '+0 pts'}</p>
                          <p className="text-sm text-white/70">Total: {r.score} • Niv {r.level}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-white/60">En attente des résultats...</p>
                )}
              </div>
              <div className="rounded-2xl p-6 bg-white/10">
                <div className="text-sm text-white/80 mb-2 flex items-center gap-2"><Trophy className="w-4 h-4"/>Classement Global</div>
                <div className="space-y-2">
                    {sortedPlayers.map((p, idx) => (
                      <div key={p.id} className={`rounded-lg p-3 flex items-center justify-between ${idx===0?'bg-yellow-500/20':''}`}>
                        <span className="font-bold text-white">{idx+1}. {p.name}</span>
                        <span className="text-white/70">{p.score} pts • Niv {Math.min(maxLevel, p.level)}</span>
                      </div>
                    ))}
                </div>
              </div>
              <div className="flex gap-4 justify-center">
                {roomLevel < maxLevel && (
                  <button onClick={startGame} className="bg-emerald-600 text-white px-8 py-4 rounded-xl font-bold">Continuer</button>
                )}
                <button onClick={() => setPhase('lobby')} className="bg-white/20 text-white px-8 py-4 rounded-xl font-bold">Retour au salon</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
