<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useHandTracking } from '@/composables/useHandTracking'
import HandCursor from '@/components/HandCursor.vue'

const { initHandTracking, videoRef, isCameraReady } = useHandTracking()
const bgCanvas = ref<HTMLCanvasElement | null>(null)

onMounted(() => {
  initHandTracking()
  
  if (bgCanvas.value) {
    bgCanvas.value.width = window.innerWidth
    bgCanvas.value.height = window.innerHeight
  }

  window.addEventListener('resize', () => {
    if (bgCanvas.value) {
      bgCanvas.value.width = window.innerWidth
      bgCanvas.value.height = window.innerHeight
    }
  })
  
  // Background render loop
  const loop = () => {
    if (bgCanvas.value && videoRef.value && isCameraReady.value) {
      const ctx = bgCanvas.value.getContext('2d')
      if (ctx && videoRef.value.readyState >= 2) {
        // Draw black background first to avoid transparency artifacts
        // ctx.fillStyle = '#000'
        // ctx.fillRect(0, 0, bgCanvas.value.width, bgCanvas.value.height)
        
        ctx.save()
        ctx.scale(-1, 1)
        ctx.translate(-bgCanvas.value.width, 0)
        ctx.drawImage(videoRef.value, 0, 0, bgCanvas.value.width, bgCanvas.value.height)
        ctx.restore()
      }
    }
    requestAnimationFrame(loop)
  }
  loop()
})
</script>

<template>
  <canvas ref="bgCanvas" class="fixed inset-0 w-full h-full object-cover -z-10 bg-slate-900"></canvas>
  <HandCursor />
  <router-view></router-view>
</template>

<style>
/* Global styles */
body {
  margin: 0;
  overflow: hidden;
  background-color: #0f172a;
  cursor: auto;
}
</style>
