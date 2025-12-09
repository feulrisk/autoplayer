console.log('YouTube Video Sequencer: Loading...');

class YouTubeSequencer {
    constructor() {
        this.videoQueue = [];
        this.currentIndex = 0;
        this.autoPlay = true;
        this.isInitialized = false;
        this.videoEndListener = null;
        this.initialize();
    }

    async initialize() {
        console.log('Initializing YouTube Sequencer...');
        await this.loadSettings();
        this.setupPageListeners();
        this.injectControls();
        this.setupVideoEndListener();
        this.isInitialized = true;
    }

    async loadSettings() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['videoQueue', 'currentIndex', 'autoPlay'], (result) => {
                console.log('Loaded settings:', result);
                if (result.videoQueue && Array.isArray(result.videoQueue)) {
                    this.videoQueue = result.videoQueue;
                }
                this.currentIndex = result.currentIndex || 0;
                this.autoPlay = result.autoPlay !== undefined ? result.autoPlay : true;
                resolve();
            });
        });
    }

    saveSettings() {
        chrome.storage.local.set({
            videoQueue: this.videoQueue,
            currentIndex: this.currentIndex,
            autoPlay: this.autoPlay
        }, () => {
            console.log('Settings saved:', {
                queueLength: this.videoQueue.length,
                currentIndex: this.currentIndex,
                autoPlay: this.autoPlay
            });
        });
    }

    setupPageListeners() {
        let lastUrl = window.location.href;
        
        const observer = new MutationObserver(() => {
            const currentUrl = window.location.href;
            if (currentUrl !== lastUrl) {
                console.log('URL changed:', currentUrl);
                lastUrl = currentUrl;
                
                setTimeout(() => {
                    this.handlePageChange();
                }, 500);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        this.handlePageChange();
    }

    handlePageChange() {
        const isVideoPage = window.location.pathname.includes('/watch');
        
        console.log('Page change detected. Video page:', isVideoPage);
        
        if (isVideoPage) {
            this.handleVideoPage();
        } else {
            this.handleNonVideoPage();
        }
    }

    handleVideoPage() {
        console.log('On video page, checking if in sequence...');
        
        const currentVideoId = this.getCurrentVideoId();
        console.log('Current video ID:', currentVideoId);
        
        if (!currentVideoId) {
            console.log('Could not get video ID');
            return;
        }
        
        const sequenceIndex = this.videoQueue.findIndex(video => video.id === currentVideoId);
        console.log('Found in sequence at index:', sequenceIndex);
        
        if (sequenceIndex !== -1) {
            this.currentIndex = sequenceIndex;
            this.saveSettings();
            console.log('Updated current index to:', this.currentIndex);
            
            this.setupVideoEndListener();
        }
        
        setTimeout(() => {
            this.injectControls();
        }, 1000);
    }

    handleNonVideoPage() {
        console.log('On non-video page (channel/home)');
        setTimeout(() => {
            this.injectControls();
        }, 1000);
    }

    setupVideoEndListener() {
        if (this.videoEndListener) {
            const video = document.querySelector('video');
            if (video) {
                video.removeEventListener('ended', this.videoEndListener);
            }
        }
        
        const checkInterval = setInterval(() => {
            const video = document.querySelector('video');
            if (video) {
                console.log('Video element found, setting up end listener');
                
                this.videoEndListener = () => {
                    console.log('Video ended! Auto-play:', this.autoPlay, 'Queue length:', this.videoQueue.length);
                    
                    if (this.autoPlay && this.videoQueue.length > 0) {
                        let nextIndex = this.currentIndex + 1;
                        if (nextIndex >= this.videoQueue.length) {
                            nextIndex = 0;
                        }
                        
                        console.log('Playing next video at index:', nextIndex);
                        
                        setTimeout(() => {
                            this.playVideoAtIndex(nextIndex);
                        }, 1000);
                    }
                };
                
                video.addEventListener('ended', this.videoEndListener);
                clearInterval(checkInterval);
            }
        }, 500);
        
        setTimeout(() => clearInterval(checkInterval), 5000);
    }

    playVideoAtIndex(index) {
        if (index >= 0 && index < this.videoQueue.length) {
            this.currentIndex = index;
            this.saveSettings();
            
            const video = this.videoQueue[index];
            console.log('Navigating to video:', video);
            
            window.location.href = video.url;
        }
    }

    injectControls() {
        this.removeExistingControls();
        
        const isVideoPage = window.location.pathname.includes('/watch');
        
        if (isVideoPage) {
            this.injectVideoControls();
        } else {
            this.injectChannelControls();
        }
    }

    removeExistingControls() {
        const existingControls = document.getElementById('youtube-sequencer-controls');
        if (existingControls) {
            existingControls.remove();
        }
    }

    injectChannelControls() {
        console.log('Injecting channel controls...');
        
        const container = this.findChannelContainer();
        if (!container) {
            console.log('No container found, will retry');
            setTimeout(() => this.injectChannelControls(), 1000);
            return;
        }

        const currentVideoId = this.getCurrentVideoId();
        const isInSequence = this.videoQueue.some(video => video.id === currentVideoId);
        const currentIndex = isInSequence ? this.videoQueue.findIndex(v => v.id === currentVideoId) : -1;

        const controls = document.createElement('div');
        controls.id = 'youtube-sequencer-controls';
        controls.className = 'youtube-sequencer-controls';
        controls.innerHTML = `
            <div class="sequencer-header">
                <h3>🎬 YouTube Sequence Player</h3>
                <div class="header-buttons">
                    <button id="toggle-auto" class="btn ${this.autoPlay ? 'active' : ''}">
                        ${this.autoPlay ? '🔁 Auto' : '⏸️ Auto'}
                    </button>
                    <button id="clear-sequence" class="btn clear-btn">Clear</button>
                </div>
            </div>
            
            <div class="sequence-status">
                <div class="status-info">
                    <span class="status-label">Sequence:</span>
                    <span class="status-value">${this.videoQueue.length} videos</span>
                </div>
                ${this.videoQueue.length > 0 ? `
                <div class="status-info">
                    <span class="status-label">Current:</span>
                    <span class="status-value">${this.currentIndex + 1} of ${this.videoQueue.length}</span>
                </div>
                ` : ''}
            </div>
            
            <div class="sequence-controls">
                ${this.videoQueue.length > 0 ? `
                <button id="play-sequence" class="btn play-btn">
                    ▶ Play Sequence
                </button>
                <button id="play-next" class="btn small-btn" ${this.currentIndex >= this.videoQueue.length - 1 ? 'disabled' : ''}>
                    Next
                </button>
                ` : `
                <div class="empty-message">
                    No sequence yet. Select videos below and click "Add to Sequence".
                </div>
                `}
            </div>
            
            ${this.videoQueue.length > 0 ? `
            <div class="sequence-preview">
                <div class="preview-header">Your Sequence:</div>
                <div class="preview-list">
                    ${this.renderSequencePreview()}
                </div>
            </div>
            ` : ''}
            
            <div class="video-selection">
                <div class="selection-header">
                    <span>Select Videos:</span>
                    <div class="selection-buttons">
                        <button id="select-all" class="btn small-btn">Select All</button>
                        <button id="add-selected" class="btn add-btn small-btn">Add to Sequence</button>
                    </div>
                </div>
                <div class="selection-hint">
                    Click checkboxes on videos below, then click "Add to Sequence"
                </div>
            </div>
        `;

        container.insertBefore(controls, container.firstChild);
        this.attachChannelEventListeners();
        this.addCheckboxesToVideos();
    }

    injectVideoControls() {
        console.log('Injecting video controls...');
        
        const container = document.querySelector('#primary-inner') || 
                         document.querySelector('#primary') ||
                         document.querySelector('ytd-watch-flexy') ||
                         document.body;
        
        if (!container) {
            console.log('Video container not found');
            return;
        }

        const currentVideoId = this.getCurrentVideoId();
        const isInSequence = this.videoQueue.some(video => video.id === currentVideoId);
        const sequenceIndex = isInSequence ? this.videoQueue.findIndex(v => v.id === currentVideoId) : -1;
        
        const hasNextVideo = isInSequence && sequenceIndex < this.videoQueue.length - 1;
        const nextVideoIndex = hasNextVideo ? sequenceIndex + 1 : 0;

        const controls = document.createElement('div');
        controls.id = 'youtube-sequencer-controls';
        controls.className = 'youtube-sequencer-controls video-controls';
        controls.innerHTML = `
            <div class="sequencer-header">
                <h3>🎬 Playing Sequence</h3>
                <div class="header-buttons">
                    <button id="toggle-auto" class="btn ${this.autoPlay ? 'active' : ''}">
                        ${this.autoPlay ? '🔁 Auto ON' : '⏸️ Auto OFF'}
                    </button>
                    <button id="add-this-video" class="btn add-btn">+ Add This</button>
                </div>
            </div>
            
            <div class="video-progress">
                ${isInSequence ? `
                <div class="progress-info">
                    <div class="progress-text">
                        <span class="current-pos">Video ${sequenceIndex + 1} of ${this.videoQueue.length}</span>
                        <span class="remaining">(${this.videoQueue.length - sequenceIndex - 1} remaining)</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${((sequenceIndex + 1) / this.videoQueue.length) * 100}%"></div>
                    </div>
                </div>
                ` : `
                <div class="progress-text not-in-sequence">
                    This video is not in your sequence
                </div>
                `}
            </div>
            
            <div class="video-navigation">
                <button id="prev-video" class="btn nav-btn prev-btn" ${sequenceIndex <= 0 ? 'disabled' : ''}>
                    <span class="nav-icon">◀</span>
                    <span class="nav-text">Previous</span>
                </button>
                
                <button id="skip-video" class="btn skip-btn" title="Skip to next video">
                    <span class="skip-icon">⏭️</span>
                    <span class="skip-text">Skip</span>
                </button>
                
                <button id="next-video" class="btn nav-btn next-btn" ${!hasNextVideo ? 'disabled' : ''}>
                    <span class="nav-text">Next</span>
                    <span class="nav-icon">▶</span>
                </button>
            </div>
            
            ${hasNextVideo ? `
            <div class="next-preview">
                <div class="preview-header">Next Up:</div>
                <div class="preview-item">
                    <span class="preview-number">${nextVideoIndex + 1}.</span>
                    <span class="preview-title" title="${this.videoQueue[nextVideoIndex].title}">
                        ${this.truncateText(this.videoQueue[nextVideoIndex].title, 40)}
                    </span>
                </div>
            </div>
            ` : isInSequence ? `
            <div class="sequence-end">
                <div class="end-message">🎉 Last video in sequence!</div>
                <button id="restart-sequence" class="btn restart-btn">Restart Sequence</button>
            </div>
            ` : ''}
            
            <div class="quick-actions">
                <button id="view-sequence" class="btn small-btn">📋 View Sequence</button>
                <button id="remove-from-sequence" class="btn small-btn remove-btn" ${!isInSequence ? 'disabled' : ''}>
                    Remove from Sequence
                </button>
            </div>
        `;

        container.insertBefore(controls, container.firstChild);
        this.attachVideoEventListeners();
    }

    findChannelContainer() {
        const selectors = [
            '#contents',
            '#primary',
            '#page-manager',
            'ytd-browse'
        ];
        
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                return element;
            }
        }
        
        return document.body;
    }

    addCheckboxesToVideos() {
        setTimeout(() => {
            const videoElements = document.querySelectorAll('ytd-rich-grid-media, ytd-grid-video-renderer');
            console.log(`Found ${videoElements.length} video elements`);
            
            videoElements.forEach((element, index) => {
                if (element.querySelector('.seq-checkbox-container')) return;
                
                const link = element.querySelector('a#thumbnail, a#video-title-link');
                const titleElement = element.querySelector('#video-title');
                
                if (!link || !titleElement) return;
                
                const href = link.href;
                const videoId = this.extractVideoId(href);
                const title = titleElement.textContent.trim();
                
                if (!videoId) return;
                
                const isInSequence = this.videoQueue.some(video => video.id === videoId);
                
                const container = document.createElement('div');
                container.className = 'seq-checkbox-container';
                container.innerHTML = `
                    <input type="checkbox" 
                           class="seq-checkbox" 
                           id="seq-${videoId}"
                           data-video-id="${videoId}"
                           data-title="${title.replace(/"/g, '&quot;')}"
                           ${isInSequence ? 'checked' : ''}>
                    <label for="seq-${videoId}" class="seq-checkbox-label"></label>
                `;
                
                const thumbnail = element.querySelector('ytd-thumbnail, #thumbnail');
                if (thumbnail) {
                    thumbnail.style.position = 'relative';
                    thumbnail.appendChild(container);
                }
            });
            
            this.attachCheckboxListeners();
            
        }, 1500);
    }

    extractVideoId(url) {
        if (!url) return '';
        try {
            const urlObj = new URL(url);
            return urlObj.searchParams.get('v') || url.split('v=')[1]?.split('&')[0] || '';
        } catch (e) {
            return '';
        }
    }

    renderSequencePreview() {
        return this.videoQueue.map((video, index) => {
            const isCurrent = index === this.currentIndex;
            return `
                <div class="preview-item ${isCurrent ? 'current' : ''}" data-index="${index}">
                    <span class="preview-number">${index + 1}.</span>
                    <span class="preview-title" title="${video.title}">${this.truncateText(video.title, 30)}</span>
                    ${isCurrent ? '<span class="current-badge">▶</span>' : ''}
                    <button class="remove-btn" data-index="${index}" title="Remove">×</button>
                </div>
            `;
        }).join('');
    }

    attachChannelEventListeners() {
        document.getElementById('play-sequence')?.addEventListener('click', () => {
            if (this.videoQueue.length > 0) {
                this.playSequence();
            }
        });

        document.getElementById('play-next')?.addEventListener('click', () => {
            if (this.currentIndex < this.videoQueue.length - 1) {
                this.playVideoAtIndex(this.currentIndex + 1);
            }
        });

        document.getElementById('toggle-auto')?.addEventListener('click', () => {
            this.autoPlay = !this.autoPlay;
            this.saveSettings();
            this.updateAutoButton();
        });

        document.getElementById('clear-sequence')?.addEventListener('click', () => {
            if (confirm('Clear the entire sequence?')) {
                this.videoQueue = [];
                this.currentIndex = 0;
                this.saveSettings();
                this.injectControls();
            }
        });

        document.getElementById('select-all')?.addEventListener('click', () => {
            document.querySelectorAll('.seq-checkbox').forEach(cb => cb.checked = true);
        });

        document.getElementById('add-selected')?.addEventListener('click', () => {
            this.addSelectedVideos();
        });

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-btn')) {
                const index = parseInt(e.target.dataset.index);
                this.removeFromSequence(index);
            }
        });
    }

    attachVideoEventListeners() {
        document.getElementById('toggle-auto')?.addEventListener('click', () => {
            this.autoPlay = !this.autoPlay;
            this.saveSettings();
            this.updateAutoButton();
        });

        document.getElementById('add-this-video')?.addEventListener('click', () => {
            this.addCurrentVideo();
        });

        document.getElementById('prev-video')?.addEventListener('click', () => {
            const currentId = this.getCurrentVideoId();
            const index = this.videoQueue.findIndex(v => v.id === currentId);
            if (index > 0) {
                this.playVideoAtIndex(index - 1);
            }
        });

        document.getElementById('next-video')?.addEventListener('click', () => {
            this.playNextVideo();
        });

        document.getElementById('skip-video')?.addEventListener('click', () => {
            this.skipCurrentVideo();
        });

        document.getElementById('restart-sequence')?.addEventListener('click', () => {
            this.restartSequence();
        });

        document.getElementById('view-sequence')?.addEventListener('click', () => {
            window.location.href = 'https://www.youtube.com';
        });

        document.getElementById('remove-from-sequence')?.addEventListener('click', () => {
            this.removeCurrentVideoFromSequence();
        });
    }

    attachCheckboxListeners() {
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('seq-checkbox')) {
                const label = e.target.nextElementSibling;
                if (e.target.checked) {
                    label.classList.add('checked');
                } else {
                    label.classList.remove('checked');
                }
            }
        });
    }

    addSelectedVideos() {
        const checkboxes = document.querySelectorAll('.seq-checkbox:checked');
        let added = 0;
        
        checkboxes.forEach(checkbox => {
            const videoId = checkbox.dataset.videoId;
            const title = checkbox.dataset.title;
            
            const exists = this.videoQueue.some(video => video.id === videoId);
            
            if (!exists) {
                this.videoQueue.push({
                    id: videoId,
                    title: title,
                    url: `https://www.youtube.com/watch?v=${videoId}`
                });
                added++;
            }
        });
        
        if (added > 0) {
            this.saveSettings();
            alert(`Added ${added} video${added === 1 ? '' : 's'} to sequence!`);
            this.injectControls();
        } else {
            alert('No new videos selected or all selected videos are already in sequence.');
        }
    }

    addCurrentVideo() {
        const videoId = this.getCurrentVideoId();
        const title = this.getCurrentVideoTitle();
        
        if (videoId && title) {
            const exists = this.videoQueue.some(video => video.id === videoId);
            
            if (!exists) {
                this.videoQueue.push({
                    id: videoId,
                    title: title,
                    url: window.location.href
                });
                this.saveSettings();
                alert(`"${this.truncateText(title, 50)}" added to sequence!`);
                this.injectControls();
            } else {
                alert('This video is already in your sequence!');
            }
        }
    }

    removeFromSequence(index) {
        if (index >= 0 && index < this.videoQueue.length) {
            this.videoQueue.splice(index, 1);
            
            if (this.currentIndex >= index) {
                this.currentIndex = Math.max(0, this.currentIndex - 1);
            }
            
            this.saveSettings();
            this.injectControls();
        }
    }

    skipCurrentVideo() {
        const currentVideoId = this.getCurrentVideoId();
        const currentIndex = this.videoQueue.findIndex(v => v.id === currentVideoId);
        
        if (currentIndex !== -1 && currentIndex < this.videoQueue.length - 1) {
            this.playVideoAtIndex(currentIndex + 1);
        } else if (currentIndex === this.videoQueue.length - 1) {
            this.restartSequence();
        } else {
            alert('This video is not in your sequence or no next video available.');
        }
    }

    playNextVideo() {
        const currentVideoId = this.getCurrentVideoId();
        const currentIndex = this.videoQueue.findIndex(v => v.id === currentVideoId);
        
        if (currentIndex !== -1 && currentIndex < this.videoQueue.length - 1) {
            this.playVideoAtIndex(currentIndex + 1);
        } else if (currentIndex === this.videoQueue.length - 1) {
            if (confirm('You\'ve reached the end of the sequence. Restart from the beginning?')) {
                this.restartSequence();
            }
        } else {
            alert('This video is not in your sequence.');
        }
    }

    restartSequence() {
        if (this.videoQueue.length > 0) {
            this.currentIndex = 0;
            this.saveSettings();
            this.playVideoAtIndex(0);
        }
    }

    removeCurrentVideoFromSequence() {
        const currentVideoId = this.getCurrentVideoId();
        const currentIndex = this.videoQueue.findIndex(v => v.id === currentVideoId);
        
        if (currentIndex !== -1) {
            if (confirm(`Remove "${this.truncateText(this.videoQueue[currentIndex].title, 50)}" from sequence?`)) {
                this.videoQueue.splice(currentIndex, 1);
                
                if (this.currentIndex >= currentIndex) {
                    this.currentIndex = Math.max(0, this.currentIndex - 1);
                }
                
                this.saveSettings();
                
                setTimeout(() => {
                    this.injectControls();
                }, 500);
            }
        } else {
            alert('This video is not in your sequence.');
        }
    }

    playSequence() {
        if (this.videoQueue.length === 0) {
            alert('No videos in sequence!');
            return;
        }
        
        console.log('Starting sequence from beginning');
        this.currentIndex = 0;
        this.saveSettings();
        
        const firstVideo = this.videoQueue[0];
        window.location.href = firstVideo.url;
    }

    getCurrentVideoId() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('v');
    }

    getCurrentVideoTitle() {
        const titleElement = document.querySelector('h1.title, yt-formatted-string.style-scope.ytd-watch-metadata');
        return titleElement ? titleElement.textContent.trim() : 'Unknown Video';
    }

    updateAutoButton() {
        const buttons = document.querySelectorAll('#toggle-auto');
        buttons.forEach(button => {
            button.className = `btn ${this.autoPlay ? 'active' : ''}`;
            button.textContent = this.autoPlay ? '🔁 Auto ON' : '⏸️ Auto OFF';
        });
    }

    truncateText(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }
}

let sequencer = null;

function init() {
    sequencer = new YouTubeSequencer();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}