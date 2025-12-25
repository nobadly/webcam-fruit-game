<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Volume2, VolumeX, Eye, EyeOff } from 'lucide-vue-next'
import Matter from 'matter-js'
import { useHandTracking } from '@/composables/useHandTracking'
import { soundManager } from '@/utils/SoundManager'

// Import fruit images
import appleImg from '@/assets/images/apple.svg'
import bananaImg from '@/assets/images/banana.svg'
import orangeImg from '@/assets/images/orange.svg'
import watermelonImg from '@/assets/images/watermelon.svg'
import grapeImg from '@/assets/images/grape.svg'
import bombImg from '@/assets/images/bomb.svg'

const router = useRouter()
const { handData, cursor, isCameraReady } = useHandTracking()

const score = ref(0)
const lives = ref(3)
const combo = ref(0)
const maxCombo = ref(0)
const lastSliceTime = ref(0)
const highScore = ref(Number(localStorage.getItem('fruit-ninja-highscore') || 0))
const gameCanvasRef = ref<HTMLCanvasElement | null>(null)
const loading = ref(true)
const countdown = ref(5)
const showCountdown = ref(false)
const gameStarted = ref(false)
const hitEffect = ref<'bomb' | 'damage' | null>(null)
const screenShake = ref(false)
const freezeActive = ref(false)
const frenzyActive = ref(false)

// Settings State
const isMuted = ref(soundManager.muted)
const showCamera = ref(true)

// Floating text popups
interface Popup {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  velocity: number;
}
const popups = ref<Popup[]>([])
let popupIdCounter = 0

// Hand tracking state (local mapping for game)
// Support up to 2 hands
const rawHandPositions = ref<({x: number, y: number} | null)[]>([null, null]) 
const handPositions = ref<({x: number, y: number} | null)[]>([null, null]) 
const lastHandPositions = ref<({x: number, y: number} | null)[]>([null, null])
// Trails for each hand
const handTrails = ref<{x: number, y: number, time: number}[][]>([[], []])

const MAX_TRAIL_LENGTH = 20 // Increased for smoother look
const TRAIL_LIFETIME = 400 // ms

// Physics & Game Engine state
let engine: Matter.Engine | null = null
let renderInterval: number | null = null
let fruitSpawnerInterval: number | null = null
let countdownInterval: number | null = null
const fruits = new Map<number, { body: Matter.Body, type: string, color: string }>()

// Fruit Images Cache
const fruitImages: Record<string, HTMLImageElement> = {}

const FRUIT_TYPES = [
  { type: 'apple', color: '#ff4444', radius: 30 },
  { type: 'banana', color: '#ffeb3b', radius: 35 },
  { type: 'orange', color: '#ff9800', radius: 30 },
  { type: 'watermelon', color: '#4caf50', radius: 40 },
  { type: 'grape', color: '#9c27b0', radius: 25 },
  // Power-ups
  { type: 'freeze-banana', color: '#00ffff', radius: 35 },
  { type: 'frenzy-banana', color: '#ff00ff', radius: 35 }
]

const BOMB_TYPE = { type: 'bomb', color: '#000000', radius: 35 }

const loadImages = () => {
  const sources = {
    apple: appleImg,
    banana: bananaImg,
    orange: orangeImg,
    watermelon: watermelonImg,
    grape: grapeImg,
    bomb: bombImg
  }
  for (const [key, src] of Object.entries(sources)) {
    const img = new Image()
    img.src = src
    fruitImages[key] = img
  }
}

const toggleMute = () => {
  soundManager.toggleMute()
  isMuted.value = soundManager.muted
}

const toggleCamera = () => {
  showCamera.value = !showCamera.value
  const videoEl = document.getElementById('webcam-feed')
  if (videoEl) {
    videoEl.style.opacity = showCamera.value ? '1' : '0'
  }
}

const goHome = () => {
  cleanup()
  router.push('/')
}

