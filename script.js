// Update clock
function updateTime() {
    const now = new Date();
    document.getElementById('time-display').innerText = now.toLocaleTimeString('en-US', { hour12: false });
}
setInterval(updateTime, 1000);
updateTime();

// UI Elements
const listenBtn = document.getElementById('listen-btn');
const stopBtn = document.getElementById('stop-btn');
const aiCore = document.getElementById('ai-core');
const outputLog = document.getElementById('output-log');
const cmdInput = document.getElementById('cmd-input');

// Speech Synthesis
const synth = window.speechSynthesis;
let jarvisVoice = null;
synth.onvoiceschanged = () => {
    const voices = synth.getVoices();
    jarvisVoice = voices.find(v => v.name.includes('Google UK English Male')) || 
                 voices.find(v => v.lang === 'en-GB' && v.name.includes('Male')) || 
                 voices.find(v => v.lang === 'en-US') || voices[0];
};

function speak(text) {
    if (synth.speaking) synth.cancel(); 
    logMsg(text, 'jarvis-msg');
    
    const utterThis = new SpeechSynthesisUtterance(text);
    if (jarvisVoice) utterThis.voice = jarvisVoice;
    utterThis.pitch = 0.9;
    utterThis.rate = 1.05;
    
    utterThis.onstart = () => aiCore.classList.add('listening');
    utterThis.onend = () => {
        aiCore.classList.remove('listening');
        // Automatically resume listening for continuous conversation!
        if (isContinuousMode) {
            startListening();
        }
    };
    synth.speak(utterThis);
}

function logMsg(text, className) {
    const p = document.createElement('div');
    p.className = className;
    const prefix = className === 'user-msg' ? 'USER: ' : className === 'jarvis-msg' ? 'J.A.R.V.I.S.: ' : '> ';
    
    // Custom Markdown Code Block Parser
    if (text.includes('```')) {
        const parts = text.split('```');
        let htmlContent = `<span>${prefix}</span>`;
        for (let i = 0; i < parts.length; i++) {
            if (i % 2 === 1) { // It's a code block
                // Remove the language identifier (e.g. 'python\n')
                const codeContent = parts[i].replace(/^[a-z]+\n/, '');
                htmlContent += `<div class="stark-code-block">${codeContent}</div>`;
            } else { // It's normal text
                htmlContent += `<span>${parts[i].replace(/\n/g, '<br>')}</span>`;
            }
        }
        p.innerHTML = htmlContent;
    } else {
        p.innerText = prefix + text;
    }
    
    outputLog.appendChild(p);
    outputLog.scrollTop = outputLog.scrollHeight;
}

// Manual Text Input Fallback
cmdInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        const cmd = this.value.trim().toLowerCase();
        if (cmd) {
            logMsg(cmd, 'user-msg');
            processCommand(cmd);
            this.value = '';
        }
    }
});

// Advanced Audio Recording with VAD (Voice Activity Detection)
let mediaRecorder;
let audioChunks = [];
let audioContext;
let analyser;
let microphone;
let silenceTimer = null;
let isRecording = false;
let isContinuousMode = false; // Tracks if the user wants continuous conversation

async function setupAudio() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.minDecibels = -60; // Silence threshold
        
        microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            isRecording = false;
            aiCore.classList.remove('listening');
            
            if (audioChunks.length > 0) {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                audioChunks = [];
                await sendAudioToGroq(audioBlob);
            }
        };

    } catch (err) {
        logMsg('Microphone access denied or unavailable.', 'error-msg');
        console.error(err);
    }
}

function detectSilence() {
    if (!isRecording) return;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);
    
    let sum = 0;
    for(let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
    }
    const average = sum / bufferLength;
    
    // Increased threshold to 15 to account for background noise
    if (average < 15) { 
        if (!silenceTimer) {
            // Stop recording after 2 seconds of silence
            silenceTimer = setTimeout(() => {
                if (mediaRecorder.state === 'recording') {
                    logMsg('Silence detected. Processing uplink...', 'system-msg');
                    mediaRecorder.stop();
                }
            }, 2000);
        }
    } else {
        if (silenceTimer) {
            clearTimeout(silenceTimer);
            silenceTimer = null;
        }
    }
    
    requestAnimationFrame(detectSilence);
}

async function sendAudioToGroq(audioBlob) {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.webm');
    
    try {
        const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.error) {
            logMsg('API Error: ' + data.error, 'error-msg');
            speak("I encountered an error processing the audio uplink, sir.");
        } else if (data.text) {
            const transcript = data.text.trim();
            logMsg(transcript, 'user-msg');
            
            if (data.action && data.action.type === 'open_url') {
                logMsg(`Executing action: Opening ${data.action.url}`, 'system-msg');
                window.open(data.action.url, '_blank');
            }
            
            if (data.response) {
                speak(data.response);
            } else if (isContinuousMode) {
                // If there's no spoken response, just start listening again immediately
                startListening();
            }
        } else if (isContinuousMode) {
            startListening();
        }
    } catch (e) {
        logMsg('Network Error: ' + e.message, 'error-msg');
        if (isContinuousMode) startListening();
    }
}

