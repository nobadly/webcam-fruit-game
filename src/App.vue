<!--
 * @Author: xianggan
 * @Date: 2025-12-25 10:12:28
 * @LastEditors: xianggan
 * @LastEditTime: 2025-12-25 11:27:15
 * @FilePath: \webcam-fruit-game\src\App.vue
 * @Description: 
 * 
 * 
-->
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useHandTracking } from '@/composables/useHandTracking'
import HandCursor from '@/components/HandCursor.vue'

const { initHandTracking, stopHandTracking } = useHandTracking()
const webcamVideo = ref<HTMLVideoElement | null>(null)

onMounted(() => {
  if (webcamVideo.value) {
    initHandTracking(webcamVideo.value)
  }
})

onUnmounted(() => {
  stopHandTracking()
})
</script>

<template>
  <div class="relative w-full h-screen bg-slate-900 overflow-hidden">
    <!-- Webcam Feed -->
    <video 
      ref="webcamVideo"
      class="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]"
      id="webcam-feed"
      playsinline
      muted
    ></video>
    
    <!-- App Content -->
    <router-view></router-view>
    
    <!-- Custom Cursor -->
    <HandCursor />
  </div>
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
