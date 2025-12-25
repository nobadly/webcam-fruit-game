<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'
import Matter from 'matter-js'
import { useHandTracking } from '@/composables/useHandTracking'

// Import fruit images
import appleImg from '@/assets/images/apple.svg'
import bananaImg from '@/assets/images/banana.svg'
import orangeImg from '@/assets/images/orange.svg'
import watermelonImg from '@/assets/images/watermelon.svg'
import grapeImg from '@/assets/images/grape.svg'

const router = useRouter()
const { handData, cursor, isCameraReady } = useHandTracking()

const score = ref(0)
const lives = ref(3)
const combo = ref(0)
const maxCombo = ref(0)
const lastSliceTime = ref(0)
const gameCanvasRef = ref<HTMLCanvasElement | null>(null)
const loading = ref(true)
const countdown = ref(5)
const showCountdown = ref(false)
const gameStarted = ref(false)

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
const handPosition = ref<{x: number, y: number} | null>(null)
const lastHandPosition = ref<{x: number, y: number} | null>(null)
const handTrail = ref<{x: number, y: number, time: number}[]>([])
const MAX_TRAIL_LENGTH = 15
const TRAIL_LIFETIME = 300 // ms

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
  { type: 'grape', color: '#9c27b0', radius: 25 }
]

const loadImages = () => {
  const sources = {
    apple: appleImg,
    banana: bananaImg,
    orange: orangeImg,
    watermelon: watermelonImg,
    grape: grapeImg
  }
  for (const [key, src] of Object.entries(sources)) {
    const img = new Image()
    img.src = src
    fruitImages[key] = img
  }
}

const goHome = () => {
  cleanup()
  router.push('/')
}

const gameOver = () => {
  cleanup()
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
    clearInterval(fruitSpawnerInterval)
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
  if (fruitSpawnerInterval) clearInterval(fruitSpawnerInterval)
  fruitSpawnerInterval = window.setInterval(spawnFruit, 2000)
}

// Watch global hand data to update local game state
watch(handData, (results) => {
  if (!results) return

  if (loading.value && isCameraReady.value) {
    loading.value = false
    startCountdown()
  }

  // Update hand position
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const landmarks = results.multiHandLandmarks[0]
    const indexTip = landmarks[8]
    
    lastHandPosition.value = handPosition.value
    
    const newX = 1 - indexTip.x
    const newY = indexTip.y
    
    handPosition.value = { x: newX, y: newY }

    // Add to trail
    handTrail.value.push({
      x: newX,
      y: newY,
      time: Date.now()
    })
    
    if (handTrail.value.length > MAX_TRAIL_LENGTH) {
      handTrail.value.shift()
    }
  } else {
    // Check if mouse is active fallback
    if (cursor.active && cursor.source === 'mouse') {
        lastHandPosition.value = handPosition.value
        const newX = cursor.x / window.innerWidth
        const newY = cursor.y / window.innerHeight
        handPosition.value = { x: newX, y: newY }
        
        handTrail.value.push({ x: newX, y: newY, time: Date.now() })
        if (handTrail.value.length > MAX_TRAIL_LENGTH) handTrail.value.shift()
    } else {
        lastHandPosition.value = null
        handPosition.value = null
    }
  }
})


// Physics Initialization
const initPhysics = () => {
  engine = Matter.Engine.create()
  engine.gravity.y = 0.8 

  // Game Loop
  const loop = () => {
    if (!engine || !gameCanvasRef.value) return
    
    Matter.Engine.update(engine, 1000 / 60)
    
    if (gameStarted.value) {
      checkSlicing()
    }
    
    renderGame()
    
    renderInterval = requestAnimationFrame(loop)
  }
  loop()
}

const checkSlicing = () => {
  if (!handPosition.value || !lastHandPosition.value || !engine || !gameCanvasRef.value) return
  
  const width = gameCanvasRef.value.width
  const height = gameCanvasRef.value.height
  
  const currX = handPosition.value.x * width
  const currY = handPosition.value.y * height
  const lastX = lastHandPosition.value.x * width
  const lastY = lastHandPosition.value.y * height
  
  const dist = Math.hypot(currX - lastX, currY - lastY)
  
  if (dist < 5) return // Lower threshold for mouse sensitivity

  const bodiesToRemove: string[] = []
  
  fruits.forEach((fruit, id) => {
    const { position } = fruit.body
    // @ts-ignore
    const fruitRadius = fruit.body.circleRadius || 30 
    
    const distToFruit = Math.hypot(currX - position.x, currY - position.y)
    
    if (distToFruit < fruitRadius + 20) { 
      bodiesToRemove.push(id.toString())
      
      // Combo Logic
      const now = Date.now()
      if (now - lastSliceTime.value < 500) {
        combo.value++
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
  })
  
  bodiesToRemove.forEach(id => {
    const fruit = fruits.get(Number(id))
    if (fruit) {
      Matter.World.remove(engine!.world, fruit.body)
      fruits.delete(Number(id))
    }
  })
}

const particles: {x: number, y: number, vx: number, vy: number, life: number, color: string, size: number}[] = []

const createParticles = (x: number, y: number, color: string) => {
  for (let i = 0; i < 20; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = Math.random() * 10 + 5
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.0,
      color,
      size: Math.random() * 4 + 2
    })
  }
  for (let i = 0; i < 8; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = Math.random() * 8 + 3
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.8,
      color: '#ffffff',
      size: Math.random() * 3 + 1
    })
  }
}