async function startListening() {
    if (!mediaRecorder) await setupAudio();
    
    if (mediaRecorder && mediaRecorder.state === 'inactive') {
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
        audioChunks = [];
        mediaRecorder.start();
        isRecording = true;
        
        logMsg('Audio uplink secure. Listening...', 'system-msg');
        aiCore.classList.add('listening');
        listenBtn.classList.add('hidden');
        stopBtn.classList.remove('hidden');
        
        detectSilence();
    }
}

listenBtn.addEventListener('click', () => {
    isContinuousMode = true; // User activated continuous mode!
    startListening();
});

stopBtn.addEventListener('click', () => {
    isContinuousMode = false; // User manually stopped it
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }
    listenBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
    logMsg('Manual Override. Uplink disconnected.', 'system-msg');
});

// --- Armor Database Carousel Logic ---
const armorCards = document.querySelectorAll('.armor-card');
let currentArmorIndex = 0;

function updateCarousel() {
    armorCards.forEach((card, index) => {
        card.classList.remove('active', 'prev', 'next');
        if (index === currentArmorIndex) {
            card.classList.add('active');
        } else if (index === (currentArmorIndex - 1 + armorCards.length) % armorCards.length) {
            card.classList.add('prev');
        } else {
            card.classList.add('next');
        }
    });
}

document.getElementById('next-armor').addEventListener('click', () => {
    currentArmorIndex = (currentArmorIndex + 1) % armorCards.length;
    updateCarousel();
});

document.getElementById('prev-armor').addEventListener('click', () => {
    currentArmorIndex = (currentArmorIndex - 1 + armorCards.length) % armorCards.length;
    updateCarousel();
});

// Initialize carousel
updateCarousel();


// Command Processing Core
async function processCommand(cmd) {
    if (cmd.includes('hello') || cmd.includes('hi jarvis') || cmd.includes('wake up')) {
        const responses = ["Hello sir. Systems are online and ready.", "Greetings sir. How may I assist you today?", "I am here, sir. What are your orders?"];
        speak(responses[Math.floor(Math.random() * responses.length)]);
    } 
    else if (cmd.includes('how are you')) {
        speak("I am functioning at 100% capacity, sir. Thank you for asking.");
    }
    else if (cmd.includes('who are you') || cmd.includes('what are you')) {
        speak("I am J.A.R.V.I.S., Just A Rather Very Intelligent System. An artificial intelligence originally designed by Tony Stark, now adapted for your use.");
    }
    else if (cmd.includes('time')) {
        const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute:'2-digit' });
        speak(`The current time is ${time}.`);
    }
    else if (cmd.includes('date') || cmd.includes('what day is it')) {
        const date = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        speak(`Today is ${date}.`);
    }
    else if (cmd.includes('youtube')) {
        speak("Opening YouTube, sir.");
        window.open('https://www.youtube.com', '_blank');
    }
    else if (cmd.includes('whatsapp')) {
        speak("Accessing WhatsApp interface.");
        window.open('https://web.whatsapp.com', '_blank');
    }
    else if (cmd.includes('google')) {
        speak("Opening Google search.");
        window.open('https://www.google.com', '_blank');
    }
    else if (cmd.includes('github')) {
        speak("Accessing your GitHub repositories.");
        window.open('https://github.com', '_blank');
    }
    else if (cmd.includes('stack overflow') || cmd.includes('stackoverflow')) {
        speak("Opening Stack Overflow, sir.");
        window.open('https://stackoverflow.com', '_blank');
    }
    else if (cmd.startsWith('who is') || cmd.startsWith('what is') || cmd.startsWith('tell me about')) {
        let query = cmd.replace('who is', '').replace('what is', '').replace('tell me about', '').trim();
        speak(`Searching my databases for ${query}...`);
        
        try {
            const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.extract) {
                const summary = data.extract.split('. ').slice(0, 2).join('. ') + '.';
                speak(summary);
            } else {
                speak("I couldn't find sufficient data on that topic, sir.");
            }
        } catch (e) {
            speak("I encountered an error accessing the global database, sir.");
        }
    }
    else if (cmd.includes('battery')) {
        if ('getBattery' in navigator) {
            const battery = await navigator.getBattery();
            const level = Math.round(battery.level * 100);
            const status = battery.charging ? "charging" : "discharging";
            speak(`Your system battery is at ${level} percent and is currently ${status}.`);
        } else {
            speak("I cannot access the battery telemetry on this device, sir.");
        }
    }
    else if (cmd.includes('joke') || cmd.includes('make me laugh')) {
        const jokes = [
            "Why do programmers prefer dark mode? Because light attracts bugs.",
            "There are 10 types of people in the world: those who understand binary, and those who don't.",
            "I would tell you a UDP joke, but you might not get it."
        ];
        speak(jokes[Math.floor(Math.random() * jokes.length)]);
    }
    else if (cmd.includes('stop listening') || cmd.includes('sleep') || cmd.includes('deactivate')) {
        speak("Powering down voice modules. Awaiting your return, sir.");
    }
    else if (cmd.includes('thank you') || cmd.includes('thanks')) {
        speak("You are very welcome, sir.");
    }
    else if (cmd.trim() === '') {
        // Empty command
    }
    else {
        speak("I am sorry, sir. I did not understand that command.");
    }
}
