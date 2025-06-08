let video, canvas, ctx, model;
let isDetecting = false;
let isModelLoaded = false;
let isWebcamConnected = false;
let sensitivity = 0.5;
let frameCount = 0;
let lastTime = performance.now();
let fps = 0;
let detectionTimes = [];

// Performance optimization & stability variables
let processEveryNthFrame = 2;
let frameSkipCounter = 0;
let lastDetections = [];
let detectionStabilityBuffer = [];
const STABILITY_THRESHOLD = 2;
const BUFFER_SIZE = 3;

// Enhanced audio system
let audioContext;
let isAudioInitialized = false;

function initAudio() {
    if (!isAudioInitialized && (window.AudioContext || window.webkitAudioContext)) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        isAudioInitialized = true;
    }
}

function createAdvancedBeep(pattern = 'alert') {
    if (!isAudioInitialized) return;
    
    try {
        const patterns = {
            alert: [{freq: 800, duration: 200, delay: 0}, {freq: 1000, duration: 200, delay: 300}, {freq: 800, duration: 300, delay: 600}],
            success: [{freq: 523, duration: 200, delay: 0}, {freq: 659, duration: 200, delay: 250}, {freq: 784, duration: 300, delay: 500}]
        };
        const sequence = patterns[pattern] || patterns.alert;
        
        sequence.forEach(note => {
            setTimeout(() => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                oscillator.frequency.value = note.freq;
                oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + note.duration / 1000);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + note.duration / 1000);
            }, note.delay);
        });
    } catch (error) {
        console.log('Advanced audio not supported', error);
    }
}

async function loadModel() {
    try {
        updateStatus('🚀 Loading advanced AI models...');
        model = await cocoSsd.load({ base: 'mobilenet_v2' });
        isModelLoaded = true;
        updateStatus('✅ AI Model loaded successfully! Ready for webcam connection.');
        document.getElementById('connectBtn').disabled = false;
        createAdvancedBeep('success');
    } catch (error) {
        console.error('Model loading failed:', error);
        updateStatus('⚠️ AI Model load failed. Please refresh the page.');
        isModelLoaded = false;
    }
}

async function connectWebcam() {
    initAudio();
    video = document.getElementById('video');
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    
    const webcamUrl = document.getElementById('webcamUrl').value.trim();
    if (!webcamUrl) {
        updateStatus('❌ অনুগ্রহ করে ওয়েবক্যাম URL প্রবেশ করান');
        return;
    }
    
    updateStatus('📡 ওয়েবক্যামের সাথে সংযোগ স্থাপন করা হচ্ছে...');
    document.getElementById('connectBtn').disabled = true;
    document.getElementById('webcamUrl').disabled = true;

    video.src = webcamUrl;

    video.onloadedmetadata = () => {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        document.getElementById('detectionOverlay').style.display = 'block';
        document.getElementById('fpsCounter').style.display = 'block';
        
        isWebcamConnected = true;
        updateStatus('✅ ওয়েবক্যাম সফলভাবে সংযুক্ত হয়েছে!');
        document.getElementById('startBtn').disabled = false;
        createAdvancedBeep('success');
    };
    
    video.onerror = () => {
        updateStatus('❌ ওয়েবক্যাম সংযোগ ব্যর্থ। URL এবং নেটওয়ার্ক চেক করুন।');
        isWebcamConnected = false;
        document.getElementById('connectBtn').disabled = false;
        document.getElementById('webcamUrl').disabled = false;
    };
}

function updateStatus(message) {
    document.getElementById('status').textContent = message;
}

function updatePerformanceDisplay(detectionTime) {
    const currentTime = performance.now();
    if (currentTime - lastTime >= 1000) {
        fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        document.getElementById('fpsDisplay').textContent = fps;
        document.getElementById('fpsCounter').textContent = `FPS: ${fps}`;
        frameCount = 0;
        lastTime = currentTime;
    }
    frameCount++;
    
    if (detectionTime) {
        detectionTimes.push(detectionTime);
        if (detectionTimes.length > 10) detectionTimes.shift();
        
        const avgTime = Math.round(detectionTimes.reduce((a, b) => a + b, 0) / detectionTimes.length);
        document.getElementById('speedDisplay').textContent = avgTime + 'ms';
        document.getElementById('processingTime').textContent = avgTime + 'ms';
    }
}

function stabilizeDetections(newDetections) {
    detectionStabilityBuffer.push(newDetections);
    if (detectionStabilityBuffer.length > BUFFER_SIZE) {
        detectionStabilityBuffer.shift();
    }
    const catDetectionCount = detectionStabilityBuffer.reduce((count, detections) => {
        return count + (detections.some(d => d.class === 'cat') ? 1 : 0);
    }, 0);
    return catDetectionCount >= STABILITY_THRESHOLD;
}

function updateDetectedObjects(predictions) {
    const container = document.getElementById('detectedObjects');
    document.getElementById('objectCount').textContent = predictions.length;
    
    if (predictions.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #ccc;">এলাকা নিরাপদ - কোনো বস্তু সনাক্ত হয়নি</div>';
        return;
    }
    
    let html = '';
    predictions.forEach((prediction, index) => {
        const confidence = Math.round(prediction.score * 100);
        let confidenceClass = confidence >= 80 ? 'confidence-high' : confidence >= 60 ? 'confidence-medium' : 'confidence-low';
        const emoji = prediction.class === 'cat' ? '🐱' : prediction.class === 'dog' ? '🐕' : prediction.class === 'bird' ? '🐦' : prediction.class === 'person' ? '👤' : '📦';
        
        html += `<div class="object-item" style="animation-delay: ${index * 0.05}s"><span>${prediction.class} ${emoji}</span><span class="${confidenceClass}">${confidence}%</span></div>`;
    });
    
    container.innerHTML = html;
}

