import { ref, reactive } from 'vue'
import { Hands, type Results } from '@mediapipe/hands'
import { Camera } from '@mediapipe/camera_utils'

// Workaround for MediaPipe Hands in Vite production build
const SafeHands = (Hands as any)?.default || Hands;
const SafeCamera = (Camera as any)?.default || Camera;

// Global State
const cursor = reactive({
  x: 0,
  y: 0,
  active: false, // true if hand detected or mouse moved recently
  source: 'mouse' as 'mouse' | 'hand'
})

const handData = ref<Results | null>(null)
const videoRef = ref<HTMLVideoElement | null>(null)
const isCameraReady = ref(false)

let camera: Camera | null = null
let hands: Hands | null = null

// Mouse fallback logic
let lastMouseMoveTime = 0
const MOUSE_TIMEOUT = 2000 // Switch back to hand if no mouse move for 2s

const updateCursorFromMouse = (e: MouseEvent) => {
  lastMouseMoveTime = Date.now()
  cursor.source = 'mouse'
  cursor.active = true
  cursor.x = e.clientX
  cursor.y = e.clientY
}

const onResults = (results: Results) => {
  handData.value = results
  
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const landmarks = results.multiHandLandmarks[0]
    const indexTip = landmarks[8]
    
    // Check if we should prioritize hand
    if (Date.now() - lastMouseMoveTime > MOUSE_TIMEOUT) {
      cursor.source = 'hand'
      cursor.active = true
      // Mirror x for natural interaction
      cursor.x = (1 - indexTip.x) * window.innerWidth
      cursor.y = indexTip.y * window.innerHeight
    }
  } else {
    // If using hand and lost tracking, hide cursor or keep last position?
    // If using mouse, do nothing.
    if (cursor.source === 'hand') {
      cursor.active = false
    }
  }
}

const initHandTracking = (externalVideo?: HTMLVideoElement) => {
  if (hands) return // Already initialized

  hands = new SafeHands({
    locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  })

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  })

  hands.onResults(onResults)

  // Use external video if provided, otherwise create hidden one
  if (externalVideo) {
    videoRef.value = externalVideo
  } else if (!videoRef.value) {
    const video = document.createElement('video')
    video.style.display = 'none'
    document.body.appendChild(video)
    videoRef.value = video
  }

  if (videoRef.value) {
    camera = new SafeCamera(videoRef.value, {
      onFrame: async () => {
        if (hands && videoRef.value && videoRef.value.readyState >= 2) {
            // Safety check for dimensions
            if (videoRef.value.videoWidth > 0 && videoRef.value.videoHeight > 0) {
                 await hands.send({image: videoRef.value})
                 isCameraReady.value = true
            }
        }
      },
      width: 1280,
      height: 720
    })
    camera.start()
  }

  // Add global mouse listener
  window.addEventListener('mousemove', updateCursorFromMouse)
}

const cleanupHandTracking = () => {
  // We might NOT want to cleanup if we want global persistence, 
  // but for now let's expose a method to stop it if needed.
  // Ideally, we keep it running once started.
}

export function useHandTracking() {
  return {
    cursor,
    handData,
    videoRef,
    isCameraReady,
    initHandTracking
  }
}
