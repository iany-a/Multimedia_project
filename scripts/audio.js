let audioContext;
const samples = { kick: [], hihat: [], synth: [], clap: [] };

// Pads currently pressed
const pressedPads = new Set();

// Active AudioSourceNodes (to stop them)
const activeSources = new Map();

// BPM retrigger timers
const retriggerTimers = new Map();

// Mode + BPM
let holdMode = true;
let bpm = 130;

// Sample paths
const samplePaths = {
  kick: ['kick1.wav','kick2.wav','kick3.wav','kick4.wav','kick5.wav','kick6.wav','kick7.wav','kick8.wav'],
  hihat: ['hihat1.wav','hihat2.wav','hihat3.wav','hihat4.wav','hihat5.wav','hihat6.wav','hihat7.wav','hihat8.wav'],
  synth: ['stab1.wav','stab2.wav','stab3.wav','stab4.wav','stab5.wav','stab6.wav','stab7.wav','stab8.wav'],
  clap: ['clap1.wav','clap2.wav','clap3.wav','clap4.wav','clap5.wav','clap6.wav','clap7.wav','clap8.wav']
};

// Initialize Audio
function initAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    loadSamples();
  } else if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
}

// Load all samples
async function loadSamples() {
  for (const category in samplePaths) {
    samples[category] = []; // Initialize arrays properly
    for (let i = 0; i < samplePaths[category].length; i++) {
      try {
        const res = await fetch('sounds/' + samplePaths[category][i]);
        const buf = await res.arrayBuffer();
        samples[category][i] = await audioContext.decodeAudioData(buf);
      } catch (error) {
        console.error(`Failed to load ${samplePaths[category][i]}:`, error);
      }
    }
  }
}

// Calculate interval in ms for BPM
function beatDuration() {
  return 60000 / bpm;
}

// Stop all active sources for a specific pad
function stopAllSources(key) {
  if (activeSources.has(key)) {
    activeSources.get(key).forEach(source => {
      try {
        source.stop();
      } catch (e) {
        // Source might already be stopped
      }
    });
    activeSources.delete(key);
  }
}

// Start BPM retrigger for a pad
function startBpmRetrigger(category, index) {
  const key = `${category}-${index}`;
  const buffer = samples[category]?.[index];
  if (!buffer) return;

  stopBpmRetrigger(key); // ensure no previous timer
  stopAllSources(key); // Stop any existing sounds

  const retrigger = () => {
    if (!pressedPads.has(key)) return; // stop if key released

    // Stop previous sources and create new one
    stopAllSources(key);
    
    const src = audioContext.createBufferSource();
    src.buffer = buffer;
    src.connect(audioContext.destination);
    src.start();

    // Track this source
    if (!activeSources.has(key)) {
      activeSources.set(key, new Set());
    }
    activeSources.get(key).add(src);

    // Schedule next retrigger
    const timerId = setTimeout(retrigger, beatDuration());
    retriggerTimers.set(key, { timerId, retrigger });
  };

  retrigger(); // start immediately
}

// Stop BPM retrigger for a pad
function stopBpmRetrigger(key) {
  if (retriggerTimers.has(key)) {
    clearTimeout(retriggerTimers.get(key).timerId);
    retriggerTimers.delete(key);
  }
  stopAllSources(key); // Also stop all sounds
}

// Play one-shot sample
function playOneShot(category, index) {
  const buffer = samples[category]?.[index];
  if (!buffer) return;

  const key = `${category}-${index}`;
  stopAllSources(key); // Stop any existing sounds first

  const src = audioContext.createBufferSource();
  src.buffer = buffer;
  src.connect(audioContext.destination);
  src.start();

  // Track this source (cleanup after it ends)
  if (!activeSources.has(key)) {
    activeSources.set(key, new Set());
  }
  activeSources.get(key).add(src);
  
  // Cleanup when source ends
  src.onended = () => {
    activeSources.get(key)?.delete(src);
    if (activeSources.get(key)?.size === 0) {
      activeSources.delete(key);
    }
  };
}

// Main play handler
function playSample(category, index, action) {
  if (!audioContext) initAudio();

  const key = `${category}-${index}`;

  if (holdMode) {
    if (action === 'start') {
      if (pressedPads.has(key)) return;
      pressedPads.add(key);
      startBpmRetrigger(category, index);
    } else if (action === 'stop') {
      pressedPads.delete(key);
      stopBpmRetrigger(key);
    }
  } else {
    playOneShot(category, index);
  }
}