const gameOver = () => {
  cleanup()
  soundManager.playGameOver()
  // Save High Score
  if (score.value > highScore.value) {
    localStorage.setItem('fruit-ninja-highscore', score.value.toString())
  }
  router.push({ path: '/game-over', query: { score: score.value } })
}

const cleanup = () => {
  if (engine) {
    Matter.Engine.clear(engine)
    engine = null
  }
  if (renderInterval) {
    cancelAnimationFrame(renderInterval)
    renderInterval = null
  }
  if (fruitSpawnerInterval) {
    clearTimeout(fruitSpawnerInterval) // Changed from clearInterval
    fruitSpawnerInterval = null
  }
  if (countdownInterval) {
    clearInterval(countdownInterval)
    countdownInterval = null
  }
}

const startCountdown = () => {
  showCountdown.value = true
  countdownInterval = window.setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      if (countdownInterval) clearInterval(countdownInterval)
      countdownInterval = null
      showCountdown.value = false
      gameStarted.value = true
      startSpawning()
    }
  }, 1000)
}

const startSpawning = () => {
  if (fruitSpawnerInterval) clearTimeout(fruitSpawnerInterval)
  spawnLoop()
}

const activateFreeze = () => {
    freezeActive.value = true
    // Slow motion
    // Matter.js handles time scaling via engine.timing.timeScale
    // But we need to update it every frame or set it once if engine supports it persistent
    // Actually we can just update logic or let engine handle it.
    // Matter.js timeScale defaults to 1.
    if (engine) engine.timing.timeScale = 0.5
    
    setTimeout(() => {
        freezeActive.value = false
        if (engine) engine.timing.timeScale = 1
    }, 5000)
}

const activateFrenzy = () => {
    frenzyActive.value = true
    // Logic handled in spawnLoop
    startSpawning() // Trigger immediate spawn update
    
    setTimeout(() => {
        frenzyActive.value = false
    }, 5000)
}

const spawnLoop = () => {
  spawnFruit()
  
  // Dynamic Difficulty: Faster spawn as score increases
  // Base 2000ms, decreases by 50ms every 50 points, min 600ms
  let difficultyMultiplier = Math.floor(score.value / 50)
  let delay = Math.max(600, 2000 - (difficultyMultiplier * 100))
  
  // Frenzy Mode override
  if (frenzyActive.value) {
      delay = 300 // Super fast spawn
  }
  
  // Freeze Mode override (slower spawn)
  if (freezeActive.value) {
      delay *= 2
  }
  
  fruitSpawnerInterval = window.setTimeout(spawnLoop, delay)
}

// Watch global hand data to update local game state
watch(handData, (results) => {
  if (!results) return

  if (loading.value && isCameraReady.value) {
    loading.value = false
    soundManager.init() // Init audio context on user interaction/ready
    startCountdown()
  }

  // Update hand positions (Multi-hand)
  // Reset raw positions first if no hands detected? 
  // MediaPipe results.multiHandLandmarks is array of hands
  
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    // Clear previous if count changed? No, just update available ones.
    // If only 1 hand, set 2nd to null.
    
    // Hand 1
    if (results.multiHandLandmarks[0]) {
        const indexTip = results.multiHandLandmarks[0][8]
        rawHandPositions.value[0] = { x: 1 - indexTip.x, y: indexTip.y }
    } else {
        rawHandPositions.value[0] = null
    }
    
    // Hand 2
    if (results.multiHandLandmarks[1]) {
        const indexTip = results.multiHandLandmarks[1][8]
        rawHandPositions.value[1] = { x: 1 - indexTip.x, y: indexTip.y }
    } else {
        rawHandPositions.value[1] = null
    }
    
  } else {
    // Check if mouse is active fallback
    if (cursor.active && cursor.source === 'mouse') {
        const newX = cursor.x / window.innerWidth
        const newY = cursor.y / window.innerHeight
        // Mouse controls Hand 1
        rawHandPositions.value[0] = { x: newX, y: newY }
        rawHandPositions.value[1] = null
    } else {
        rawHandPositions.value[0] = null
        rawHandPositions.value[1] = null
    }
  }
})

