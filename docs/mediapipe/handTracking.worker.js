/* eslint-disable no-undef */
importScripts('hands.js');

let hands = null;

self.onmessage = async (e) => {
  const { type, payload } = e.data;

  if (type === 'init') {
    try {
        console.log('Worker: Initializing MediaPipe Hands...');
        
        hands = new self.Hands({
            locateFile: (file) => {
                // Return just the filename since everything is in the same directory
                // and we are running from that directory.
                return file; 
            }
        });

        hands.setOptions(payload.options);
        
        hands.onResults((results) => {
            const { multiHandLandmarks, multiHandedness } = results;
            self.postMessage({ 
                type: 'results', 
                data: { multiHandLandmarks, multiHandedness } 
            });
        });
        
        console.log('Worker: MediaPipe Hands initialized');
        self.postMessage({ type: 'ready' });
    } catch (err) {
        console.error('Worker: Initialization error', err);
        self.postMessage({ type: 'error', error: err.message });
    }
  } else if (type === 'detect') {
      // ... same as before
    if (hands && payload.image) {
      try {
        await hands.send({ image: payload.image });
        if (payload.image.close) {
            payload.image.close();
        }
      } catch (err) {
        console.error('Worker: Detection error', err);
      }
    }
  } else if (type === 'close') {
      if (hands) {
          hands.close();
          hands = null;
      }
      self.close();
  }
};
