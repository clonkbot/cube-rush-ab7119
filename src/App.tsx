import { useState, useRef, useCallback, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Text, Stars, Trail, Float, MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'

type GameState = 'menu' | 'playing' | 'gameover'
type Lane = -1 | 0 | 1

interface Obstacle {
  id: number
  z: number
  lane: Lane
  passed: boolean
}

// Game constants
const LANE_WIDTH = 2.5
const INITIAL_SPEED = 15
const SPEED_INCREMENT = 0.5
const OBSTACLE_SPAWN_DISTANCE = 80
const OBSTACLE_DESPAWN_DISTANCE = -10

// Tunnel segments
function Tunnel({ speed }: { speed: number }) {
  const tunnelRef = useRef<THREE.Group>(null!)

  useFrame((_, delta) => {
    if (tunnelRef.current) {
      tunnelRef.current.rotation.z += delta * 0.1
    }
  })

  const rings = []
  for (let i = 0; i < 30; i++) {
    rings.push(
      <mesh key={i} position={[0, 0, -i * 8]} rotation={[0, 0, i * 0.1]}>
        <torusGeometry args={[8, 0.05, 8, 32]} />
        <meshBasicMaterial color={i % 2 === 0 ? '#00ffff' : '#ff00ff'} transparent opacity={0.3} />
      </mesh>
    )
  }

  return <group ref={tunnelRef}>{rings}</group>
}

// Player cube with trail
function PlayerCube({ lane, gameState }: { lane: Lane; gameState: GameState }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const targetX = lane * LANE_WIDTH

  useFrame((state, delta) => {
    if (meshRef.current) {
      // Smooth lane transition
      meshRef.current.position.x = THREE.MathUtils.lerp(
        meshRef.current.position.x,
        targetX,
        delta * 15
      )
      // Wobble effect
      meshRef.current.rotation.x += delta * 3
      meshRef.current.rotation.y += delta * 2

      // Pulse scale
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 5) * 0.05
      meshRef.current.scale.setScalar(pulse)
    }
  })

  return (
    <Trail
      width={2}
      length={6}
      color={new THREE.Color('#00ffff')}
      attenuation={(t) => t * t}
    >
      <mesh ref={meshRef} position={[0, 0, 0]}>
        <boxGeometry args={[1, 1, 1]} />
        <MeshDistortMaterial
          color="#00ffff"
          emissive="#00ffff"
          emissiveIntensity={gameState === 'playing' ? 2 : 0.5}
          distort={0.2}
          speed={4}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>
    </Trail>
  )
}

// Obstacle
function ObstacleBox({ position, color }: { position: [number, number, number]; color: string }) {
  const meshRef = useRef<THREE.Mesh>(null!)

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 2
      meshRef.current.rotation.y = state.clock.elapsedTime * 1.5
    }
  })

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
      <mesh ref={meshRef} position={position}>
        <octahedronGeometry args={[1.2]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.5}
          metalness={0.9}
          roughness={0.1}
        />
      </mesh>
    </Float>
  )
}

// Ground grid
function Grid() {
  const gridRef = useRef<THREE.GridHelper>(null!)

  useFrame((_, delta) => {
    if (gridRef.current) {
      gridRef.current.position.z = (gridRef.current.position.z + delta * 20) % 2
    }
  })

  return (
    <gridHelper
      ref={gridRef}
      args={[200, 100, '#ff00ff', '#330033']}
      position={[0, -2, 0]}
      rotation={[0, 0, 0]}
    />
  )
}

