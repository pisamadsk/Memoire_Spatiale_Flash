import React, { useState, useEffect, useRef } from 'react';
import { Brain, Target, Clock, Award, Download, Users, Trophy } from 'lucide-react';

export default function MemoryGame() {
  const [gameState, setGameState] = useState('menu'); // menu, sequence, motor, recall, result, leaderboard, multiplayer
  const [level, setLevel] = useState(1);
  const [sequence, setSequence] = useState([]);
  const [userSequence, setUserSequence] = useState([]);
  const [highlightedCell, setHighlightedCell] = useState(null);
  const [targets, setTargets] = useState([]);
  const [score, setScore] = useState(0);
  const [motorScore, setMotorScore] = useState(0);
  const [reactionTime, setReactionTime] = useState([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const targetStartTime = useRef(null);
  
  // Nouvelles fonctionnalités
  const [playerName, setPlayerName] = useState('');
  const [leaderboard, setLeaderboard] = useState([]);
  const [sessionStats, setSessionStats] = useState([]);
  const [multiplayerMode, setMultiplayerMode] = useState(false);
  const [players, setPlayers] = useState([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);

  const gridSize = 9;
  const sequenceLength = 2 + level;

  const colors = [
    'bg-red-500', 'bg-blue-500', 'bg-green-500',
    'bg-yellow-500', 'bg-purple-500', 'bg-pink-500',
    'bg-orange-500', 'bg-cyan-500', 'bg-indigo-500'
  ];

  // Charger les données du localStorage
  useEffect(() => {
    try {
      const savedLeaderboard = localStorage.getItem('memoryGameLeaderboard');
      if (savedLeaderboard) {
        setLeaderboard(JSON.parse(savedLeaderboard));
      }
    } catch (error) {
      console.error('Erreur lors du chargement du classement:', error);
    }
  }, []);

  useEffect(() => {
    if (gameState === 'motor' && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (gameState === 'motor' && timeLeft === 0) {
      endMotorPhase();
    }
  }, [timeLeft, gameState]);

  useEffect(() => {
    if (gameState === 'motor' && targets.length === 0) {
      spawnTarget();
    }
  }, [gameState, targets]);

  const startGame = () => {
    const newSequence = [];
    for (let i = 0; i < sequenceLength; i++) {
      newSequence.push(Math.floor(Math.random() * gridSize));
    }
    setSequence(newSequence);
    setUserSequence([]);
    setMotorScore(0);
    setReactionTime([]);
    setGameState('sequence');
    showSequence(newSequence);
  };

  const showSequence = async (seq) => {
    for (let i = 0; i < seq.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      setHighlightedCell(seq[i]);
      await new Promise(resolve => setTimeout(resolve, 800));
      setHighlightedCell(null);
    }
    await new Promise(resolve => setTimeout(resolve, 500));
    startMotorPhase();
  };

  const startMotorPhase = () => {
    setGameState('motor');
    setTimeLeft(10 + level * 2);
    setTargets([]);
  };

  const spawnTarget = () => {
    const position = Math.floor(Math.random() * gridSize);
    targetStartTime.current = Date.now();
    setTargets([{ id: Date.now(), position }]);
  };

  const handleTargetClick = (targetId) => {
    const reactionMs = Date.now() - targetStartTime.current;
    setReactionTime(prev => [...prev, reactionMs]);
    setMotorScore(prev => prev + 1);
    setTargets([]);
    
    setTimeout(() => {
      if (gameState === 'motor') {
        spawnTarget();
      }
    }, 300);
  };

  const endMotorPhase = () => {
    setTargets([]);
    setGameState('recall');
  };

  const handleCellClick = (index) => {
    if (gameState !== 'recall') return;
    
    const newUserSequence = [...userSequence, index];
    setUserSequence(newUserSequence);

    if (newUserSequence.length === sequence.length) {
      checkResult(newUserSequence);
    }
  };

  const checkResult = (userSeq) => {
    const correct = userSeq.every((val, idx) => val === sequence[idx]);
    const avgReaction = reactionTime.length > 0 
      ? Math.round(reactionTime.reduce((a, b) => a + b, 0) / reactionTime.length)
      : 0;

    const roundStats = {
      level,
      correct,
      motorScore,
      avgReaction,
      timestamp: new Date().toISOString()
    };

    setSessionStats(prev => [...prev, roundStats]);

    if (correct) {
      const points = 100 + motorScore * 10 - Math.floor(avgReaction / 10);
      setScore(prev => prev + points);
      setLevel(prev => prev + 1);
    }

    setGameState('result');
  };

  const saveToLeaderboard = () => {
    if (!playerName.trim()) {
      alert('Veuillez entrer votre nom !');
      return;
    }

    try {
      const entry = {
        name: playerName,
        score,
        level,
        date: new Date().toLocaleDateString(),
        avgReaction: sessionStats.length > 0 
          ? Math.round(sessionStats.reduce((sum, s) => sum + s.avgReaction, 0) / sessionStats.length)
          : 0
      };

      const newLeaderboard = [...leaderboard, entry]
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      setLeaderboard(newLeaderboard);
      localStorage.setItem('memoryGameLeaderboard', JSON.stringify(newLeaderboard));
      alert('Score enregistré dans le classement !');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert('Erreur lors de la sauvegarde du score');
    }
  };

  const exportStats = () => {
    const csvContent = [
      ['Nom', 'Score', 'Niveau', 'Date', 'Réaction Moyenne (ms)'],
      ...leaderboard.map(entry => [
        entry.name,
        entry.score,
        entry.level,
        entry.date,
        entry.avgReaction
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `memory-game-stats-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const startMultiplayer = () => {
    if (players.length < 2) {
      alert('Ajoutez au moins 2 joueurs !');
      return;
    }
    setMultiplayerMode(true);
    setCurrentPlayerIndex(0);
    setPlayerName(players[0].name);
    setScore(players[0].score);
    setLevel(players[0].level);
    setGameState('menu');
  };

  const addPlayer = () => {
    const name = prompt('Nom du joueur :');
    if (name && name.trim()) {
      setPlayers(prev => [...prev, { name: name.trim(), score: 0, level: 1 }]);
    }
  };

  const removePlayer = (index) => {
    setPlayers(players.filter((_, i) => i !== index));
  };

  const nextPlayer = () => {
    // Sauvegarder le score du joueur actuel
    const updatedPlayers = [...players];
    updatedPlayers[currentPlayerIndex] = {
      ...updatedPlayers[currentPlayerIndex],
      score: score,
      level: level
    };
    setPlayers(updatedPlayers);

    // Passer au joueur suivant
    const nextIndex = (currentPlayerIndex + 1) % players.length;
    
    if (nextIndex === 0) {
      // Tous les joueurs ont joué, afficher les résultats finaux
      alert('Partie terminée ! Consultez le classement.');
      setGameState('menu');
      return;
    }

    setCurrentPlayerIndex(nextIndex);
    setPlayerName(updatedPlayers[nextIndex].name);
    setScore(updatedPlayers[nextIndex].score);
    setLevel(updatedPlayers[nextIndex].level);
    setSessionStats([]);
    startGame();
  };

  const resetGame = () => {
    setGameState('menu');
    setLevel(1);
    setScore(0);
    setSessionStats([]);
    setMultiplayerMode(false);
    setPlayers([]);
    setCurrentPlayerIndex(0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20">
          
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2 flex items-center justify-center gap-3">
              <Brain className="w-10 h-10" />
              Mémoire Spatiale Flash
            </h1>
            <p className="text-purple-200">Entraînement Cognitivo-Moteur à Double Tâche</p>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-blue-500/30 rounded-xl p-4 text-center">
              <Award className="w-6 h-6 mx-auto mb-2 text-yellow-300" />
              <div className="text-2xl font-bold text-white">{score}</div>
              <div className="text-xs text-blue-200">Score Total</div>
            </div>
            <div className="bg-purple-500/30 rounded-xl p-4 text-center">
              <Target className="w-6 h-6 mx-auto mb-2 text-pink-300" />
              <div className="text-2xl font-bold text-white">{level}</div>
              <div className="text-xs text-purple-200">Niveau</div>
            </div>
            <div className="bg-pink-500/30 rounded-xl p-4 text-center">
              <Clock className="w-6 h-6 mx-auto mb-2 text-orange-300" />
              <div className="text-2xl font-bold text-white">{motorScore}</div>
              <div className="text-xs text-pink-200">Cibles Touchées</div>
            </div>
          </div>

          {/* Menu */}
          {gameState === 'menu' && (
            <div className="text-center space-y-6">
              <div className="bg-white/20 rounded-2xl p-6 mb-6">
                <h2 className="text-2xl font-bold text-white mb-4">Comment Jouer ?</h2>
                <div className="text-left text-white space-y-3">
                  <p><span className="font-bold text-yellow-300">Étape 1 :</span> Mémorisez la séquence de cases qui s'illuminent</p>
                  <p><span className="font-bold text-green-300">Étape 2 :</span> Cliquez rapidement sur les cibles rouges qui apparaissent</p>
                  <p><span className="font-bold text-blue-300">Étape 3 :</span> Reproduisez la séquence mémorisée</p>
                </div>
              </div>

              <div className="bg-white/10 rounded-xl p-4 mb-4">
                <input
                  type="text"
                  placeholder="Entrez votre nom..."
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-white/20 text-white placeholder-white/50 border border-white/30 focus:outline-none focus:border-white/60"
                />
              </div>

              <div className="flex gap-4 justify-center flex-wrap">
                <button
                  onClick={startGame}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-12 py-4 rounded-xl text-xl font-bold hover:scale-105 transition-transform shadow-lg"
                >
                  {multiplayerMode ? `🎮 ${playerName} - Niveau ${level}` : `🎮 Solo - Niveau ${level}`}
                </button>
                
                {!multiplayerMode && (
                  <>
                    <button
                      onClick={() => setGameState('multiplayer')}
                      className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white px-12 py-4 rounded-xl text-xl font-bold hover:scale-105 transition-transform shadow-lg flex items-center gap-2"
                    >
                      <Users className="w-6 h-6" />
                      Multijoueur Local
                    </button>

                    <button
                      onClick={() => setGameState('leaderboard')}
                      className="bg-gradient-to-r from-yellow-500 to-orange-600 text-white px-12 py-4 rounded-xl text-xl font-bold hover:scale-105 transition-transform shadow-lg flex items-center gap-2"
                    >
                      <Trophy className="w-6 h-6" />
                      Classement
                    </button>
                  </>
                )}
              </div>

              {multiplayerMode && (
                <div className="mt-6 bg-white/20 rounded-xl p-4">
                  <h3 className="text-xl font-bold text-white mb-3">🏆 Scores des Joueurs</h3>
                  <div className="space-y-2">
                    {players.map((player, idx) => (
                      <div 
                        key={idx} 
                        className={`p-3 rounded-lg transition-all ${
                          idx === currentPlayerIndex 
                            ? 'bg-green-500/40 border-2 border-green-400' 
                            : 'bg-white/10'
                        }`}
                      >
                        <span className="text-white font-bold">
                          {idx === currentPlayerIndex ? '▶️ ' : ''}{player.name}: {player.score} pts (Niveau {player.level})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {score > 0 && (
                <div className="mt-6 space-y-4">
                  <button
                    onClick={saveToLeaderboard}
                    className="bg-purple-500/50 text-white px-8 py-3 rounded-xl font-bold hover:bg-purple-500/70 transition"
                  >
                    💾 Sauvegarder mon Score
                  </button>
                  <button
                    onClick={resetGame}
                    className="ml-4 bg-red-500/50 text-white px-8 py-3 rounded-xl font-bold hover:bg-red-500/70 transition"
                  >
                    🔄 Nouveau Jeu
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Multiplayer Setup */}
          {gameState === 'multiplayer' && (
            <div className="text-center space-y-6">
              <h2 className="text-3xl font-bold text-white mb-4">Mode Multijoueur Local</h2>
              
              <div className="bg-white/20 rounded-2xl p-6">
                <h3 className="text-xl font-bold text-white mb-4">Joueurs Inscrits ({players.length})</h3>
                <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                  {players.map((player, idx) => (
                    <div key={idx} className="bg-white/10 rounded-lg p-3 text-white flex items-center justify-between">
                      <span className="font-bold">🎮 {idx + 1}. {player.name}</span>
                      <button
                        onClick={() => removePlayer(idx)}
                        className="bg-red-500 px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-600 transition"
                      >
                        ❌ Retirer
                      </button>
                    </div>
                  ))}
                  {players.length === 0 && (
                    <div className="py-8">
                      <p className="text-white/60 text-lg">Aucun joueur inscrit</p>
                      <p className="text-white/40 text-sm mt-2">Cliquez sur "Ajouter un Joueur" pour commencer</p>
                    </div>
                  )}
                </div>
                
                <button
                  onClick={addPlayer}
                  className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white px-8 py-4 rounded-xl text-lg font-bold hover:scale-105 transition-transform shadow-lg"
                >
                  ➕ Ajouter un Joueur
                </button>
              </div>

              <div className="flex gap-4 justify-center flex-wrap">
                <button
                  onClick={startMultiplayer}
                  disabled={players.length < 2}
                  className={`px-12 py-4 rounded-xl text-xl font-bold transition-transform shadow-lg ${
                    players.length >= 2
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:scale-105 cursor-pointer'
                      : 'bg-gray-500 text-gray-300 cursor-not-allowed opacity-50'
                  }`}
                >
                  {players.length >= 2 
                    ? '🎮 Commencer la Partie' 
                    : `⚠️ Minimum 2 joueurs requis (${players.length}/2)`}
                </button>
                
                <button
                  onClick={() => {
                    setGameState('menu');
                    setPlayers([]);
                  }}
                  className="bg-red-500/70 text-white px-8 py-4 rounded-xl font-bold hover:bg-red-500 transition"
                >
                  ← Annuler
                </button>
              </div>
            </div>
          )}

          {/* Leaderboard */}
          {gameState === 'leaderboard' && (
            <div className="text-center space-y-6">
              <h2 className="text-3xl font-bold text-white mb-4 flex items-center justify-center gap-3">
                <Trophy className="w-10 h-10 text-yellow-400" />
                Classement
              </h2>
              
              <div className="bg-white/20 rounded-2xl p-6 max-h-96 overflow-y-auto">
                {leaderboard.length > 0 ? (
                  <div className="space-y-2">
                    {leaderboard.map((entry, idx) => (
                      <div
                        key={idx}
                        className={`rounded-lg p-4 flex items-center justify-between ${
                          idx === 0 ? 'bg-yellow-500/30' :
                          idx === 1 ? 'bg-gray-400/30' :
                          idx === 2 ? 'bg-orange-600/30' :
                          'bg-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-3xl font-bold text-white">
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}
                          </span>
                          <div className="text-left">
                            <p className="font-bold text-white text-lg">{entry.name}</p>
                            <p className="text-sm text-white/70">{entry.date}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-white">{entry.score} pts</p>
                          <p className="text-sm text-white/70">Niveau {entry.level} • {entry.avgReaction}ms</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-white/60 py-8">Aucun score enregistré</p>
                )}
              </div>

              <div className="flex gap-4 justify-center">
                {leaderboard.length > 0 && (
                  <button
                    onClick={exportStats}
                    className="bg-green-500 text-white px-8 py-3 rounded-xl font-bold hover:bg-green-600 transition flex items-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    Exporter CSV
                  </button>
                )}
                <button
                  onClick={() => setGameState('menu')}
                  className="bg-white/20 text-white px-8 py-3 rounded-xl font-bold hover:bg-white/30 transition"
                >
                  ← Retour au Menu
                </button>
              </div>
            </div>
          )}

          {/* Sequence Display */}
          {gameState === 'sequence' && (
            <div className="text-center">
              <div className="bg-yellow-500/30 rounded-2xl p-6 mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Mémorisez la séquence !</h2>
                <p className="text-yellow-200">Observez attentivement les cases qui s'illuminent...</p>
              </div>
              <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                {Array.from({ length: gridSize }).map((_, i) => (
                  <div
                    key={i}
                    className={`aspect-square rounded-xl transition-all duration-300 ${
                      highlightedCell === i
                        ? 'bg-yellow-400 scale-110 shadow-2xl shadow-yellow-500/50'
                        : 'bg-white/20'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Motor Phase */}
          {gameState === 'motor' && (
            <div className="text-center">
              <div className="bg-red-500/30 rounded-2xl p-6 mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Cliquez sur les cibles !</h2>
                <p className="text-red-200">Temps restant : <span className="font-bold text-3xl">{timeLeft}s</span></p>
              </div>
              <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                {Array.from({ length: gridSize }).map((_, i) => {
                  const target = targets.find(t => t.position === i);
                  return (
                    <div
                      key={i}
                      onClick={() => target && handleTargetClick(target.id)}
                      className={`aspect-square rounded-xl transition-all duration-200 ${
                        target
                          ? 'bg-red-500 cursor-pointer hover:scale-110 animate-pulse shadow-2xl shadow-red-500/50'
                          : 'bg-white/10'
                      }`}
                    >
                      {target && (
                        <div className="w-full h-full flex items-center justify-center">
                          <Target className="w-12 h-12 text-white" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recall Phase */}
          {gameState === 'recall' && (
            <div className="text-center">
              <div className="bg-blue-500/30 rounded-2xl p-6 mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Reproduisez la séquence !</h2>
                <p className="text-blue-200">
                  Cliquez sur les cases dans l'ordre : {userSequence.length}/{sequence.length}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                {Array.from({ length: gridSize }).map((_, i) => (
                  <div
                    key={i}
                    onClick={() => handleCellClick(i)}
                    className={`aspect-square rounded-xl cursor-pointer transition-all duration-200 hover:scale-105 ${
                      userSequence.includes(i)
                        ? 'bg-green-500 shadow-lg shadow-green-500/50'
                        : 'bg-white/20 hover:bg-white/30'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Result */}
          {gameState === 'result' && (
            <div className="text-center space-y-6">
              <div className={`rounded-2xl p-8 ${
                userSequence.every((val, idx) => val === sequence[idx])
                  ? 'bg-green-500/30'
                  : 'bg-red-500/30'
              }`}>
                <h2 className="text-3xl font-bold text-white mb-4">
                  {userSequence.every((val, idx) => val === sequence[idx])
                    ? '✅ Excellent !'
                    : '❌ Raté !'}
                </h2>
                <div className="space-y-2 text-white">
                  <p>Cibles touchées : <span className="font-bold">{motorScore}</span></p>
                  <p>Temps de réaction moyen : <span className="font-bold">
                    {reactionTime.length > 0 
                      ? Math.round(reactionTime.reduce((a,b) => a+b, 0) / reactionTime.length)
                      : 0}ms
                  </span></p>
                  <p className="text-2xl font-bold mt-4">Score Total : {score}</p>
                </div>
              </div>
              <button
                onClick={multiplayerMode ? nextPlayer : startGame}
                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-12 py-4 rounded-xl text-xl font-bold hover:scale-105 transition-transform shadow-lg"
              >
                {multiplayerMode 
                  ? `✅ Terminer - Joueur Suivant` 
                  : 'Niveau Suivant'}
              </button>
              <button
                onClick={() => setGameState('menu')}
                className="ml-4 bg-white/20 text-white px-8 py-4 rounded-xl font-bold hover:bg-white/30 transition"
              >
                Menu Principal
              </button>
              
              {multiplayerMode && (
                <div className="mt-6 bg-white/20 rounded-xl p-4">
                  <h3 className="text-xl font-bold text-white mb-3">🏆 Scores Multijoueur</h3>
                  <p className="text-yellow-300 mb-3">Joueur actuel : {playerName}</p>
                  <div className="space-y-2">
                    {players.map((player, idx) => (
                      <div key={idx} className={`p-3 rounded-lg ${idx === currentPlayerIndex ? 'bg-yellow-500/30 border-2 border-yellow-400' : 'bg-white/10'}`}>
                        <span className="text-white font-bold">
                          {idx === currentPlayerIndex ? '▶️ ' : ''}{player.name}: {player.score} pts (Niveau {player.level})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}