// -----------------------
// DOM Events
// -----------------------
document.addEventListener('DOMContentLoaded', () => {

  // Mode toggle
  const modeToggle = document.getElementById('modeToggle');
  const modeText = document.getElementById('modeText');

  if (modeToggle && modeText) {
    modeToggle.addEventListener('click', () => {
      holdMode = !holdMode;
      modeText.textContent = holdMode ? 'Hold Mode' : 'One-Shot Mode';
      modeToggle.className = holdMode
        ? 'btn btn-lg btn-warning'
        : 'btn btn-lg btn-success';
    });
  }

  // BPM slider
  const bpmSlider = document.getElementById('bpmSlider');
  const bpmValue = document.getElementById('bpmValue');
  if (bpmSlider && bpmValue) {
    bpmSlider.min = 130;
    bpmSlider.max = 155;
    bpmSlider.value = bpm;
    bpmValue.textContent = bpm;
    
    bpmSlider.addEventListener('input', e => {
      bpm = Number(e.target.value);
      bpmValue.textContent = bpm;
    });
  }

  // Mouse events - FIXED for all pads
  document.addEventListener('mousedown', e => {
    if (!e.target.classList.contains('pad')) return;
    const pad = e.target;
    const category = pad.dataset.category;
    const index = Number(pad.dataset.index);

    playSample(category, index, 'start');
    pad.classList.add('playing');
  });

  document.addEventListener('mouseup', () => {
    document.querySelectorAll('.pad.playing').forEach(pad => {
      const category = pad.dataset.category;
      const index = Number(pad.dataset.index);

      if (holdMode) playSample(category, index, 'stop');
      pad.classList.remove('playing');
    });
  });


// Keyboard mapping
const keyMap = {
  '1': { category: 'kick', index: 0 },
  '2': { category: 'kick', index: 1 },
  '3': { category: 'kick', index: 2 },
  '4': { category: 'kick', index: 3 },
  '5': { category: 'kick', index: 4 },
  '6': { category: 'kick', index: 5 },
  '7': { category: 'kick', index: 6 },
  '8': { category: 'kick', index: 7 },
  
  'q': { category: 'hihat', index: 0 },
  'w': { category: 'hihat', index: 1 },
  'e': { category: 'hihat', index: 2 },
  'r': { category: 'hihat', index: 3 },
  't': { category: 'hihat', index: 4 },
  'y': { category: 'hihat', index: 5 },
  'u': { category: 'hihat', index: 6 },
  'i': { category: 'hihat', index: 7 },
  
  'a': { category: 'synth', index: 0 },
  's': { category: 'synth', index: 1 },
  'd': { category: 'synth', index: 2 },
  'f': { category: 'synth', index: 3 },
  'g': { category: 'synth', index: 4 },
  'h': { category: 'synth', index: 5 },
  'j': { category: 'synth', index: 6 },
  'k': { category: 'synth', index: 7 },

  'z': { category: 'clap', index: 0 },
  'x': { category: 'clap', index: 1 },
  'c': { category: 'clap', index: 2 },
  'v': { category: 'clap', index: 3 },
  'b': { category: 'clap', index: 4 },
  'n': { category: 'clap', index: 5 },
  'm': { category: 'clap', index: 6 },
  ',': { category: 'clap', index: 7 }
};

// Keyboard events
document.addEventListener('keydown', e => {
  if (e.repeat) return;
  
  const mapping = keyMap[e.key.toLowerCase()];
  if (!mapping || !samples[mapping.category]?.[mapping.index]) return;
  
  playSample(mapping.category, mapping.index, 'start');
  const pad = document.querySelector(`[data-category="${mapping.category}"][data-index="${mapping.index}"]`);
  if (pad) pad.classList.add('playing');
});

document.addEventListener('keyup', e => {
  if (!holdMode) return;
  
  const mapping = keyMap[e.key.toLowerCase()];
  if (!mapping || !samples[mapping.category]?.[mapping.index]) return;
  
  playSample(mapping.category, mapping.index, 'stop');
  const pad = document.querySelector(`[data-category="${mapping.category}"][data-index="${mapping.index}"]`);
  if (pad) pad.classList.remove('playing');
});






});
