<!--
 * @Author: xianggan
 * @Date: 2025-12-25 10:12:28
 * @LastEditors: xianggan
 * @LastEditTime: 2025-12-25 14:18:38
 * @FilePath: \webcam-fruit-game\src\views\Home.vue
 * @Description: 
 * 
 * 
-->
<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Camera, Trophy, Hand, Scissors } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import { soundManager } from '@/utils/SoundManager'

// Import fruit images for background
import appleImg from '@/assets/images/apple.svg'
import bananaImg from '@/assets/images/banana.svg'
import orangeImg from '@/assets/images/orange.svg'
import watermelonImg from '@/assets/images/watermelon.svg'
import grapeImg from '@/assets/images/grape.svg'

const router = useRouter()
const highScore = ref(0)

const backgroundFruits = ref<{ id: number, src: string, x: number, y: number, size: number, rotation: number, duration: number, delay: number }[]>([])

onMounted(() => {
  highScore.value = Number(localStorage.getItem('fruit-ninja-highscore') || 0)
  
  // Generate random background fruits
  const images = [appleImg, bananaImg, orangeImg, watermelonImg, grapeImg]
  for (let i = 0; i < 15; i++) {
    backgroundFruits.value.push({
      id: i,
      src: images[Math.floor(Math.random() * images.length)],
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 40 + Math.random() * 60,
      rotation: Math.random() * 360,
      duration: 10 + Math.random() * 20,
      delay: Math.random() * -20
    })
  }
})

const startGame = () => {
  soundManager.init()
  soundManager.warmup()
  router.push('/game')
}
</script>

<template>
  <div class="min-h-screen bg-slate-900 overflow-hidden flex flex-col items-center justify-center text-white relative">
    
    <!-- Animated Background -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
       <!-- Radial Gradient Overlay -->
       <div class="absolute inset-0 bg-radial-gradient z-0 opacity-80"></div>
       
       <!-- Floating Fruits -->
       <div v-for="fruit in backgroundFruits" :key="fruit.id" 
            class="absolute opacity-20 animate-float"
            :style="{
              left: `${fruit.x}%`,
              top: `${fruit.y}%`,
              width: `${fruit.size}px`,
              animationDuration: `${fruit.duration}s`,
              animationDelay: `${fruit.delay}s`
            }"
       >
         <img :src="fruit.src" class="w-full h-full" :style="{ transform: `rotate(${fruit.rotation}deg)` }" />
       </div>
    </div>

    <!-- Main Content Card -->
    <div class="relative z-10 w-full max-w-4xl p-4 md:p-8 mx-auto flex flex-col justify-center min-h-[calc(100vh-2rem)] md:min-h-0">
      <div class="backdrop-blur-xl bg-white/10 rounded-2xl md:rounded-3xl border border-white/10 shadow-2xl p-6 md:p-12 text-center transform transition-all duration-500 flex flex-col justify-center h-full md:h-auto">
        
        <!-- Title Section -->
        <div class="mb-8 md:mb-12 relative">
          <h1 class="text-5xl md:text-7xl font-black mb-2 md:mb-4 tracking-tight drop-shadow-2xl">
            <span class="bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-500 text-transparent bg-clip-text leading-tight block py-2">凌空斩</span>
          </h1>
          <div class="text-sm md:text-2xl font-light text-blue-200 tracking-widest uppercase opacity-80">Air Slash · AI Motion Game</div>
        </div>
        
        <!-- How to Play Icons -->
        <div class="grid grid-cols-3 gap-3 md:gap-8 mb-8 md:mb-12 max-w-3xl mx-auto w-full">
          <div class="flex flex-col items-center gap-2 md:gap-4 p-2 md:p-4 rounded-xl bg-white/5 border border-white/5">
            <div class="w-10 h-10 md:w-16 md:h-16 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
              <Camera class="w-5 h-5 md:w-8 md:h-8" />
            </div>
            <div class="text-xs md:text-lg font-bold">开启摄像头</div>
          </div>
          
          <div class="flex flex-col items-center gap-2 md:gap-4 p-2 md:p-4 rounded-xl bg-white/5 border border-white/5">
            <div class="w-10 h-10 md:w-16 md:h-16 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">
              <Hand class="w-5 h-5 md:w-8 md:h-8" />
            </div>
            <div class="text-xs md:text-lg font-bold">挥动双手</div>
          </div>
          
          <div class="flex flex-col items-center gap-2 md:gap-4 p-2 md:p-4 rounded-xl bg-white/5 border border-white/5">
            <div class="w-10 h-10 md:w-16 md:h-16 rounded-full bg-red-500/20 flex items-center justify-center text-red-400">
              <Scissors class="w-5 h-5 md:w-8 md:h-8" />
            </div>
            <div class="text-xs md:text-lg font-bold">切开水果</div>
          </div>
        </div>

        <!-- Action Section -->
        <div class="space-y-6 md:space-y-8 mt-auto md:mt-0">
          <div v-if="highScore > 0" class="inline-flex items-center gap-2 md:gap-3 px-4 py-1.5 md:px-6 md:py-2 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 font-bold text-sm md:text-xl animate-pulse">
            <Trophy class="w-4 h-4 md:w-6 md:h-6" />
            <span>历史最高分: {{ highScore }}</span>
          </div>
          
          <div class="flex flex-col items-center gap-4">
            <button 
              @click="startGame"
              class="group relative w-full md:w-auto px-8 py-4 md:px-12 md:py-6 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-full text-xl md:text-3xl font-black shadow-[0_0_20px_rgba(99,102,241,0.5)] md:shadow-[0_0_40px_rgba(99,102,241,0.5)] hover:shadow-[0_0_60px_rgba(99,102,241,0.7)] transition-all hover:scale-105 active:scale-95 overflow-hidden"
            >
              <div class="absolute inset-0 opacity-20 mix-blend-overlay"></div>
              <span class="relative flex items-center justify-center gap-3 md:gap-4 z-10">
                <Camera class="w-6 h-6 md:w-10 md:h-10" />
                开始游戏
              </span>
              <div class="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out"></div>
            </button>
            
            <p class="text-xs md:text-sm text-slate-400 flex items-center justify-center gap-2 text-center px-4">
              <span class="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-green-500 animate-ping flex-shrink-0"></span>
              游戏需要摄像头权限，数据仅在本地处理
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bg-radial-gradient {
  background: radial-gradient(circle at center, #1e293b 0%, #0f172a 100%);
}

@keyframes float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-20px) rotate(10deg); }
}

.animate-float {
  animation: float infinite ease-in-out;
}
</style>