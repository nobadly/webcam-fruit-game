import { ref, reactive } from 'vue'

// Global Type Definitions for MediaPipe
declare global {
  interface Window {
    Hands: any;
    Camera: any;
  }
}

// Global State
interface CursorState {
  x: number
  y: number
  active: boolean
  source: 'mouse' | 'hand' | 'touch'
}

const cursor = reactive<CursorState>({
  x: 0,
  y: 0,
  active: false, // true if hand detected or mouse moved recently
  source: 'mouse'
})

// Types for results (simplified)
interface Results {
  multiHandLandmarks: any[];
  image: any;
}

const handData = ref<Results | null>(null)
const videoRef = ref<HTMLVideoElement | null>(null)
const isCameraReady = ref(false)

let handsInstance: any = null

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

const updateCursorFromTouch = (e: TouchEvent) => {
  lastMouseMoveTime = Date.now() // Treat touch like mouse for timeout purposes
  cursor.source = 'touch'
  cursor.active = true
  if (e.touches.length > 0) {
    cursor.x = e.touches[0].clientX
    cursor.y = e.touches[0].clientY
  }
}

const onResults = (results: Results) => {
  handData.value = results
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const landmarks = results.multiHandLandmarks[0]
    const indexTip = landmarks[8]
    if (Date.now() - lastMouseMoveTime > MOUSE_TIMEOUT) {
      cursor.source = 'hand'
      cursor.active = true
      cursor.x = (1 - indexTip.x) * window.innerWidth
      cursor.y = indexTip.y * window.innerHeight
    }
  } else {
    if (cursor.source === 'hand') cursor.active = false
  }
}

const setVideoElement = (el: HTMLVideoElement) => {
  videoRef.value = el
  if (handsInstance && !isCameraReady.value) startCamera(el)
}

const initHandTracking = () => {
  if (handsInstance) return
  const Hands = window.Hands
  if (!Hands) {
    console.error('MediaPipe Hands not loaded')
    return
  }
  handsInstance = new Hands({
    locateFile: (file: string) => `${import.meta.env.BASE_URL}mediapipe/${file}`
  })
  handsInstance.setOptions({
    maxNumHands: 2,
    modelComplexity: 0,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  })
  handsInstance.onResults(onResults)
  if (videoRef.value) {
    startCamera(videoRef.value)
  }

  // Add global mouse listener
  window.addEventListener('mousemove', updateCursorFromMouse)
  window.addEventListener('touchstart', updateCursorFromTouch, { passive: false })
  window.addEventListener('touchmove', updateCursorFromTouch, { passive: false })
}

let animationFrameId: number | null = null
let lastDetectTime = 0
const DETECT_INTERVAL_MS = 33 // ~30 FPS

const startCamera = async (videoElement: HTMLVideoElement) => {
  try {
    // Check if stream already exists
    if (videoElement.srcObject) return
 
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user'
      }
    })
    
    videoElement.srcObject = stream
    videoElement.muted = true
    videoElement.autoplay = true
    videoElement.setAttribute('playsinline', 'true')
    await new Promise((resolve) => {
      videoElement.onloadedmetadata = () => {
        resolve(true)
      }
    })
    try {
      await videoElement.play()
    } catch {
      const tryPlay = () => {
        videoElement.play().catch(() => {})
        window.removeEventListener('click', tryPlay)
        window.removeEventListener('touchstart', tryPlay)
        window.removeEventListener('keydown', tryPlay)
      }
      window.addEventListener('click', tryPlay)
      window.addEventListener('touchstart', tryPlay)
      window.addEventListener('keydown', tryPlay)
    }
    
    const processFrame = async () => {
      if (!handsInstance || !videoElement.srcObject) {
         if (animationFrameId) cancelAnimationFrame(animationFrameId)
         return 
      }

      if (videoElement.readyState >= 2) {
         if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
            try {
                const now = performance.now()
                if (now - lastDetectTime >= DETECT_INTERVAL_MS) {
                  lastDetectTime = now
                  await handsInstance.send({ image: videoElement })
                }
                isCameraReady.value = true
            } catch (e) {
                console.warn('Frame processing skipped', e)
            }
         }
      }
      
      animationFrameId = requestAnimationFrame(processFrame)
    }
    processFrame()
    
  } catch (err) {
    console.error('Error accessing webcam:', err)
    isCameraReady.value = true 
  }
}

const stopHandTracking = () => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }

  if (videoRef.value && videoRef.value.srcObject) {
    const stream = videoRef.value.srcObject as MediaStream
    const tracks = stream.getTracks()
    tracks.forEach(track => {
        track.stop()
        stream.removeTrack(track)
    })
    videoRef.value.srcObject = null
  }

  if (handsInstance) {
    try { handsInstance.close() } catch {}
    handsInstance = null
  }
  
  isCameraReady.value = false
}

export function useHandTracking() {
  return {
    cursor,
    handData,
    videoRef,
    isCameraReady,
    setVideoElement,
    initHandTracking,
    stopHandTracking
  }
}

// Handle HMR
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    stopHandTracking()
  })
}