// Main game component
function Game({
  gameState,
  setGameState,
  score,
  setScore,
  onGameOver
}: {
  gameState: GameState
  setGameState: (state: GameState) => void
  score: number
  setScore: (score: number | ((prev: number) => number)) => void
  onGameOver: () => void
}) {
  const [lane, setLane] = useState<Lane>(0)
  const [obstacles, setObstacles] = useState<Obstacle[]>([])
  const [speed, setSpeed] = useState(INITIAL_SPEED)
  const obstacleIdRef = useRef(0)
  const lastSpawnZ = useRef(OBSTACLE_SPAWN_DISTANCE)
  const playerRef = useRef({ x: 0, z: 0 })
  const { camera } = useThree()

  // Reset game
  useEffect(() => {
    if (gameState === 'playing') {
      setLane(0)
      setObstacles([])
      setSpeed(INITIAL_SPEED)
      setScore(0)
      lastSpawnZ.current = OBSTACLE_SPAWN_DISTANCE
      obstacleIdRef.current = 0
      playerRef.current = { x: 0, z: 0 }
    }
  }, [gameState, setScore])

  // Handle input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        setLane(prev => Math.max(-1, prev - 1) as Lane)
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        setLane(prev => Math.min(1, prev + 1) as Lane)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [gameState])

  // Touch controls
  useEffect(() => {
    let touchStartX = 0

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (gameState !== 'playing') return

      const touchEndX = e.changedTouches[0].clientX
      const diff = touchEndX - touchStartX

      if (Math.abs(diff) > 30) {
        if (diff > 0) {
          setLane(prev => Math.min(1, prev + 1) as Lane)
        } else {
          setLane(prev => Math.max(-1, prev - 1) as Lane)
        }
      }
    }

    window.addEventListener('touchstart', handleTouchStart)
    window.addEventListener('touchend', handleTouchEnd)
    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [gameState])

  // Game loop
  useFrame((_, delta) => {
    if (gameState !== 'playing') return

    // Update player position for collision
    playerRef.current.x = lane * LANE_WIDTH

    // Move obstacles toward player
    setObstacles(prev => {
      const updated = prev.map(obs => ({
        ...obs,
        z: obs.z - speed * delta
      })).filter(obs => obs.z > OBSTACLE_DESPAWN_DISTANCE)

      // Check for passed obstacles (scoring)
      updated.forEach(obs => {
        if (!obs.passed && obs.z < -2) {
          obs.passed = true
          setScore(s => s + 10)
        }
      })

      return updated
    })

    // Spawn new obstacles
    if (lastSpawnZ.current > 0) {
      lastSpawnZ.current -= speed * delta
    } else {
      // Spawn 1-2 obstacles per wave
      const numObstacles = Math.random() > 0.7 ? 2 : 1
      const lanes: Lane[] = [-1, 0, 1]
      const shuffled = lanes.sort(() => Math.random() - 0.5)
      const blockedLanes = shuffled.slice(0, numObstacles)

      blockedLanes.forEach(blockedLane => {
        setObstacles(prev => [...prev, {
          id: obstacleIdRef.current++,
          z: OBSTACLE_SPAWN_DISTANCE,
          lane: blockedLane,
          passed: false
        }])
      })

      lastSpawnZ.current = 8 + Math.random() * 4
    }

    // Collision detection
    obstacles.forEach(obs => {
      const obsX = obs.lane * LANE_WIDTH
      const distance = Math.sqrt(
        Math.pow(playerRef.current.x - obsX, 2) +
        Math.pow(obs.z, 2)
      )

      if (distance < 1.8 && obs.z > -1.5 && obs.z < 1.5) {
        setGameState('gameover')
        onGameOver()
      }
    })

    // Increase speed over time
    setSpeed(prev => prev + SPEED_INCREMENT * delta * 0.1)

    // Camera shake at high speeds
    if (speed > 25) {
      camera.position.x = (Math.random() - 0.5) * 0.1
    }
  })

  const obstacleColors = ['#ff0055', '#ffff00', '#00ff88']

  return (
    <>
      <ambientLight intensity={0.2} />
      <pointLight position={[0, 10, 10]} intensity={2} color="#00ffff" />
      <pointLight position={[-10, 5, 0]} intensity={1} color="#ff00ff" />
      <pointLight position={[10, 5, 0]} intensity={1} color="#ffff00" />

      <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={2} />
      <Tunnel speed={speed} />
      <Grid />

      <PlayerCube lane={lane} gameState={gameState} />

      {obstacles.map(obs => (
        <ObstacleBox
          key={obs.id}
          position={[obs.lane * LANE_WIDTH, 0, obs.z]}
          color={obstacleColors[Math.abs(obs.lane)]}
        />
      ))}

      {/* Lane indicators */}
      {[-1, 0, 1].map(l => (
        <mesh key={l} position={[l * LANE_WIDTH, -1.9, 20]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2, 60]} />
          <meshBasicMaterial
            color={lane === l ? '#00ffff' : '#220033'}
            transparent
            opacity={lane === l ? 0.3 : 0.1}
          />
        </mesh>
      ))}
    </>
  )
}