function showAlert(catPredictions) {
    const alertDiv = document.getElementById('alert');
    if (alertDiv.style.display === 'block') return;

    const alertDetails = document.getElementById('alertDetails');
    const highestConfidence = Math.max(...catPredictions.map(p => p.score));
    alertDetails.textContent = `${catPredictions.length} টি বিড়াল | নির্ভুলতা: ${Math.round(highestConfidence * 100)}%`;
    alertDiv.style.display = 'block';
    
    createAdvancedBeep('alert');
    setTimeout(() => { alertDiv.style.display = 'none'; }, 4000);
}

function drawEnhancedDetections(predictions) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    predictions.forEach(prediction => {
        const [x, y, width, height] = prediction.bbox;
        let color = prediction.class === 'cat' ? '#ff4757' : (prediction.class === 'person' ? '#ffa502' : '#2ed573');

        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.shadowBlur = 15;
        ctx.shadowColor = color;
        ctx.strokeRect(x, y, width, height);
        ctx.shadowBlur = 0;

        const label = `${prediction.class} ${Math.round(prediction.score * 100)}%`;
        ctx.font = '18px Arial';
        const textWidth = ctx.measureText(label).width;
        const textHeight = 28;
        
        ctx.fillStyle = color;
        ctx.fillRect(x, y > textHeight ? y - textHeight : y, textWidth + 10, textHeight);
        ctx.fillStyle = 'white';
        ctx.fillText(label, x + 5, y > textHeight ? y - 8 : y + 18);
    });
}

async function detectObjects() {
    if (!isDetecting) return;
    
    const startTime = performance.now();
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    if (isModelLoaded && model && frameSkipCounter % processEveryNthFrame === 0) {
        try {
            const predictions = await model.detect(video);
            lastDetections = predictions.filter(p => p.score >= sensitivity);
        } catch (error) {
            console.error("Detection error:", error);
            updateStatus("⚠️ ভিডিও স্ট্রিমে সমস্যা হয়েছে। পুনরায় সংযোগ করুন।");
            stopDetection();
            return;
        }
    }
    
    updateDetectedObjects(lastDetections);
    drawEnhancedDetections(lastDetections);
    
    const catPredictions = lastDetections.filter(obj => obj.class === 'cat');
    if (catPredictions.length > 0 && stabilizeDetections(catPredictions)) {
        showAlert(catPredictions);
        updateStatus(`🚨 বিড়াল শনাক্ত হয়েছে!`);
    } else {
        updateStatus('🔍 সনাক্তকরণ চলছে... এলাকা নিরাপদ');
    }
    
    const endTime = performance.now();
    updatePerformanceDisplay(endTime - startTime);
    frameSkipCounter++;
    requestAnimationFrame(detectObjects);
}

async function startDetection() {
    if (!isModelLoaded || !isWebcamConnected) {
        updateStatus('❌ প্রথমে মডেল লোড করুন এবং ওয়েবক্যাম সংযোগ করুন');
        return;
    }
    initAudio();
    isDetecting = true;
    document.getElementById('startBtn').disabled = true;
    document.getElementById('stopBtn').disabled = false;
    
    updateStatus('🚀 সনাক্তকরণ শুরু হয়েছে... বিড়ালের জন্য নজর রাখা হচ্ছে');
    frameSkipCounter = 0;
    detectionTimes = [];
    detectionStabilityBuffer = [];
    
    requestAnimationFrame(detectObjects);
}

function stopDetection() {
    isDetecting = false;
    isWebcamConnected = false;

    if (video) {
        video.pause();
        video.src = '';
        video.removeAttribute('src');
    }
    
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    document.getElementById('detectionOverlay').style.display = 'none';
    document.getElementById('fpsCounter').style.display = 'none';
    
    document.getElementById('connectBtn').disabled = false;
    document.getElementById('startBtn').disabled = true;
    document.getElementById('stopBtn').disabled = true;
    document.getElementById('webcamUrl').disabled = false;
    
    updateStatus('⏹️ সনাক্তকরণ বন্ধ করা হয়েছে। আবার শুরু করতে সংযোগ করুন।');
    document.getElementById('detectedObjects').innerHTML = '<div style="text-align: center; color: #ccc;">সিস্টেম প্রস্তুত - কোনো বস্তু সনাক্ত হয়নি</div>';
    document.getElementById('fpsDisplay').textContent = '0';
    document.getElementById('speedDisplay').textContent = '0ms';
}

function testAlarm() {
    initAudio();
    showAlert([{ score: 0.98, class: 'cat', bbox: [] }]);
}

function init() {
    const initialSensitivity = document.getElementById('sensitivitySlider').value;
    document.getElementById('sensitivityValue').textContent = `${Math.round(initialSensitivity * 100)}%`;
    sensitivity = parseFloat(initialSensitivity);
    
    document.getElementById('sensitivitySlider').addEventListener('input', function(e) {
        sensitivity = parseFloat(e.target.value);
        document.getElementById('sensitivityValue').textContent = `${Math.round(sensitivity * 100)}%`;
    });
    
    document.getElementById('connectBtn').addEventListener('click', connectWebcam);
    document.getElementById('startBtn').addEventListener('click', startDetection);
    document.getElementById('stopBtn').addEventListener('click', stopDetection);
    document.getElementById('testAlarmBtn').addEventListener('click', testAlarm);
    
    loadModel();
}

init();