<!--
 * @Author: xianggan
 * @Date: 2025-12-25 10:12:28
 * @LastEditors: xianggan
 * @LastEditTime: 2025-12-25 11:52:33
 * @FilePath: \webcam-fruit-game\src\views\GameOver.vue
 * @Description: 
 * 
 * 
-->
<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { RefreshCw, Home } from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()

const score = Number(route.query.score) || 0
const highScore = Number(localStorage.getItem('fruit-ninja-highscore') || 0)

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
      <h2 class="text-4xl font-bold mb-2 text-red-500">游戏结束!</h2>
      
      <div class="my-8">
        <div class="text-sm text-slate-400 uppercase tracking-wider mb-1">最终得分</div>
        <div class="text-6xl font-black text-yellow-400">{{ score }}</div>
        
        <div v-if="score >= highScore && score > 0" class="mt-4 text-green-400 font-bold animate-bounce">
          🏆 新纪录!
        </div>
        <div v-else class="mt-4 text-slate-500">
          最高分: {{ highScore }}
        </div>
      </div>

      <div class="flex flex-col gap-4">
        <button 
          @click="restartGame"
          class="w-full py-3 bg-green-600 hover:bg-green-500 rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2"
        >
          <RefreshCw class="w-5 h-5" />
          再玩一次
        </button>
        
        <button 
          @click="goHome"
          class="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2"
        >
          <Home class="w-5 h-5" />
          返回主页
        </button>
      </div>
    </div>
  </div>
</template>