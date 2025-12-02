import React, { useState } from 'react'
import MemoryGame from './MemoryGame'
import OnlineMultiplayer from './OnlineMultiplayer'

export default function App() {
  const [view, setView] = useState<'local'|'online'>('local')
  return (
    <div>
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex gap-2">
        <button onClick={() => setView('local')} className={`px-4 py-2 rounded-lg font-bold ${view==='local'?'bg-white text-black':'bg-white/20 text-white'}`}>Solo/Local</button>
        <button onClick={() => setView('online')} className={`px-4 py-2 rounded-lg font-bold ${view==='online'?'bg-white text-black':'bg-white/20 text-white'}`}>En ligne</button>
      </div>
      {view === 'local' ? <MemoryGame/> : <OnlineMultiplayer/>}
    </div>
  )
}