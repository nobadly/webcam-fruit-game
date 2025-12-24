<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { RefreshCw, Home } from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()

const score = Number(route.query.score) || 0

const restartGame = () => {
  router.push('/game')
}

const goHome = () => {
  router.push('/')
}
</script>

<template>
  <div class="min-h-screen bg-slate-900/80 flex flex-col items-center justify-center text-white p-4 relative z-10">
    <div class="text-center max-w-md w-full bg-slate-800/50 p-8 rounded-2xl backdrop-blur-sm border border-slate-700">
      <h2 class="text-4xl font-bold mb-2 text-red-500">Game Over!</h2>
      
      <div class="my-8">
        <div class="text-sm text-slate-400 uppercase tracking-wider mb-1">Final Score</div>
        <div class="text-6xl font-black text-yellow-400">{{ score }}</div>
      </div>

      <div class="flex flex-col gap-4">
        <button 
          @click="restartGame"
          class="w-full py-3 bg-green-600 hover:bg-green-500 rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2"
        >
          <RefreshCw class="w-5 h-5" />
          Play Again
        </button>
        
        <button 
          @click="goHome"
          class="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2"
        >
          <Home class="w-5 h-5" />
          Back to Menu
        </button>
      </div>
    </div>
  </div>
</template>