// Adaptive Smoothing
// Dynamic factor based on speed: Low speed = high smoothing (stabilize jitter), High speed = low smoothing (reduce latency)
const updateHandPosition = () => {
  // Loop through all supported hands
  for (let i = 0; i < 2; i++) {
      const target = rawHandPositions.value[i]
      
      if (!target) {
          // If lost tracking, maybe keep last position for a bit or just null?
          // If we null it immediately, trail might disappear abruptly.
          // Let's keep position but stop updating? Or null it.
          // If null, we should probably clear trail after a timeout.
          // For now, let's just not update if null.
          // Actually if raw is null, we should null the smooth one too to stop slicing.
          handPositions.value[i] = null
          continue
      }

      if (!handPositions.value[i]) {
        handPositions.value[i] = { ...target }
        lastHandPositions.value[i] = { ...target }
        continue
      }

      lastHandPositions.value[i] = { ...handPositions.value[i]! }

      // Calculate distance to target (error)
      const dx = target.x - handPositions.value[i]!.x
      const dy = target.y - handPositions.value[i]!.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      
      // Dynamic smoothing factor
      const smoothingFactor = 0.2 + Math.min(dist * 8, 0.6)

      // Lerp
      handPositions.value[i]!.x += dx * smoothingFactor
      handPositions.value[i]!.y += dy * smoothingFactor

      // Add to trail
      handTrails.value[i].push({
        x: handPositions.value[i]!.x,
        y: handPositions.value[i]!.y,
        time: Date.now()
      })
      
      if (handTrails.value[i].length > MAX_TRAIL_LENGTH) {
        handTrails.value[i].shift()
      }
  }
}


const hitStopActive = ref(false)
const triggerHitStop = () => {
  hitStopActive.value = true
  // Freeze for 3 frames (approx 50ms)
  setTimeout(() => {
    hitStopActive.value = false
  }, 50)
}

// Physics Initialization
const initPhysics = () => {
  engine = Matter.Engine.create()
  engine.gravity.y = 0.8 

  // Game Loop
  let lastTime = performance.now()
  const loop = () => {
    if (!engine || !gameCanvasRef.value) return
    
    const now = performance.now()
    // Calculate delta time in ms, cap at 100ms to prevent spiral of death on lag
    let delta = Math.min(now - lastTime, 100)
    lastTime = now

    // Hit Stop Logic: Skip physics update
    if (!hitStopActive.value) {
        // Use variable delta for smooth physics on any refresh rate (60Hz, 120Hz, 144Hz)
        // Matter.js recommends fixed step for stability, but for simple games, delta correction is fine
        // Or we can run fixed steps accumulatively. For now, simple correction.
        // Standard Matter.js update uses a correction factor.
        // We will just pass the delta. Note: Matter.Engine.update default correction is 1.
        // Ideally we pass (engine, delta, correction). 
        // But simply passing delta works well for visual smoothness.
        Matter.Engine.update(engine, delta)
    }
    
    // Update Smoothed Hand Position
    updateHandPosition()

    if (gameStarted.value) {
      checkSlicing()
      // Random swoosh sound
      // Check both trails
      for (const trail of handTrails.value) {
          if (trail.length > 5 && Math.random() < 0.02) {
            soundManager.playSwoosh()
          }
      }
    }
    
    renderGame()
    
    renderInterval = requestAnimationFrame(loop)
  }
  loop()
}

const triggerScreenShake = () => {
  screenShake.value = true
  setTimeout(() => {
    screenShake.value = false
  }, 200)
}

