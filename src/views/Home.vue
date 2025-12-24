<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Camera } from 'lucide-vue-next'

const router = useRouter()

const startGame = () => {
  router.push('/game')
}
</script>

<template>
  <div class="min-h-screen bg-slate-900/80 flex flex-col items-center justify-center text-white p-4 relative z-10">
    
    <div class="text-center max-w-2xl">
      <h1 class="text-6xl font-bold mb-8 bg-gradient-to-r from-yellow-400 to-orange-500 text-transparent bg-clip-text">
        AI Fruit Ninja
      </h1>
      
      <p class="text-xl text-slate-300 mb-12">
        Use your webcam to slice fruits with your hands!
        <br>
        Make sure you are in a well-lit environment.
      </p>

      <div class="space-y-6">
        <button 
          @click="startGame"
          class="group relative px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full text-2xl font-bold shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
        >
          <span class="flex items-center gap-3">
            <Camera class="w-8 h-8" />
            Start Game
          </span>
          <div class="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
        </button>

        <p class="text-sm text-slate-500">
          *Requires camera permission
        </p>
      </div>
    </div>
  </div>
</template>