import { ref, reactive } from 'vue'

// Global Type Definitions for MediaPipe
declare global {
  interface Window {
    Hands: any;
    Camera: any;
  }
}

// Global State
const cursor = reactive({
  x: 0,
  y: 0,
  active: false, // true if hand detected or mouse moved recently
  source: 'mouse' as 'mouse' | 'hand'
})

// Types for results (simplified)
interface Results {
  multiHandLandmarks: any[];
  image: any;
}

const handData = ref<Results | null>(null)
const videoRef = ref<HTMLVideoElement | null>(null)
const isCameraReady = ref(false)

let camera: any = null
let hands: any = null

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
  cursor.source = 'mouse' // Reuse mouse logic for touch
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

const setVideoElement = (el: HTMLVideoElement) => {
  videoRef.value = el
}

const initHandTracking = () => {
  if (hands) return // Already initialized

  // Access globals from CDN scripts
  const Hands = window.Hands;
  const Camera = window.Camera;

  if (!Hands) {
    console.error('MediaPipe Hands not loaded from CDN');
    return;
  }

  hands = new Hands({
    locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  })

  hands.setOptions({
    maxNumHands: 2, // Enable dual hand support
    modelComplexity: 0, // Downgrade from 1 to 0 for max speed (Lite model)
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  })

  hands.onResults(onResults)

  // Start camera if video element is available
  if (videoRef.value) {
    startCamera(videoRef.value)
  }

  // Add global mouse listener
  window.addEventListener('mousemove', updateCursorFromMouse)
  window.addEventListener('touchstart', updateCursorFromTouch, { passive: false })
  window.addEventListener('touchmove', updateCursorFromTouch, { passive: false })
}

let animationFrameId: number | null = null

const startCamera = async (videoElement: HTMLVideoElement) => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: 1280,
        height: 720,
        facingMode: 'user'
      }
    })
    
    videoElement.srcObject = stream
    await new Promise((resolve) => {
      videoElement.onloadedmetadata = () => {
        resolve(true)
      }
    })
    await videoElement.play()
    
    // Performance optimization: Process frames at lower resolution
    // MediaPipe Hands works well even at 360p or 480p, while we display 720p/1080p
    const processFrame = async () => {
      if (hands && videoElement && videoElement.readyState >= 2) {
         if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
            // No need to resize manually, just let MediaPipe handle it or we could draw to smaller canvas first
            // But simply sending the video element is usually fine if modelComplexity is low
            // For optimal perf, we can limit the FPS of detection if needed
            await hands.send({image: videoElement})
            isCameraReady.value = true
         }
      }
      // Limit detection loop to ~30 FPS to save CPU/GPU if monitor is 60/144Hz
      // Or just run as fast as possible. For mobile, limiting is better.
      animationFrameId = requestAnimationFrame(processFrame)
    }
    processFrame()
    
  } catch (err) {
    console.error('Error accessing webcam:', err)
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

  if (hands) {
    try {
      hands.close()
    } catch (e) {
      console.warn('Failed to close hands instance', e)
    }
    hands = null
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
