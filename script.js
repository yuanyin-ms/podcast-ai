// Add loading spinner style
const spinnerStyle = document.createElement('style');
spinnerStyle.textContent = `
    .loading-spinner {
        width: 40px;
        height: 40px;
        margin: 0 auto;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #3498db;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(spinnerStyle);

// Wave animation configuration
const waveConfig = {
    amplitude: 12,
    frequency: 0.05,
    speed: 0.03,
    color: 'rgba(255, 255, 255, 0.3)',
    waves: 2
};

// Wave animation setup
function setupWaveAnimation() {
    const canvas = document.getElementById('waveCanvas');
    const ctx = canvas.getContext('2d');
    let animationId;
    let time = 0;
    let isAnimating = false;

    function resizeCanvas() {
        canvas.width = canvas.offsetWidth * window.devicePixelRatio;
        canvas.height = canvas.offsetHeight * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    function drawWave() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        for(let w = 0; w < waveConfig.waves; w++) {
            ctx.beginPath();
            ctx.moveTo(0, canvas.offsetHeight / 2);
            
            for(let x = 0; x < canvas.offsetWidth; x++) {
                const y = Math.sin(x * waveConfig.frequency + time + (w * Math.PI / 3)) *
                         waveConfig.amplitude + (canvas.offsetHeight / 2);
                ctx.lineTo(x, y);
            }

            ctx.strokeStyle = waveConfig.color;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        
        if (isAnimating) {
            time += waveConfig.speed;
            animationId = requestAnimationFrame(drawWave);
        }
    }

    function startAnimation() {
        if (!isAnimating) {
            isAnimating = true;
            drawWave();
        }
    }

    function stopAnimation() {
        isAnimating = false;
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        // 在停止时保持最后一帧的波形
        drawWave();
    }

    // Handle resize
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    
    // 初始化时绘制静态波形
    drawWave();

    return {
        start: startAnimation,
        stop: stopAnimation
    };
}

document.addEventListener('DOMContentLoaded', function() {
    // Setup wave animation
    const waveAnimation = setupWaveAnimation();

    // Audio preloading system
    const audioPreloader = {
        preloadedAudios: new Map(),
        
        preloadAll: function() {
            dialogues.forEach((dialogue, index) => {
                if (dialogue.audioUrl) {
                    const audio = new Audio();
                    audio.src = dialogue.audioUrl;
                    audio.load();
                    this.preloadedAudios.set(dialogue.audioUrl, audio);
                }
            });
            console.log('Preloaded all audio files');
        },
        
        get: function(url) {
            return this.preloadedAudios.get(url);
        }
    };

    // DOM Elements
    const audioPlayer = document.getElementById('audio-player');
    const transcriptContainer = document.getElementById('transcript');
    const prevBtn = document.getElementById('prev-btn');
    const playBtn = document.getElementById('play-btn');
    const nextBtn = document.getElementById('next-btn');
    const currentIndexEl = document.getElementById('current-index');
    const totalCountEl = document.getElementById('total-count');
    
    // State variables
    let podcastData = null;
    let currentIndex = 0;
    let dialogues = [];
    let isProcessingAction = false;
    let isAutoPlaying = false;
    let totalDuration = 0;
    let currentTotalTime = 0;
    
    // Cache DOM elements for progress display
    const progressFill = document.getElementById('progress-fill');
    const currentTimeDisplay = document.getElementById('current-time');
    const totalTimeDisplay = document.getElementById('total-time');
    
    // API configuration
    const API_URL = 'https://api.coze.cn/v1/workflow/run';
    const API_TOKEN = 'pat_r4cN3RAjBASqvNFAASva5ArsiqeRXssWACRIK8hEFXqV2GyK02jcR0UmS5F6TGLm';
    const WORKFLOW_ID = '7513894548222525474';
    
    // Config flag - set to false to use local test.json (for development)
    const USE_API = false;
    
    // Auto-trigger podcast generation on page load
    handleGeneratePodcast();
    
    // Handler for the generate button
    async function handleGeneratePodcast() {
        
        // Clear previous data
        podcastData = null;
        dialogues = [];
        
        try {
            if (USE_API) {
                // Use the API to get podcast data
                const data = await fetchPodcastData();
                console.log('API request successful');
                podcastData = data;
                createDialogueList();
                initializePlayer();
            } else {
                try {
                // Use local test.json instead (for development/testing)
                const response = await fetch('test.json');
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                const data = await response.json();
                
                console.log('Test data loaded successfully');
                try {
                    // Try parsing the nested data
                    podcastData = JSON.parse(data.data);
                } catch (error) {
                    // If parsing fails, check if data.data is already an object
                    if (typeof data.data === 'object') {
                        podcastData = data.data;
                    } else {
                        throw new Error('Failed to parse test data');
                    }
                }
                
                // Create dialogue list
                createDialogueList();
                initializePlayer();
            } catch (error) {
                console.error('Error loading test data:', error);
                console.trace('Error stack trace');
                }
            }
        } catch (error) {
            console.error('Failed to load podcast data:', error);
            console.trace('Error stack trace');
        }
    }
    
    // Fetch podcast data from the API
    async function fetchPodcastData(article_content) {
        console.log('Fetching podcast data from API...');
        
        // Prepare request body with parameters
        const requestBody = {
            parameters: {
                article_content: article_content
            },
            workflow_id: WORKFLOW_ID
        };
        
        // API request options
        const requestOptions = {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        };
        
        try {
            const response = await fetch(API_URL, requestOptions);
            if (!response.ok) {
                throw new Error(`API responded with status ${response.status}`);
            }
            
            const data = await response.json();
            console.log('API response:', data);
            
            if (!data || data.code !== 0) {
                throw new Error('Invalid response from API');
            }
            
            try {
                return JSON.parse(data.data);
            } catch (error) {
                if (typeof data.data === 'object') {
                    return data.data;
                }
                throw new Error('Failed to parse API response data');
            }
        } catch (error) {
            console.error('API fetch error:', error);
            throw error;
        }
    }
    
    // Create an ordered list of dialogues with audio URLs
    function createDialogueList() {
        if (!podcastData || !podcastData.text) {
            console.error('无效的播客数据结构');
            return;
        }
        
        const textEntries = podcastData.text || [];
        const speakerAUrls = podcastData.speaker_A || [];
        const speakerBUrls = podcastData.speaker_B || [];
        
        console.log(`Text entries: ${textEntries.length}`);
        console.log(`Speaker A URLs: ${speakerAUrls.length}`);
        console.log(`Speaker B URLs: ${speakerBUrls.length}`);
        
        // First, collect all valid audio URLs for both speakers
        const speakerAAudioUrls = [];
        const speakerBAudioUrls = [];

        // Process Speaker A URLs
        if (speakerAUrls && speakerAUrls.length > 0) {
            for (const item of speakerAUrls) {
                if (item && item.data && item.data.link) {
                    speakerAAudioUrls.push(item.data.link.trim());
                }
            }
        }

        // Process Speaker B URLs
        if (speakerBUrls && speakerBUrls.length > 0) {
            for (const item of speakerBUrls) {
                if (item && item.data && item.data.link) {
                    speakerBAudioUrls.push(item.data.link.trim());
                }
            }
        }

        console.log('Speaker A URLs:', speakerAAudioUrls.length);
        console.log('Speaker B URLs:', speakerBAudioUrls.length);

        // Keep track of used URLs for each speaker
        let speakerAIndex = 0;
        let speakerBIndex = 0;
        
        // Create a dialogue object for each text entry and assign audio sequentially
        dialogues = textEntries.map((item, index) => {
            let audioUrl = '';
            
            // Assign audio URL based on speaker
            if (item.speaker === 'A' && speakerAIndex < speakerAAudioUrls.length) {
                audioUrl = speakerAAudioUrls[speakerAIndex];
                speakerAIndex++;
            } else if (item.speaker === 'B' && speakerBIndex < speakerBAudioUrls.length) {
                audioUrl = speakerBAudioUrls[speakerBIndex];
                speakerBIndex++;
            }
            
            return {
                index: index,
                speaker: item.speaker,
                text: item.text,
                audioUrl: audioUrl
            };
        });
        
        console.log(`Created ${dialogues.length} dialogues`);
        
        // Reset total duration
        totalDuration = 0;
        updateTimeDisplay(0);
    }
    
    // Initialize player UI and event listeners
    function initializePlayer() {
        if (!dialogues.length) {
            console.error('无对话内容可播放');
            return;
        }
        
        // Preload all audio files
        audioPreloader.preloadAll();
        
        // Reset current index
        currentIndex = 0;
        
        // Render transcript
        renderTranscript();
        
        // Update UI counters
        updateUICounters();
        
        // Set initial audio source
        setAudioSource(currentIndex);
        
        // Add click handlers for buttons
        prevBtn.onclick = playPrevious;
        playBtn.onclick = togglePlayPause;
        nextBtn.onclick = playNext;
        
        // Add audio element event listeners
        audioPlayer.addEventListener('ended', handleAudioEnded);
        audioPlayer.addEventListener('timeupdate', updateProgress);
        audioPlayer.addEventListener('loadedmetadata', () => {
            if (currentIndex === 0) {
                calculateTotalDuration();
            }
        });
        audioPlayer.addEventListener('play', () => {
            playBtn.classList.remove('icon-play');
            playBtn.classList.add('icon-pause');
            waveAnimation.start();
        });
        audioPlayer.addEventListener('pause', () => {
            playBtn.classList.remove('icon-pause');
            playBtn.classList.add('icon-play');
            waveAnimation.stop();
        });
        audioPlayer.addEventListener('error', (e) => {
            console.error('Audio error:', e);
            
            // Check if it's a speaker B URL that might have expired
            const currentDialogue = dialogues[currentIndex];
            if (currentDialogue && currentDialogue.speaker === 'B') {
                console.log('Speaker B audio failed - possibly expired URL');
            }
            
            // If error occurs during auto-play, try to move to next
            if (isAutoPlaying && currentIndex < dialogues.length - 1) {
                console.log('Auto-advancing due to error');
                setTimeout(() => playNext(), 500);
            } else {
                console.error('Audio loading failed');
                // Display a message to the user that the audio link might have expired
                const messageEl = document.getElementById(`message-${currentIndex}`);
                if (messageEl) {
                    const errorNote = document.createElement('div');
                    errorNote.classList.add('error-note');
                    errorNote.textContent = '音频链接已过期，请重新生成';
                    messageEl.appendChild(errorNote);
                }
            }
        });
        
    }
    
    // Render the full transcript
    function renderTranscript() {
        transcriptContainer.innerHTML = '';
        
        dialogues.forEach(dialogue => {
            const messageEl = document.createElement('div');
            messageEl.classList.add('message', `message-${dialogue.speaker}`);
            messageEl.id = `message-${dialogue.index}`;
            messageEl.dataset.index = dialogue.index;
            
            messageEl.textContent = dialogue.text;
            
            // Add click behavior without title
            messageEl.style.cursor = 'pointer';
            messageEl.onclick = function() {
                const index = parseInt(this.dataset.index, 10);
                playFromIndex(index);
            };
            
            transcriptContainer.appendChild(messageEl);
        });
        
        // Initial highlight
        highlightCurrentMessage();
    }
    
    // Play from specific index
    async function playFromIndex(index) {
        if (isProcessingAction) return;
        isProcessingAction = true;
        isAutoPlaying = true;
        
        // Validate index
        if (index < 0 || index >= dialogues.length) {
            isProcessingAction = false;
            isAutoPlaying = false;
            return;
        }
        
        // Update current index
        currentIndex = index;
        
        // Update UI
        updateUICounters();
        highlightCurrentMessage();
        
        // Pause any existing playback
        audioPlayer.pause();
        
        try {
            // Set new audio source and wait for it to load
            const hasAudio = await setAudioSource(currentIndex);
            
            if (hasAudio) {
                await audioPlayer.play();
                isProcessingAction = false;
            } else {
                isProcessingAction = false;
                // Skip to next if this one has no audio
                if (isAutoPlaying && currentIndex < dialogues.length - 1) {
                    setTimeout(() => playNext(), 100);
                } else {
                    isAutoPlaying = false;
                }
            }
        } catch (error) {
            console.error('Audio playback error:', error);
            isProcessingAction = false;
            
            // Try next audio on error
            if (isAutoPlaying && currentIndex < dialogues.length - 1) {
                setTimeout(() => playNext(), 500);
            } else {
                isAutoPlaying = false;
            }
        }
    }
    

    // Set audio source for current index
    async function setAudioSource(index) {
        if (!dialogues[index] || !dialogues[index].audioUrl) {
            return false;
        }

        const dialogue = dialogues[index];
        console.log(`Loading audio [${index + 1}/${dialogues.length}] Speaker ${dialogue.speaker}`);
        
        try {
            // Calculate time played before this segment
            let previousTime = 0;
            for (let i = 0; i < index; i++) {
                previousTime += segmentDurations[i] || 0;
            }
            currentTotalTime = previousTime;
            updateTimeDisplay(currentTotalTime);

            // Use preloaded audio if available
            const preloadedAudio = audioPreloader.get(dialogue.audioUrl);
            if (preloadedAudio) {
                audioPlayer.src = preloadedAudio.src;
            } else {
                audioPlayer.src = dialogue.audioUrl;
            }

            // Create a new promise for audio loading
            const loadPromise = new Promise((resolve, reject) => {
                audioPlayer.onloadedmetadata = () => {
                    console.log(`Audio loaded successfully for Speaker ${dialogue.speaker}`);
                    if (!segmentDurations[index]) {
                        segmentDurations[index] = audioPlayer.duration;
                        totalDuration = segmentDurations.reduce((sum, duration) => sum + (duration || 0), 0);
                        updateTimeDisplay(currentTotalTime);
                    }
                    resolve(true);
                };
                
                audioPlayer.onerror = (e) => {
                    console.error(`Audio error for Speaker ${dialogue.speaker}:`, e);
                    reject(new Error('Audio loading failed'));
                };
            });


            await loadPromise;
            return true;
        } catch (error) {
            console.error('Error setting audio source:', error);
            return false;
        }
    }
    
    // Store segment durations
    let segmentDurations = [];

    // Calculate and update total duration
    async function calculateTotalDuration() {
        totalDuration = 0;
        currentTotalTime = 0;
        segmentDurations = new Array(dialogues.length).fill(0);

        // Create promises for all audio durations
        const durationPromises = dialogues.map((dialogue, index) => {
            if (!dialogue.audioUrl) return Promise.resolve(0);

            return getAudioDuration(dialogue.audioUrl)
                .then(duration => {
                    segmentDurations[index] = duration;
                    return duration;
                })
                .catch(error => {
                    console.error('Error calculating duration:', error);
                    return 0;
                });
        });

        // Wait for all durations to be calculated
        await Promise.all(durationPromises);
        totalDuration = segmentDurations.reduce((sum, duration) => sum + duration, 0);

        // Update total time display
        updateTimeDisplay(0);
        console.log('Total duration:', totalDuration);
    }

    // Get audio duration without creating permanent Audio objects
    function getAudioDuration(url) {
        return new Promise((resolve) => {
            const audio = new Audio();
            audio.addEventListener('loadedmetadata', () => {
                const duration = audio.duration;
                audio.remove();
                resolve(duration);
            });
            audio.addEventListener('error', () => {
                audio.remove();
                resolve(0);
            });
            audio.src = url;
        });
    }

    // Update progress bar and time display
    function updateProgress() {
        const currentTime = audioPlayer.currentTime;
        
        // Calculate total played time including previous segments
        let previousSegmentsTime = 0;
        for (let i = 0; i < currentIndex; i++) {
            previousSegmentsTime += segmentDurations[i] || 0;
        }
        
        currentTotalTime = previousSegmentsTime + currentTime;
        
        // Update progress bar
        if (totalDuration > 0) {
            const progress = (currentTotalTime / totalDuration) * 100;
            progressFill.style.width = `${progress}%`;
        }
        
        // Update time display
        updateTimeDisplay(currentTotalTime);
    }
    
    // Format and update time display
    function updateTimeDisplay(currentTime) {
        currentTimeDisplay.textContent = formatTime(currentTime);
        totalTimeDisplay.textContent = formatTime(totalDuration);
    }
    
    // Format time in MM:SS
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // Add click handler for progress bar
    document.querySelector('.progress-bar').addEventListener('click', async (e) => {
        const progressBar = e.currentTarget;
        const rect = progressBar.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        const seekTime = ratio * totalDuration;
        
        // Find the correct segment and time
        let accumulatedTime = 0;
        for (let i = 0; i < dialogues.length; i++) {
            if (accumulatedTime + segmentDurations[i] > seekTime) {
                // Found the correct segment
                const segmentTime = seekTime - accumulatedTime;
                await playFromIndex(i);
                audioPlayer.currentTime = segmentTime;
                break;
            }
            accumulatedTime += segmentDurations[i];
        }
    });
    
    // Update UI counters
    function updateUICounters() {
        currentIndexEl.textContent = currentIndex + 1;
        totalCountEl.textContent = dialogues.length;
    }
    
    // Highlight the current message in the transcript
    function highlightCurrentMessage() {
        // Remove highlight from all messages
        const allMessages = document.querySelectorAll('.message');
        allMessages.forEach(msg => {
            msg.classList.remove('active-message');
        });
        
        // Add highlight to current message
        const currentMessage = document.getElementById(`message-${currentIndex}`);
        if (currentMessage) {
            currentMessage.classList.add('active-message');
            
            // Scroll into view
            currentMessage.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }
    
    // Handle audio ended event
    function handleAudioEnded() {
        console.log('Audio ended, moving to next');
        
        // Auto-play next dialogue
        if (currentIndex < dialogues.length - 1) {
            isAutoPlaying = true;
            playNext();
        } else {
            isAutoPlaying = false;
            // End of playback - no status message needed
        }
    }
    
    // Play previous dialogue
    function playPrevious() {
        isAutoPlaying = false; // Disable auto-play when manually navigating
        
        if (currentIndex > 0) {
            playFromIndex(currentIndex - 1);
        }
    }
    
    // Toggle play/pause
    function togglePlayPause() {
        if (audioPlayer.paused) {
            // If paused, start playing current dialogue
            isAutoPlaying = true;
            
            // If no audio at current index, find next with audio
            if (!dialogues[currentIndex].audioUrl) {
                for (let i = currentIndex; i < dialogues.length; i++) {
                    if (dialogues[i].audioUrl) {
                        playFromIndex(i);
                        return;
                    }
                }
                // No status message for unplayable audio
            } else {
                audioPlayer.play()
                    .catch(error => {
                        console.error('Play error:', error);
                        isAutoPlaying = false;
                    });
            }
        } else {
            audioPlayer.pause();
            isAutoPlaying = false;
        }
    }
    
    // Play next dialogue
    function playNext() {
        if (currentIndex < dialogues.length - 1) {
            playFromIndex(currentIndex + 1);
        } else {
            isAutoPlaying = false;
        }
    }

    // Initialize modal functionality
    const editModal = document.getElementById('editModal');
    const articleContent = document.getElementById('articleContent');
    const cancelBtn = document.getElementById('cancelBtn');
    const confirmBtn = document.getElementById('confirmBtn');
    const floatingBtn = document.getElementById('floatingEditBtn');

    // Show modal when edit button is clicked
    floatingBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent drag event
        if (!isDragging) {
            editModal.style.display = 'block';
        }
    });

    // Close modal when cancel button is clicked
    cancelBtn.addEventListener('click', () => {
        editModal.style.display = 'none';
        articleContent.value = ''; // Clear textarea
    });

    // Handle confirm button click
    // Create loading overlay
    const loadingOverlay = document.createElement('div');
    loadingOverlay.style.cssText = `
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999;
        justify-content: center;
        align-items: center;
    `;
    loadingOverlay.innerHTML = `
        <div style="color: white; background: rgba(0, 0, 0, 0.7); padding: 20px; border-radius: 10px;">
            <div style="text-align: center; margin-bottom: 10px;">
                <div class="loading-spinner"></div>
            </div>
            <div>正在生成播客内容，请稍候...</div>
        </div>
    `;
    document.body.appendChild(loadingOverlay);

    confirmBtn.addEventListener('click', async () => {
        const content = articleContent.value.trim();
        if (content) {
            // Show loading overlay
            loadingOverlay.style.display = 'flex';
            
            try {
                const data = await fetchPodcastData(content);
                console.log('API request successful');
                podcastData = data;
                createDialogueList();
                initializePlayer();
                editModal.style.display = 'none';
                articleContent.value = ''; // Clear textarea
            } catch (error) {
                console.error('Failed to load podcast data:', error);
                console.trace('Error stack trace');
                alert('生成播客内容失败，请重试');
            } finally {
                // Hide loading overlay
                loadingOverlay.style.display = 'none';
            }
        } else {
            editModal.style.display = 'none';
            articleContent.value = ''; // Clear textarea
        }
    });

    // Close modal when clicking outside
    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) {
            editModal.style.display = 'none';
            articleContent.value = '';
        }
    });

    // Initialize floating edit button drag functionality
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    function dragStart(e) {
        if (e.type === 'touchstart') {
            initialX = e.touches[0].clientX - xOffset;
            initialY = e.touches[0].clientY - yOffset;
        } else {
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
        }

        if (e.target === floatingBtn) {
            isDragging = true;
        }
    }

    function drag(e) {
        if (isDragging) {
            e.preventDefault();

            if (e.type === 'touchmove') {
                currentX = e.touches[0].clientX - initialX;
                currentY = e.touches[0].clientY - initialY;
            } else {
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
            }

            xOffset = currentX;
            yOffset = currentY;

            // Prevent button from going outside the viewport
            const buttonRect = floatingBtn.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            if (currentX < 0) currentX = 0;
            if (currentY < 0) currentY = 0;
            if (currentX + buttonRect.width > viewportWidth) {
                currentX = viewportWidth - buttonRect.width;
            }
            if (currentY + buttonRect.height > viewportHeight) {
                currentY = viewportHeight - buttonRect.height;
            }

            setTranslate(currentX, currentY, floatingBtn);
        }
    }

    function dragEnd() {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
    }

    function setTranslate(xPos, yPos, el) {
        el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
    }

    // Touch events
    floatingBtn.addEventListener('touchstart', dragStart, { passive: false });
    floatingBtn.addEventListener('touchend', dragEnd);
    floatingBtn.addEventListener('touchmove', drag, { passive: false });

    // Mouse events
    floatingBtn.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    // Handle window resize
    window.addEventListener('resize', () => {
        const buttonRect = floatingBtn.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Adjust position if button is outside viewport after resize
        if (currentX + buttonRect.width > viewportWidth) {
            currentX = viewportWidth - buttonRect.width;
            xOffset = currentX;
        }
        if (currentY + buttonRect.height > viewportHeight) {
            currentY = viewportHeight - buttonRect.height;
            yOffset = currentY;
        }

        setTranslate(currentX, currentY, floatingBtn);
    });
});