const spawnFruit = () => {
  if (!engine || !gameCanvasRef.value) return
  
  const width = gameCanvasRef.value.width
  const height = gameCanvasRef.value.height
  
  const x = Math.random() * (width * 0.6) + (width * 0.2)
  const y = height + 50
  
  const fruitType = FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)]
  const radius = fruitType.radius
  
  const body = Matter.Bodies.circle(x, y, radius, {
    restitution: 0.6,
    frictionAir: 0.005,
    label: 'fruit',
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
  
  fruits.set(body.id, { body, type: fruitType.type, color: fruitType.color })
}

const renderGame = () => {
  const canvas = gameCanvasRef.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return
  
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  
  // Draw Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.x += p.vx
    p.y += p.vy
    p.vy += 0.5 
    p.life -= 0.02 
    
    if (p.life <= 0 || p.y > canvas.height) {
      particles.splice(i, 1)
      continue
    }
    
    ctx.globalAlpha = p.life
    ctx.fillStyle = p.color
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
    ctx.fill()
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
       fruits.delete(fruit.body.id)
       
       if (gameStarted.value) {
         lives.value--
         if (lives.value <= 0) {
           gameOver()
         }
       }
    }
  })
  
  // Draw Enhanced Hand Trail
  if (handTrail.value.length > 1) {
    const now = Date.now()
    handTrail.value = handTrail.value.filter(p => now - p.time < TRAIL_LIFETIME)
    
    if (handTrail.value.length < 2) return

    ctx.beginPath()
    const firstP = handTrail.value[0]
    ctx.moveTo(firstP.x * canvas.width, firstP.y * canvas.height)
    
    for (let i = 1; i < handTrail.value.length - 1; i++) {
      const p = handTrail.value[i]
      const nextP = handTrail.value[i + 1]
      
      const cpX = p.x * canvas.width
      const cpY = p.y * canvas.height
      const nextX = nextP.x * canvas.width
      const nextY = nextP.y * canvas.height
      
      const midX = (cpX + nextX) / 2
      const midY = (cpY + nextY) / 2
      
      ctx.quadraticCurveTo(cpX, cpY, midX, midY)
    }
    
    const lastP = handTrail.value[handTrail.value.length - 1]
    ctx.lineTo(lastP.x * canvas.width, lastP.y * canvas.height)
    
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.shadowBlur = 20
    ctx.shadowColor = '#00ffff'
    
    const gradient = ctx.createLinearGradient(
      firstP.x * canvas.width, firstP.y * canvas.height,
      lastP.x * canvas.width, lastP.y * canvas.height
    )
    gradient.addColorStop(0, 'rgba(0, 255, 255, 0)')
    gradient.addColorStop(1, 'rgba(255, 255, 255, 1.0)')
    
    ctx.strokeStyle = gradient
    ctx.lineWidth = 8
    ctx.stroke()
    ctx.shadowBlur = 0
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
})

onUnmounted(() => {
  cleanup()
})
</script>

<template>
  <div class="relative w-full h-screen overflow-hidden">
    <!-- UI Overlay -->
    <div class="absolute top-0 left-0 w-full p-4 z-10 flex justify-between items-start pointer-events-none">
      <div class="flex flex-col gap-2">
        <div class="text-4xl font-bold text-yellow-400 drop-shadow-md">
          {{ score }}
        </div>
        <div class="text-sm text-white/80">SCORE</div>
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

    <!-- Back Button -->
    <button 
      @click="goHome"
      class="clickable absolute top-4 left-1/2 -translate-x-1/2 z-20 p-2 bg-white/10 backdrop-blur rounded-full hover:bg-white/20 text-white transition-colors pointer-events-auto"
    >
      <ArrowLeft class="w-6 h-6" />
    </button>
    
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
