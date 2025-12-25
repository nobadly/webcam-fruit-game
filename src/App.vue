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
import { onMounted, ref } from 'vue'
import { useHandTracking } from '@/composables/useHandTracking'
import HandCursor from '@/components/HandCursor.vue'

const { initHandTracking } = useHandTracking()
const webcamVideo = ref<HTMLVideoElement | null>(null)

onMounted(() => {
  if (webcamVideo.value) {
    initHandTracking(webcamVideo.value)
  }
})
</script>

<template>
  <video 
    ref="webcamVideo" 
    class="fixed inset-0 w-full h-full object-cover -z-10 scale-x-[-1]" 
    autoplay 
    playsinline 
    muted
  ></video>
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