const checkSlicing = () => {
  if (!engine || !gameCanvasRef.value) return
  
  const width = gameCanvasRef.value.width
  const height = gameCanvasRef.value.height
  
  // Loop through all hands
  for (let i = 0; i < 2; i++) {
      const handPos = handPositions.value[i]
      const lastPos = lastHandPositions.value[i]
      
      if (!handPos || !lastPos) continue
      
      const currX = handPos.x * width
      const currY = handPos.y * height
      const lastX = lastPos.x * width
      const lastY = lastPos.y * height
      
      const dist = Math.hypot(currX - lastX, currY - lastY)
      
      if (dist < 5) continue

      const bodiesToRemove: string[] = []
      let hitBomb = false
      
      // Use for...of to allow breaking
      for (const [id, fruit] of fruits.entries()) {
        const { position, angle } = fruit.body
        // @ts-ignore
        const fruitRadius = fruit.body.circleRadius || 30 
        
        const distToFruit = Math.hypot(currX - position.x, currY - position.y)
        
        if (distToFruit < fruitRadius + 20) { 
          
          if (fruit.type === 'bomb') {
            // Bomb Hit Logic
            createParticles(position.x, position.y, '#000000', true) // Explosion particles
            hitEffect.value = 'bomb'
            hitBomb = true
            soundManager.playBomb()
            triggerScreenShake()
            break // Stop processing fruits
          }

          // Power-up Logic
          if (fruit.type === 'freeze-banana') {
              activateFreeze()
          } else if (fruit.type === 'frenzy-banana') {
              activateFrenzy()
          }

          bodiesToRemove.push(id.toString())
          soundManager.playSlice()
          
          // Spawn Debris
          createDebris(position.x, position.y, fruit.type, angle, currX - lastX, currY - lastY)

          // Hit Stop (Freeze Frame)
          triggerHitStop()

          // Combo Logic
          const now = Date.now()
          if (now - lastSliceTime.value < 500) {
            combo.value++
            if (combo.value > 1) {
                soundManager.playCombo(combo.value)
                if (combo.value % 5 === 0) triggerScreenShake() // Shake on high combos
            }
          } else {
            combo.value = 1
          }
          lastSliceTime.value = now
          if (combo.value > maxCombo.value) maxCombo.value = combo.value

          const points = 10 * combo.value
          score.value += points

          // Add popup
          popups.value.push({
            id: popupIdCounter++,
            x: position.x,
            y: position.y - 30,
            text: combo.value > 1 ? `+${points} (${combo.value}x)` : `+${points}`,
            color: '#ffffff',
            life: 1.0,
            velocity: 2
          })

          createParticles(position.x, position.y, fruit.color)
        }
      }
      
      if (hitBomb) {
        gameStarted.value = false
        setTimeout(() => {
            gameOver()
        }, 100)
        return
      }
      
      bodiesToRemove.forEach(id => {
        const fruit = fruits.get(Number(id))
        if (fruit && engine) {
          Matter.World.remove(engine.world, fruit.body)
          fruits.delete(Number(id))
        }
      })
  }
}

interface Debris {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotSpeed: number;
  type: string; // fruit type
  side: 'left' | 'right';
  life: number;
  active: boolean;
}

const MAX_DEBRIS = 30
const debrisPool: Debris[] = Array(MAX_DEBRIS).fill(null).map(() => ({
  x: 0, y: 0, vx: 0, vy: 0, rotation: 0, rotSpeed: 0, type: '', side: 'left', life: 0, active: false
}))

const createDebris = (x: number, y: number, type: string, rotation: number, sliceVx: number, sliceVy: number) => {
  // Spawn 2 pieces
  let spawned = 0
  for (let i = 0; i < MAX_DEBRIS; i++) {
    if (spawned >= 2) break
    const d = debrisPool[i]
    if (!d.active) {
       d.active = true
       d.x = x
       d.y = y
       d.type = type
       d.rotation = rotation
       d.life = 1.0
       d.side = spawned === 0 ? 'left' : 'right'
       
       // Calculate separation velocity
       // Simple approximation: separate perpendicular to fruit up vector (rotated)
       // Or simpler: just separate left/right based on rotation
       const sepSpeed = 5
       const angleOffset = d.side === 'left' ? -Math.PI/2 : Math.PI/2
       
       // Add some slice momentum
       d.vx = Math.cos(rotation + angleOffset) * sepSpeed + sliceVx * 0.2
       d.vy = Math.sin(rotation + angleOffset) * sepSpeed + sliceVy * 0.2
       
       d.rotSpeed = (Math.random() - 0.5) * 0.5
       
       spawned++
    }
  }
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
  active: boolean;
}