// Menu title
function MenuTitle() {
  return (
    <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
      <Text
        position={[0, 2, -5]}
        fontSize={2}
        color="#00ffff"
        anchorX="center"
        anchorY="middle"
        font="https://fonts.gstatic.com/s/orbitron/v31/yMJMMIlzdpvBhQQL_SC3X9yhF25-T1nyGy6BoWgz.woff2"
        outlineWidth={0.05}
        outlineColor="#ff00ff"
      >
        CUBE RUSH
      </Text>
    </Float>
  )
}

// Screenshot component
function ShareCard({ score, onClose }: { score: number; onClose: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null)

  const shareToX = () => {
    const text = `🎮 I scored ${score.toLocaleString()} points in CUBE RUSH! 🚀\n\nCan you beat my score? Play now:`
    const url = window.location.href
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative max-w-md w-full">
        {/* Share card */}
        <div
          ref={cardRef}
          className="relative overflow-hidden rounded-2xl p-8 bg-gradient-to-br from-[#0a0a1a] via-[#1a0a2a] to-[#0a1a2a] border border-cyan-500/30"
          style={{
            boxShadow: '0 0 60px rgba(0, 255, 255, 0.3), 0 0 100px rgba(255, 0, 255, 0.2), inset 0 0 60px rgba(0, 255, 255, 0.1)'
          }}
        >
          {/* Scanlines overlay */}
          <div
            className="absolute inset-0 pointer-events-none opacity-10"
            style={{
              background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 255, 255, 0.1) 2px, rgba(0, 255, 255, 0.1) 4px)'
            }}
          />

          {/* Decorative corners */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-400" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-magenta-400" style={{ borderColor: '#ff00ff' }} />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-magenta-400" style={{ borderColor: '#ff00ff' }} />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-400" />

          <div className="relative z-10 text-center">
            <p className="text-cyan-400 text-sm tracking-[0.3em] uppercase mb-2 font-light">Final Score</p>
            <h2
              className="text-6xl md:text-7xl font-bold mb-4"
              style={{
                fontFamily: 'Orbitron, sans-serif',
                background: 'linear-gradient(135deg, #00ffff, #ff00ff, #ffff00)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 0 30px rgba(0, 255, 255, 0.5)'
              }}
            >
              {score.toLocaleString()}
            </h2>
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
              <span className="text-cyan-300 text-xs tracking-wider">CUBE RUSH</span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-magenta-500 to-transparent" style={{ background: 'linear-gradient(to right, transparent, #ff00ff, transparent)' }} />
            </div>

            <p className="text-gray-400 text-sm mb-6">Can your friends beat this? 👀</p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={shareToX}
            className="flex-1 py-4 px-6 rounded-xl font-bold text-black transition-all duration-300 hover:scale-105 active:scale-95"
            style={{
              fontFamily: 'Orbitron, sans-serif',
              background: 'linear-gradient(135deg, #00ffff, #00ff88)',
              boxShadow: '0 0 30px rgba(0, 255, 255, 0.5)'
            }}
          >
            Share to 𝕏
          </button>
          <button
            onClick={onClose}
            className="py-4 px-6 rounded-xl font-bold transition-all duration-300 hover:scale-105 active:scale-95 border border-white/20 text-white/70 hover:text-white hover:border-white/40"
            style={{ fontFamily: 'Orbitron, sans-serif' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>('menu')
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('cubeRushHighScore')
    return saved ? parseInt(saved) : 0
  })
  const [showShareCard, setShowShareCard] = useState(false)
  const finalScoreRef = useRef(0)

  const handleGameOver = useCallback(() => {
    finalScoreRef.current = score
    if (score > highScore) {
      setHighScore(score)
      localStorage.setItem('cubeRushHighScore', score.toString())
    }
    setTimeout(() => setShowShareCard(true), 500)
  }, [score, highScore])

  const startGame = () => {
    setGameState('playing')
    setShowShareCard(false)
  }

  return (
    <div className="w-screen h-screen bg-black overflow-hidden relative" style={{ fontFamily: 'Orbitron, sans-serif' }}>
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 3, 8], fov: 75 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: 'linear-gradient(to bottom, #0a0a1a, #000000)' }}
      >
        <fog attach="fog" args={['#0a0a1a', 10, 80]} />

        {gameState === 'menu' && <MenuTitle />}

        <Game
          gameState={gameState}
          setGameState={setGameState}
          score={score}
          setScore={setScore}
          onGameOver={handleGameOver}
        />
      </Canvas>

      {/* HUD Overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Score display during game */}
        {gameState === 'playing' && (
          <div className="absolute top-4 md:top-8 left-1/2 -translate-x-1/2 text-center">
            <p className="text-cyan-400 text-xs tracking-[0.3em] uppercase mb-1">Score</p>
            <p
              className="text-3xl md:text-5xl font-bold"
              style={{
                background: 'linear-gradient(135deg, #00ffff, #ff00ff)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 0 20px rgba(0, 255, 255, 0.5)'
              }}
            >
              {score.toLocaleString()}
            </p>
          </div>
        )}

        {/* Mobile controls hint */}
        {gameState === 'playing' && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-center md:hidden">
            <p className="text-white/30 text-xs">← Swipe to move →</p>
          </div>
        )}

        {/* Menu UI */}
        {gameState === 'menu' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-auto p-4">
            <div className="text-center mb-8">
              <h1
                className="text-4xl md:text-6xl font-bold mb-2"
                style={{
                  background: 'linear-gradient(135deg, #00ffff, #ff00ff, #ffff00)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                CUBE RUSH
              </h1>
              <p className="text-cyan-300/60 text-sm tracking-wider">Dodge. Survive. Dominate.</p>
            </div>

            {highScore > 0 && (
              <div className="mb-6 text-center">
                <p className="text-white/40 text-xs tracking-wider uppercase">High Score</p>
                <p className="text-2xl font-bold text-yellow-400">{highScore.toLocaleString()}</p>
              </div>
            )}

            <button
              onClick={startGame}
              className="px-12 py-4 rounded-xl font-bold text-lg transition-all duration-300 hover:scale-110 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #00ffff, #00ff88)',
                boxShadow: '0 0 40px rgba(0, 255, 255, 0.5), 0 0 80px rgba(0, 255, 255, 0.3)',
                color: '#000'
              }}
            >
              PLAY
            </button>

            <div className="mt-8 text-center max-w-xs">
              <p className="text-white/30 text-xs">
                <span className="hidden md:inline">← → or A/D to move</span>
                <span className="md:hidden">Swipe left/right to move</span>
              </p>
            </div>
          </div>
        )}

        {/* Game Over UI */}
        {gameState === 'gameover' && !showShareCard && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-auto bg-black/60 p-4">
            <div className="text-center">
              <h2
                className="text-3xl md:text-5xl font-bold mb-4"
                style={{
                  background: 'linear-gradient(135deg, #ff0055, #ff00ff)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                GAME OVER
              </h2>
              <p className="text-white/50 text-sm">Preparing your score card...</p>
            </div>
          </div>
        )}
      </div>

      {/* Share Card Modal */}
      {showShareCard && (
        <ShareCard
          score={finalScoreRef.current}
          onClose={() => {
            setShowShareCard(false)
            setGameState('menu')
          }}
        />
      )}

      {/* Footer */}
      <footer className="absolute bottom-2 md:bottom-4 left-1/2 -translate-x-1/2 text-center">
        <p className="text-white/20 text-[10px] md:text-xs tracking-wider">
          Requested by <a href="https://x.com/birbzio" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400/50 transition-colors">@birbzio</a> · Built by <a href="https://x.com/clonkbot" target="_blank" rel="noopener noreferrer" className="hover:text-magenta-400/50 transition-colors" style={{ color: 'inherit' }}>@clonkbot</a>
        </p>
      </footer>

      {/* Scanlines overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-40 opacity-[0.03]"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)'
        }}
      />
    </div>
  )
}
