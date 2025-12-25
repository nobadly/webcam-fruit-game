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