const MAX_PARTICLES = 200
const particlePool: Particle[] = Array(MAX_PARTICLES).fill(null).map(() => ({
  x: 0, y: 0, vx: 0, vy: 0, life: 0, color: '', size: 0, active: false
}))
let activeParticleCount = 0

const createParticles = (x: number, y: number, color: string, isExplosion = false) => {
  // Throttle particles based on active count to prevent lag
  if (activeParticleCount > 100) return

  const count = isExplosion ? 30 : 15 // Reduced max count
  const speedMult = isExplosion ? 2 : 1

  let spawned = 0
  for (let i = 0; i < MAX_PARTICLES; i++) {
    if (spawned >= count) break
    
    const p = particlePool[i]
    if (!p.active) {
       const angle = Math.random() * Math.PI * 2
       const speed = (Math.random() * 10 + 5) * speedMult
       
       p.active = true
       p.x = x
       p.y = y
       p.vx = Math.cos(angle) * speed
       p.vy = Math.sin(angle) * speed
       p.life = 1.0
       p.color = isExplosion ? (Math.random() > 0.5 ? '#ff0000' : '#ffff00') : color
       p.size = Math.random() * 4 + 2
       
       spawned++
       activeParticleCount++
    }
  }

  if (!isExplosion) {
    let sparkSpawned = 0
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (sparkSpawned >= 8) break
      const p = particlePool[i]
      if (!p.active) {
         const angle = Math.random() * Math.PI * 2
         const speed = Math.random() * 8 + 3
         
         p.active = true
         p.x = x
         p.y = y
         p.vx = Math.cos(angle) * speed
         p.vy = Math.sin(angle) * speed
         p.life = 0.8
         p.color = '#ffffff'
         p.size = Math.random() * 3 + 1
         
         sparkSpawned++
         activeParticleCount++
      }
    }
  }
}

const spawnFruit = () => {
  if (!engine || !gameCanvasRef.value) return
  
  // Performance optimization: Limit max fruits
  if (fruits.size >= 15) return 
  
  const width = gameCanvasRef.value.width
  const height = gameCanvasRef.value.height
  
  const x = Math.random() * (width * 0.6) + (width * 0.2)
  const y = height + 50
  
  // 15% chance to spawn a bomb
  const rand = Math.random()
  const isBomb = rand < 0.15
  
  // 5% chance for Power-up (if not bomb)
  // Indices 5 and 6 are power-ups in FRUIT_TYPES
  let itemType = isBomb ? BOMB_TYPE : FRUIT_TYPES[Math.floor(Math.random() * 5)] // Default only normal fruits (0-4)
  
  if (!isBomb && rand > 0.95) {
      // Spawn Power-up
      itemType = FRUIT_TYPES[5 + Math.floor(Math.random() * 2)]
  }

  const radius = itemType.radius
  
  const body = Matter.Bodies.circle(x, y, radius, {
    restitution: 0.6,
    frictionAir: 0.005,
    label: isBomb ? 'bomb' : 'fruit',
    angle: Math.random() * Math.PI * 2
  })

  const minVelocityY = height * 0.024 
  const maxVelocityY = height * 0.030 
  const velocityY = -(minVelocityY + Math.random() * (maxVelocityY - minVelocityY))
  
  const centerX = width / 2
  const distToCenter = centerX - x
  const velocityX = distToCenter * (0.01 + Math.random() * 0.015)

  Matter.Body.setVelocity(body, { x: velocityX, y: velocityY })
  Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.3)

  Matter.World.add(engine.world, body)
  
  fruits.set(body.id, { body, type: itemType.type, color: itemType.color })
}

