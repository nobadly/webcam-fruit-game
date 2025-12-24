<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useHandTracking } from '@/composables/useHandTracking'

const { cursor } = useHandTracking()
const hoverProgress = ref(0)
const isHovering = ref(false)

let hoverTimer: number | null = null
let hoverTarget: HTMLElement | null = null

const HOVER_THRESHOLD = 1500 // ms to trigger click
const UPDATE_INTERVAL = 50 // ms

// Watch for cursor movement to check hover
watch(() => [cursor.x, cursor.y], () => {
  if (cursor.source === 'hand' && cursor.active) {
    checkHover()
  } else {
    resetHover()
  }
})

const checkHover = () => {
  // Hide cursor element temporarily to use elementFromPoint
  const cursorEl = document.getElementById('hand-cursor')
  if (cursorEl) cursorEl.style.display = 'none'
  
  const el = document.elementFromPoint(cursor.x, cursor.y) as HTMLElement
  
  if (cursorEl) cursorEl.style.display = 'flex'
  
  // Find clickable parent
  const clickable = el?.closest('button, a, .clickable') as HTMLElement
  
  if (clickable) {
    if (hoverTarget !== clickable) {
      // New target
      resetHover()
      hoverTarget = clickable
      isHovering.value = true
      startHoverTimer(clickable)
    }
  } else {
    // No target
    if (hoverTarget) {
      resetHover()
    }
  }
}

const startHoverTimer = (target: HTMLElement) => {
  let startTime = Date.now()
  
  hoverTimer = window.setInterval(() => {
    const elapsed = Date.now() - startTime
    hoverProgress.value = Math.min((elapsed / HOVER_THRESHOLD) * 100, 100)
    
    if (elapsed >= HOVER_THRESHOLD) {
      target.click()
      resetHover()
      // Visual feedback
      createClickRipple(cursor.x, cursor.y)
    }
  }, UPDATE_INTERVAL)
}

const resetHover = () => {
  if (hoverTimer) {
    clearInterval(hoverTimer)
    hoverTimer = null
  }
  hoverTarget = null
  isHovering.value = false
  hoverProgress.value = 0
}

const createClickRipple = (x: number, y: number) => {
  const ripple = document.createElement('div')
  ripple.className = 'fixed rounded-full bg-white/50 pointer-events-none animate-ping'
  ripple.style.left = `${x - 20}px`
  ripple.style.top = `${y - 20}px`
  ripple.style.width = '40px'
  ripple.style.height = '40px'
  ripple.style.zIndex = '9999'
  document.body.appendChild(ripple)
  setTimeout(() => ripple.remove(), 1000)
}

onUnmounted(() => {
  resetHover()
})
</script>

<template>
  <!-- Cursor (Only show if active and source is hand, OR if we want a custom mouse cursor too? User said "convenient operation", usually mouse has its own cursor. Let's only show custom cursor for Hand) -->
  <div 
    id="hand-cursor"
    v-show="cursor.active && cursor.source === 'hand'"
    class="fixed z-50 pointer-events-none flex items-center justify-center -translate-x-1/2 -translate-y-1/2 transition-transform duration-75"
    :style="{ left: `${cursor.x}px`, top: `${cursor.y}px` }"
  >
    <!-- Ring Progress -->
    <svg width="60" height="60" class="absolute rotate-[-90deg]">
      <circle
        cx="30" cy="30" r="26"
        fill="none"
        stroke="rgba(255,255,255,0.3)"
        stroke-width="4"
      />
      <circle
        cx="30" cy="30" r="26"
        fill="none"
        stroke="#4ade80"
        stroke-width="4"
        stroke-dasharray="163"
        :stroke-dashoffset="163 - (163 * hoverProgress) / 100"
        class="transition-all duration-75"
      />
    </svg>
    
    <!-- Cursor Dot -->
    <div class="w-4 h-4 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)]"></div>
  </div>
</template>