const renderGame = () => {
  const canvas = gameCanvasRef.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return
  
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  
  // Draw Particles
  if (activeParticleCount > 0) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = particlePool[i]
      if (!p.active) continue

      p.x += p.vx
      p.y += p.vy
      p.vy += 0.5 
      p.life -= 0.02 
      
      if (p.life <= 0 || p.y > canvas.height) {
        p.active = false
        activeParticleCount--
        continue
      }
      
      ctx.globalAlpha = p.life
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1.0
  }
  
  // Draw Debris (Behind Fruits)
  for (let i = 0; i < MAX_DEBRIS; i++) {
    const d = debrisPool[i]
    if (!d.active) continue

    d.x += d.vx
    d.y += d.vy
    d.vy += 0.8 // Gravity
    d.rotation += d.rotSpeed
    d.life -= 0.015

    if (d.life <= 0 || d.y > canvas.height) {
        d.active = false
        continue
    }

    const img = fruitImages[d.type]
    if (img) {
        ctx.save()
        ctx.globalAlpha = d.life
        ctx.translate(d.x, d.y)
        ctx.rotate(d.rotation)
        
        // Draw Half Image using drawImage source rects for performance
        // Original radius approx 30-40. Image size unknown but usually square.
        // Assuming image is square and centered.
        // We need to draw half of it.
        // Left Half: sx=0, sy=0, sw=w/2, sh=h
        // Right Half: sx=w/2, sy=0, sw=w/2, sh=h
        
        const w = img.width
        const h = img.height
        const halfW = w / 2
        
        // Target size
        const radius = 35 // approx average
        const size = radius * 2
        
        if (d.side === 'left') {
            // Draw left half
            // Destination: x = -radius, y = -radius, w = radius, h = size
            ctx.drawImage(img, 
                0, 0, halfW, h, 
                -radius, -radius, radius, size
            )
        } else {
            // Draw right half
            // Destination: x = 0, y = -radius, w = radius, h = size
            ctx.drawImage(img, 
                halfW, 0, halfW, h, 
                0, -radius, radius, size
            )
        }
        
        ctx.restore()
    }
  }
  ctx.globalAlpha = 1.0

  // Draw Fruits
  fruits.forEach((fruit) => {
    const { position, angle } = fruit.body
    // @ts-ignore
    const radius = fruit.body.circleRadius || 30
    
    const img = fruitImages[fruit.type]
    
    ctx.save()
    ctx.translate(position.x, position.y)
    ctx.rotate(angle)
    
    if (img) {
      ctx.drawImage(img, -radius, -radius, radius * 2, radius * 2)
    } else {
      ctx.fillStyle = fruit.color
      ctx.beginPath()
      ctx.arc(0, 0, radius, 0, Math.PI * 2)
      ctx.fill()
    }
    
    ctx.restore()
    
    if (position.y > canvas.height + 100 && fruit.body.velocity.y > 0) {
       Matter.World.remove(engine!.world, fruit.body)
       fruits.delete(Number(fruit.body.id)) // Ensure key is number
       
       if (gameStarted.value) {
         lives.value--
         hitEffect.value = 'damage'
         setTimeout(() => {
             hitEffect.value = null
         }, 200)

         if (lives.value <= 0) {
           gameOver()
         }
       }
    }
  })
  
  // Draw Enhanced Hand Trail
  // Loop through all hand trails
  for (let t = 0; t < 2; t++) {
      const trail = handTrails.value[t]
      if (trail.length > 1) {
        const now = Date.now()
        
        // Optimize: Remove old points from start instead of filter
        while (trail.length > 0 && now - trail[0].time >= TRAIL_LIFETIME) {
            trail.shift()
        }
        
        if (trail.length < 2) continue

        ctx.beginPath()
        const firstP = trail[0]
        ctx.moveTo(firstP.x * canvas.width, firstP.y * canvas.height)
        
        for (let i = 1; i < trail.length - 1; i++) {
          const p = trail[i]
          const nextP = trail[i + 1]
          
          const cpX = p.x * canvas.width
          const cpY = p.y * canvas.height
          const nextX = nextP.x * canvas.width
          const nextY = nextP.y * canvas.height
          
          const midX = (cpX + nextX) / 2
          const midY = (cpY + nextY) / 2
          
          ctx.quadraticCurveTo(cpX, cpY, midX, midY)
        }
        
        const lastP = trail[trail.length - 1]
        ctx.lineTo(lastP.x * canvas.width, lastP.y * canvas.height)
        
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        
        // Core (White)
        ctx.shadowBlur = 10
        ctx.shadowColor = '#ffffff'
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 4
        ctx.stroke()
        
        // Outer Glow (Cyan/Purple based on speed or default)
        ctx.shadowBlur = 20
        ctx.shadowColor = '#00ffff'
        
        const gradient = ctx.createLinearGradient(
          firstP.x * canvas.width, firstP.y * canvas.height,
          lastP.x * canvas.width, lastP.y * canvas.height
        )
        gradient.addColorStop(0, 'rgba(0, 255, 255, 0)')
        gradient.addColorStop(1, 'rgba(0, 255, 255, 0.8)')
        
        ctx.strokeStyle = gradient
        ctx.lineWidth = 12 // Wider glow
        ctx.stroke()
        
        // Tip Spark
        ctx.shadowBlur = 30
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(lastP.x * canvas.width, lastP.y * canvas.height, 6, 0, Math.PI * 2)
        ctx.fill()
        
        ctx.shadowBlur = 0
      }
  }

  // Draw Popups
  ctx.font = 'bold 24px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  
  for (let i = popups.value.length - 1; i >= 0; i--) {
    const p = popups.value[i]
    p.y -= p.velocity
    p.life -= 0.02
    
    if (p.life <= 0) {
      popups.value.splice(i, 1)
      continue
    }
    
    const scale = 1 + (1 - p.life) * 0.5 // Grow slightly
    
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.scale(scale, scale)
    ctx.globalAlpha = p.life
    
    // Text Shadow/Outline
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 4
    ctx.fillStyle = p.color
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 3
    ctx.strokeText(p.text, 0, 0)
    ctx.fillText(p.text, 0, 0)
    
    ctx.restore()
  }
  ctx.globalAlpha = 1.0
}

onMounted(() => {
  loadImages()

  if (!gameCanvasRef.value) return

  const width = window.innerWidth
  const height = window.innerHeight
  
  gameCanvasRef.value.width = width
  gameCanvasRef.value.height = height

  initPhysics()
  
  // Check if camera is already ready
  if (isCameraReady.value) {
      loading.value = false
      startCountdown()
  }

  window.addEventListener('resize', () => {
    if (gameCanvasRef.value) {
      gameCanvasRef.value.width = window.innerWidth
      gameCanvasRef.value.height = window.innerHeight
    }
  })

  // Ensure audio is unlocked on any user interaction (click/touch)
  const unlockAudio = () => {
    soundManager.init()
    soundManager.resume()
    soundManager.warmup()
    window.removeEventListener('click', unlockAudio)
    window.removeEventListener('touchstart', unlockAudio)
    window.removeEventListener('keydown', unlockAudio)
  }
  window.addEventListener('click', unlockAudio)
  window.addEventListener('touchstart', unlockAudio)
  window.addEventListener('keydown', unlockAudio)
})

onUnmounted(() => {
  cleanup()
})
</script>

<template>
  <div class="relative w-full h-screen overflow-hidden transition-transform duration-100 touch-none"
       :class="{ 'translate-x-1 translate-y-1': screenShake, '-translate-x-1 -translate-y-1': !screenShake && screenShake }"
  >
    <!-- Cinematic Vignette Overlay (Behind Canvas) -->
    <div class="absolute inset-0 bg-radial-gradient pointer-events-none -z-0"></div>

    <!-- UI Overlay -->
    <div class="absolute top-0 left-0 w-full p-4 z-10 flex justify-between items-start pointer-events-none">
      <div class="flex flex-col gap-2">
        <div class="text-4xl font-bold text-yellow-400 drop-shadow-md">
          {{ score }}
        </div>
        <div class="text-sm text-white/80">得分</div>
      </div>

      <div class="flex gap-1">
        <div v-for="i in 3" :key="i" class="text-2xl" :class="i <= lives ? 'opacity-100' : 'opacity-30 grayscale'">
          ❤️
        </div>
      </div>
    </div>

    <!-- Combo Indicator -->
    <div 
      class="absolute top-24 left-4 z-10 transition-all duration-300 pointer-events-none"
      :class="combo > 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-50'"
    >
      <div class="text-3xl font-black text-yellow-300 italic drop-shadow-[0_0_10px_rgba(255,215,0,0.8)] stroke-black">
        COMBO x{{ combo }}
      </div>
    </div>

    <!-- Screen Flash Effects -->
    <div 
      class="absolute inset-0 pointer-events-none z-30 transition-opacity duration-100 mix-blend-overlay"
      :class="[
        hitEffect === 'bomb' ? 'bg-white opacity-80' : 
        hitEffect === 'damage' ? 'bg-red-600 opacity-60' : 
        freezeActive ? 'bg-cyan-500 opacity-30' :
        frenzyActive ? 'bg-purple-500 opacity-30' :
        'opacity-0'
      ]"
    ></div>

    <!-- Back Button & Settings -->
    <div class="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex gap-4">
      <button 
        @click="goHome"
        class="clickable p-2 bg-white/10 backdrop-blur rounded-full hover:bg-white/20 text-white transition-colors pointer-events-auto"
        title="返回主页"
      >
        <ArrowLeft class="w-6 h-6" />
      </button>

      <button 
        @click="toggleMute"
        class="clickable p-2 bg-white/10 backdrop-blur rounded-full hover:bg-white/20 text-white transition-colors pointer-events-auto"
        :title="isMuted ? '开启声音' : '静音'"
      >
        <VolumeX v-if="isMuted" class="w-6 h-6" />
        <Volume2 v-else class="w-6 h-6" />
      </button>

      <button 
        @click="toggleCamera"
        class="clickable p-2 bg-white/10 backdrop-blur rounded-full hover:bg-white/20 text-white transition-colors pointer-events-auto"
        :title="showCamera ? '隐藏摄像头' : '显示摄像头'"
      >
        <Eye v-if="showCamera" class="w-6 h-6" />
        <EyeOff v-else class="w-6 h-6" />
      </button>
    </div>
    
    <!-- Game Canvas Layer (Foreground) -->
    <canvas ref="gameCanvasRef" class="absolute inset-0 w-full h-full object-cover"></canvas>
    
    <!-- Loading Overlay -->
    <div v-if="loading" class="absolute inset-0 flex items-center justify-center text-white pointer-events-none bg-black/80 z-50">
      <div class="flex flex-col items-center gap-4">
        <div class="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
        <p>初始化摄像头中...</p>
      </div>
    </div>

    <!-- Countdown Overlay -->
    <div v-if="showCountdown" class="absolute inset-0 flex items-center justify-center z-40 pointer-events-none bg-black/20 backdrop-blur-sm">
      <div class="text-9xl font-bold text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] animate-pulse">
        {{ countdown }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.bg-radial-gradient {
  background: radial-gradient(circle at center, transparent 30%, rgba(0, 0, 0, 0.6) 100%);
}
</style>