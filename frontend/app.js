// State Variables
let socket = null;
let currentVideoKey = "";
let isPaused = false;
let eventLogs = [];
let chartFlow = null;
let chartDensity = null;
let chartType = null;

// Telemetry sparklines histories
let sparklineHistories = {
    counted: [],
    active: [],
    flow: [],
    fps: []
};

// Charts histories
let chartTimeLabels = [];
let chartFlowData = [];
let chartDensityData = [];
let activeView = "annotated"; // "annotated", "mask", "split"
let totalFrames = 0;
let currentFrame = 0;

// DOM Elements (initialized inside DOMContentLoaded)
let selectVideo, dropzone, fileInput, uploadProgressContainer, uploadProgressBar, uploadProgressLabel;
let btnPlay, btnPause, btnStop, btnExportCsv, btnExportVideo, exportLoader;
let speedSlider, speedValueLabel;
let videoCanvas, canvasCtx, streamPlaceholder, viewToggles;
let statTotalCount, statActiveCount, statFlowRate, statFps;
let liveCounterBadge, liveBadgeCount;
let eventLogContainer, btnClearLogs, searchInput;
let connectionStatusBtn, connectionStatusDot, connectionStatusText;
let loginLoader, appContainer, bootProgressBar, bootPercentage, bootOdometer, bootStatusText, bootLog;
let btnRewind, timelineSlider, timelineTime;

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
    // Select Elements
    selectVideo = document.getElementById("video-select");
    dropzone = document.getElementById("upload-zone");
    fileInput = document.getElementById("file-input");
    uploadProgressContainer = document.getElementById("upload-progress-container");
    uploadProgressBar = document.getElementById("upload-progress-bar");
    uploadProgressLabel = document.getElementById("upload-progress-label");

    btnPlay = document.getElementById("btn-play");
    btnPause = document.getElementById("btn-pause");
    btnStop = document.getElementById("btn-stop");
    btnExportCsv = document.getElementById("btn-export-csv");
    btnExportVideo = document.getElementById("btn-export-video");
    exportLoader = document.getElementById("export-loader");

    speedSlider = document.getElementById("speed-slider");
    speedValueLabel = document.getElementById("speed-value");

    videoCanvas = document.getElementById("video-canvas");
    if (videoCanvas) {
        canvasCtx = videoCanvas.getContext("2d");
    }
    streamPlaceholder = document.getElementById("stream-placeholder");
    viewToggles = document.querySelectorAll(".view-toggles .toggle-btn");

    statTotalCount = document.getElementById("stat-total-count");
    statActiveCount = document.getElementById("stat-active-count");
    statFlowRate = document.getElementById("stat-flow-rate");
    statFps = document.getElementById("stat-fps");

    liveCounterBadge = document.getElementById("live-counter-badge");
    liveBadgeCount = document.getElementById("live-badge-count");

    eventLogContainer = document.getElementById("event-log-container");
    btnClearLogs = document.getElementById("btn-clear-logs");
    searchInput = document.getElementById("search-input");

    connectionStatusBtn = document.getElementById("connection-status-btn");
    connectionStatusDot = document.getElementById("connection-status-dot");
    connectionStatusText = document.getElementById("connection-status-text");

    loginLoader = document.getElementById("login-loader");
    appContainer = document.getElementById("app-container");
    bootProgressBar = document.getElementById("boot-progress-bar");
    bootPercentage = document.getElementById("boot-percentage");
    bootOdometer = document.getElementById("boot-odometer");
    bootStatusText = document.getElementById("boot-status-text");
    bootLog = document.getElementById("boot-log");

    btnRewind = document.getElementById("btn-rewind");
    timelineSlider = document.getElementById("timeline-slider");
    timelineTime = document.getElementById("timeline-time");

    // Try initializing lucide icons immediately
    if (typeof lucide !== "undefined") {
        lucide.createIcons();
    }

    // Launch intro boot loader animation
    runLoginLoader();
});

// 1. Run Vehicle Counting bootloader animation
function runLoginLoader() {
    let progress = 0;
    let odometerVal = 0;
    const duration = 3000; 
    const intervalTime = 50;
    const steps = duration / intervalTime;
    const increment = 100 / steps;

    const bootMessages = [
        { pct: 5, status: "BOOTING COGNITIVE AI ENGINE...", log: "[INFO] Initializing multi-class object tracker..." },
        { pct: 18, status: "LOADING CLASSIFICATION MATRICES...", log: "[SYSTEM] Calibrating shapes for Pedestrians, Cars, Trucks, Buses, and Bikes" },
        { pct: 35, status: "MAPPING SCENE GEOMETRY...", log: "[SYSTEM] Configuring background subtraction kernel & morphological matrices" },
        { pct: 55, status: "CALIBRATING DETECTION ROI...", log: "[OK] Region of Interest scanner active at bottom 60% horizontal grid" },
        { pct: 70, status: "SYNCHRONIZING OBJECT TRAILING...", log: "[OK] Trailing history buffer active (CentroidTracker initialized)" },
        { pct: 85, status: "ESTABLISHING SPEED GRAPH METRICS...", log: "[OK] Real-time sparkline registers online" },
        { pct: 95, status: "COMPILING SYSTEM PORTAL...", log: "[OK] Welcome to Object Detection AI. System ready." }
    ];

    const particleBurst = document.getElementById("particle-burst");

    const interval = setInterval(() => {
        progress += increment;
        if (progress > 100) progress = 100;

        if (bootProgressBar) bootProgressBar.style.width = `${progress}%`;
        if (bootPercentage) bootPercentage.textContent = `${Math.floor(progress)}%`;

        // Simulate counting vehicles during bootloader animation
        if (Math.random() > 0.45 && progress < 96) {
            odometerVal += Math.floor(Math.random() * 3) + 1;
            if (bootOdometer) bootOdometer.textContent = String(odometerVal).padStart(3, '0');
            
            if (particleBurst) {
                particleBurst.classList.add("ping");
                setTimeout(() => particleBurst.classList.remove("ping"), 400);
            }
        }

        // Update logs and messages
        bootMessages.forEach(msg => {
            if (Math.floor(progress) === Math.floor(msg.pct)) {
                if (bootStatusText) bootStatusText.textContent = msg.status;
                if (bootLog) {
                    const logLine = document.createElement("div");
                    logLine.className = "log-line";
                    logLine.innerHTML = `<span style="color: var(--text-dark);">[${new Date().toLocaleTimeString()}]</span> ${msg.log}`;
                    bootLog.appendChild(logLine);
                    bootLog.scrollTop = bootLog.scrollHeight;
                }
            }
        });

        if (progress >= 100) {
            clearInterval(interval);
            setTimeout(() => {
                if (loginLoader) {
                    loginLoader.style.opacity = "0";
                    loginLoader.style.transform = "scale(1.05)";
                }
                
                if (appContainer) {
                    appContainer.style.opacity = "1";
                    appContainer.style.transform = "scale(1)";
                }
                
                setTimeout(() => {
                    if (loginLoader) loginLoader.style.display = "none";
                    
                    // Initialize graphs & hooks
                    initCharts();
                    loadVideoList();
                    setupEventHandlers();
                }, 600);
            }, 400);
        }
    }, intervalTime);
}

// 2. Setup Charts using Chart.js
function initCharts() {
    const flowEl = document.getElementById("flow-chart");
    const densityEl = document.getElementById("density-chart");
    const typeEl = document.getElementById("type-chart");

    if (!flowEl || !densityEl || !typeEl || typeof Chart === 'undefined') {
        console.warn("Chart.js missing or canvas targets not found.");
        return;
    }

    const flowCtx = flowEl.getContext("2d");
    const densityCtx = densityEl.getContext("2d");
    const typeCtx = typeEl.getContext("2d");

    // Create Gradient for Large Flow Area Chart
    const flowGrad = flowCtx.createLinearGradient(0, 0, 0, 200);
    flowGrad.addColorStop(0, "rgba(0, 229, 255, 0.2)");
    flowGrad.addColorStop(1, "rgba(0, 229, 255, 0)");

    // Large Flow Chart (glowing line with filled area gradient)
    chartFlow = new Chart(flowCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                data: [],
                borderColor: "#00e5ff",
                borderWidth: 2,
                backgroundColor: flowGrad,
                fill: true,
                tension: 0.35,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    grid: { color: "rgba(255, 255, 255, 0.03)" },
                    ticks: { color: "#7e87ab", font: { family: "Outfit", size: 10 } }
                },
                y: {
                    grid: { color: "rgba(255, 255, 255, 0.03)" },
                    ticks: { color: "#7e87ab", font: { family: "Outfit", size: 10 } }
                }
            }
        }
    });

    // Mini Density profile chart
    chartDensity = new Chart(densityCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: "rgba(124, 77, 255, 0.5)",
                borderColor: "#7c4dff",
                borderWidth: 1.5,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: "#7e87ab", font: { family: "Outfit", size: 9 } }
                },
                y: {
                    grid: { color: "rgba(255, 255, 255, 0.02)" },
                    ticks: { color: "#7e87ab", font: { family: "Outfit", size: 9 } }
                }
            }
        }
    });

    // Mini Donut Chart
    chartType = new Chart(typeCtx, {
        type: 'doughnut',
        data: {
            labels: ['Cars', 'Trucks', 'Buses', 'Bikes', 'Autos', 'Pedestrians'],
            datasets: [{
                data: [0, 0, 0, 0, 0, 0],
                backgroundColor: [
                    '#0284c7', 
                    '#6d28d9', 
                    '#ea580c', 
                    '#16a34a',  
                    '#eab308',  
                    '#ec4899'  
                ],
                borderWidth: 0,
                hoverOffset: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            cutout: '70%'
        }
    });
}

// 3. Load video files list
async function loadVideoList() {
    try {
        const response = await fetch("/api/videos");
        const videos = await response.json();
        
        if (selectVideo) {
            selectVideo.innerHTML = '<option value="" disabled selected>Choose a video...</option>';
            videos.forEach(video => {
                const option = document.createElement("option");
                option.value = video.path_key;
                const labelType = video.type === "sample" ? "[Sample]" : "[Uploaded]";
                option.textContent = `${labelType} ${video.name} (${video.size_mb} MB)`;
                selectVideo.appendChild(option);
            });
        }
    } catch (e) {
        logToTerminal("Error loading video list from server.", "error");
    }
}

// 4. Setup User Event Handlers
function setupEventHandlers() {
    if (selectVideo) {
        selectVideo.addEventListener("change", (e) => {
            currentVideoKey = e.target.value;
            enableControlButtons(true);
            resetDashboard();
            logToTerminal(`Selected video stream: ${selectVideo.options[selectVideo.selectedIndex].text}`, "system");
        });
    }

    if (connectionStatusBtn) {
        connectionStatusBtn.addEventListener("click", () => {
            if (!currentVideoKey) {
                logToTerminal("Please select a video source first.", "error");
                return;
            }
            if (socket) {
                stopStream();
            } else {
                startStream();
            }
        });
    }

    if (dropzone && fileInput) {
        dropzone.addEventListener("click", () => fileInput.click());
        fileInput.addEventListener("change", (e) => {
            if (e.target.files.length > 0) {
                handleFileUpload(e.target.files[0]);
            }
        });

        dropzone.addEventListener("dragover", (e) => {
            e.preventDefault();
            dropzone.classList.add("dragover");
        });

        dropzone.addEventListener("dragleave", () => {
            dropzone.classList.remove("dragover");
        });

        dropzone.addEventListener("drop", (e) => {
            e.preventDefault();
            dropzone.classList.remove("dragover");
            if (e.dataTransfer.files.length > 0) {
                handleFileUpload(e.dataTransfer.files[0]);
            }
        });
    }

    // Controls
    if (btnPlay) {
        btnPlay.addEventListener("click", () => {
            if (socket && isPaused) {
                socket.send(JSON.stringify({ action: "resume" }));
                isPaused = false;
                btnPlay.disabled = true;
                btnPause.disabled = false;
                logToTerminal("Stream resumed.", "system");
            } else {
                startStream();
            }
        });
    }

    if (btnPause) {
        btnPause.addEventListener("click", () => {
            if (socket && !isPaused) {
                socket.send(JSON.stringify({ action: "pause" }));
                isPaused = true;
                btnPlay.innerHTML = '<i data-lucide="play"></i> Resume';
                if (typeof lucide !== 'undefined') lucide.createIcons();
                btnPlay.disabled = false;
                btnPause.disabled = true;
                logToTerminal("Stream paused.", "system");
            }
        });
    }

    if (btnStop) {
        btnStop.addEventListener("click", () => {
            stopStream();
        });
    }

    if (speedSlider) {
        speedSlider.addEventListener("input", (e) => {
            const val = e.target.value;
            if (speedValueLabel) speedValueLabel.textContent = `${val}x`;
            if (socket) {
                socket.send(JSON.stringify({ action: "speed", value: parseFloat(val) }));
            }
        });
    }

    viewToggles.forEach(btn => {
        btn.addEventListener("click", (e) => {
            viewToggles.forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
            activeView = e.target.getAttribute("data-view");
            logToTerminal(`Viewport view toggled to: ${activeView}`, "system");
        });
    });

    if (btnClearLogs) {
        btnClearLogs.addEventListener("click", () => {
            if (eventLogContainer) eventLogContainer.innerHTML = "";
            eventLogs = [];
            logToTerminal("Logs cleared.", "system");
        });
    }

    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            const query = e.target.value.toLowerCase();
            if (eventLogContainer) {
                const lines = eventLogContainer.querySelectorAll(".terminal-line");
                lines.forEach(line => {
                    const txt = line.textContent.toLowerCase();
                    if (txt.includes(query)) {
                        line.style.display = "block";
                    } else {
                        line.style.display = "none";
                    }
                });
            }
        });
    }

    if (btnExportCsv) {
        btnExportCsv.addEventListener("click", () => {
            exportLogsToCSV();
        });
    }

    if (btnExportVideo) {
        btnExportVideo.addEventListener("click", () => {
            exportProcessedVideo();
        });
    }

    // Timeline Seeking and Rewinding
    if (timelineSlider) {
        timelineSlider.addEventListener("input", (e) => {
            if (!socket || totalFrames <= 0) return;
            const pct = parseFloat(e.target.value);
            const targetFrame = Math.floor((pct / 100) * totalFrames);
            socket.send(JSON.stringify({ action: "seek", value: targetFrame }));
            
            // Render timestamps dynamically on seek for premium feedback
            const fps = 25.0;
            const currentTimeStr = formatTime(targetFrame / fps);
            const totalTimeStr = formatTime(totalFrames / fps);
            if (timelineTime) timelineTime.textContent = `${currentTimeStr} / ${totalTimeStr}`;
        });
    }

    if (btnRewind) {
        btnRewind.addEventListener("click", () => {
            if (!socket || totalFrames <= 0) return;
            const step = 5 * 25; // 5 seconds at 25 fps
            let targetFrame = currentFrame - step;
            if (targetFrame < 0) targetFrame = 0;
            socket.send(JSON.stringify({ action: "seek", value: targetFrame }));
            logToTerminal("Rewound stream 5 seconds.", "system");
        });
    }
}

function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// 5. File Upload Handler
function handleFileUpload(file) {
    if (!file) return;
    
    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload", true);
    if (uploadProgressContainer) uploadProgressContainer.style.display = "block";
    
    xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && uploadProgressBar && uploadProgressLabel) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            uploadProgressBar.style.width = percentComplete + "%";
            uploadProgressLabel.textContent = `Uploading: ${percentComplete}%`;
        }
    };

    xhr.onload = () => {
        if (xhr.status === 200) {
            const res = JSON.parse(xhr.responseText);
            if (uploadProgressLabel) uploadProgressLabel.textContent = "Upload completed successfully!";
            logToTerminal(`Video uploaded: ${file.name}`, "system");
            
            loadVideoList().then(() => {
                if (selectVideo) selectVideo.value = res.path_key;
                currentVideoKey = res.path_key;
                enableControlButtons(true);
                resetDashboard();
            });

            setTimeout(() => {
                if (uploadProgressContainer) uploadProgressContainer.style.display = "none";
                if (uploadProgressBar) uploadProgressBar.style.width = "0%";
            }, 3000);
        } else {
            if (uploadProgressLabel) uploadProgressLabel.textContent = "Upload failed!";
            logToTerminal(`Upload failed with status: ${xhr.status}`, "error");
        }
    };

    xhr.onerror = () => {
        if (uploadProgressLabel) uploadProgressLabel.textContent = "Upload error!";
        logToTerminal("Network error during upload.", "error");
    };

    xhr.send(formData);
}

function enableControlButtons(canPlay) {
    if (btnPlay) btnPlay.disabled = !canPlay;
    if (btnPause) btnPause.disabled = true;
    if (btnStop) btnStop.disabled = true;
}

// Reset stats/charts/sparklines
function resetDashboard() {
    if (statTotalCount) statTotalCount.textContent = "0";
    if (statActiveCount) statActiveCount.textContent = "0";
    if (statFlowRate) statFlowRate.innerHTML = '0 <span class="unit">v/m</span>';
    if (statFps) statFps.innerHTML = '0 <span class="unit">fps</span>';
    
    if (liveBadgeCount) liveBadgeCount.textContent = "0";
    if (liveCounterBadge) liveCounterBadge.style.display = "none";
    
    chartTimeLabels = [];
    chartFlowData = [];
    chartDensityData = [];
    
    if (chartFlow) {
        chartFlow.data.labels = [];
        chartFlow.data.datasets[0].data = [];
        chartFlow.update();
    }

    if (chartDensity) {
        chartDensity.data.labels = [];
        chartDensity.data.datasets[0].data = [];
        chartDensity.update();
    }

    if (chartType) {
        chartType.data.datasets[0].data = [0, 0, 0, 0, 0, 0];
        chartType.update();
    }

    sparklineHistories = { counted: [], active: [], flow: [], fps: [] };
    clearSparkline("sparkline-counted");
    clearSparkline("sparkline-active");
    clearSparkline("sparkline-flow");
    clearSparkline("sparkline-fps");
    
    eventLogs = [];
    
    if (timelineSlider) timelineSlider.value = 0;
    if (timelineTime) timelineTime.textContent = "00:00 / 00:00";
    totalFrames = 0;
    currentFrame = 0;
    
    if (videoCanvas) videoCanvas.style.display = "none";
    if (streamPlaceholder) streamPlaceholder.style.display = "flex";
}

// 6. Connect WebSocket stream
function startStream() {
    if (!currentVideoKey) return;
    
    resetDashboard();
    
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/stream?video_key=${encodeURIComponent(currentVideoKey)}`;
    
    updateConnectionStatus("connecting", "CONNECTING FEED...");
    
    socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
        updateConnectionStatus("connected", "SYSTEM ONLINE • STABLE");
        logToTerminal("WebSocket connection open. Stream started.", "system");
        
        if (btnPlay) btnPlay.disabled = true;
        if (btnPlay) btnPlay.innerHTML = '<i data-lucide="play"></i> Start';
        if (typeof lucide !== 'undefined') lucide.createIcons();
        if (btnPause) btnPause.disabled = false;
        if (btnStop) btnStop.disabled = false;
        if (btnExportCsv) btnExportCsv.disabled = true;
        if (btnExportVideo) btnExportVideo.disabled = true;
        if (liveCounterBadge) liveCounterBadge.style.display = "block";
        
        if (speedSlider) socket.send(JSON.stringify({ action: "speed", value: parseFloat(speedSlider.value) }));
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.error) {
            logToTerminal(`Backend error: ${data.error}`, "error");
            stopStream();
            return;
        }

        updateTelemetry(data);
        drawVideoFrames(data);
    };

    socket.onclose = () => {
        updateConnectionStatus("disconnected", "SYSTEM OFFLINE • DISCONNECTED");
        logToTerminal("WebSocket connection closed.", "system");
        if (btnPlay) btnPlay.disabled = false;
        if (btnPause) btnPause.disabled = true;
        if (btnStop) btnStop.disabled = true;
        if (btnExportCsv) btnExportCsv.disabled = eventLogs.length === 0;
        if (btnExportVideo) btnExportVideo.disabled = false;
        if (liveCounterBadge) liveCounterBadge.style.display = "none";
        socket = null;
    };

    socket.onerror = () => {
        logToTerminal("WebSocket interface encountered an error.", "error");
        updateConnectionStatus("disconnected", "SYSTEM OFFLINE • DISCONNECTED");
    };
}

// Stop the stream
function stopStream() {
    if (socket) {
        socket.send(JSON.stringify({ action: "stop" }));
        socket.close();
        socket = null;
    }
    isPaused = false;
    if (btnPlay) btnPlay.disabled = false;
    if (btnPlay) btnPlay.innerHTML = '<i data-lucide="play"></i> Start';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    if (btnPause) btnPause.disabled = true;
    if (btnStop) btnStop.disabled = true;
    if (btnExportCsv) btnExportCsv.disabled = eventLogs.length === 0;
    if (btnExportVideo) btnExportVideo.disabled = false;
    if (liveCounterBadge) liveCounterBadge.style.display = "none";
}

// 7. Update Telemetry metrics and charts
function updateTelemetry(data) {
    if (statTotalCount) statTotalCount.textContent = data.total_count;
    if (statActiveCount) statActiveCount.textContent = data.active_count;
    if (statFps) statFps.innerHTML = `${data.fps} <span class="unit">fps</span>`;
    
    if (liveBadgeCount) liveBadgeCount.textContent = data.total_count;

    // Update timeline frame tracking
    totalFrames = data.total_frames || 0;
    currentFrame = data.frame_index || 0;

    // Update progress seekbar slider & label
    if (timelineSlider && totalFrames > 0) {
        const pct = (currentFrame / totalFrames) * 100;
        timelineSlider.value = pct;
    }
    if (timelineTime && totalFrames > 0) {
        const fps = 25.0;
        const curSec = currentFrame / fps;
        const totSec = totalFrames / fps;
        timelineTime.textContent = `${formatTime(curSec)} / ${formatTime(totSec)}`;
    }

    // Calculate Flow rate
    let elapsedSeconds = data.frame_index / 25.0; 
    let flowVal = 0;
    if (elapsedSeconds > 0) {
        flowVal = Math.round((data.total_count / (elapsedSeconds / 60.0)));
        if (statFlowRate) statFlowRate.innerHTML = `${flowVal} <span class="unit">v/m</span>`;
    }

    // Process new log entries
    if (data.event_log && data.event_log.length > 0) {
        data.event_log.forEach(evt => {
            if (!eventLogs.find(e => e.id === evt.id)) {
                eventLogs.push(evt);
                logToTerminal(`[CROSSING] ${evt.type} #${evt.id} counted. Speed: ${evt.speed} km/h.`, "event");
            }
        });
    }

    // Update Sparklines (Every 5 frames)
    if (data.frame_index % 5 === 0) {
        updateSparklineHistory("counted", data.total_count);
        updateSparklineHistory("active", data.active_count);
        updateSparklineHistory("flow", flowVal);
        updateSparklineHistory("fps", data.fps);

        drawSparkline("sparkline-counted", sparklineHistories.counted, "#00e5ff");
        drawSparkline("sparkline-active", sparklineHistories.active, "#7c4dff");
        drawSparkline("sparkline-flow", sparklineHistories.flow, "#00e676");
        drawSparkline("sparkline-fps", sparklineHistories.fps, "#ff9100");
    }

    // Update large graphs (Every 4 frames for even faster, more dynamic visual flow!)
    if (data.frame_index % 4 === 0) {
        const label = `${Math.round(data.frame_index / 25.0)}s`;
        
        chartTimeLabels.push(label);
        chartFlowData.push(data.total_count);
        chartDensityData.push(data.active_count);
        
        if (chartTimeLabels.length > 35) {
            chartTimeLabels.shift();
            chartFlowData.shift();
            chartDensityData.shift();
        }
        
        if (chartFlow) {
            chartFlow.data.labels = chartTimeLabels;
            chartFlow.data.datasets[0].data = chartFlowData;
            chartFlow.update('none'); 
        }

        if (chartDensity) {
            chartDensity.data.labels = chartTimeLabels;
            chartDensity.data.datasets[0].data = chartDensityData;
            chartDensity.update('none');
        }

        // Update Vehicle Type Doughnut
        if (chartType && data.vehicle_counts) {
            chartType.data.datasets[0].data = [
                data.vehicle_counts.Car || 0,
                data.vehicle_counts.Truck || 0,
                data.vehicle_counts.Bus || 0,
                data.vehicle_counts.Motorcycle || 0,
                data.vehicle_counts.Auto || 0,
                data.vehicle_counts.Pedestrian || 0
            ];
            chartType.update('none');
        }
    }
}

// Sparklines Rendering Canvas helper
function updateSparklineHistory(key, val) {
    sparklineHistories[key].push(val);
    if (sparklineHistories[key].length > 15) {
        sparklineHistories[key].shift();
    }
}

function drawSparkline(canvasId, data, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    const w = canvas.width = canvas.clientWidth;
    const h = canvas.height = canvas.clientHeight;
    
    ctx.clearRect(0, 0, w, h);
    if (data.length < 2) return;

    const maxVal = Math.max(...data, 1);
    const minVal = Math.min(...data, 0);
    const range = maxVal - minVal;

    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
        const x = (i / (data.length - 1)) * w;
        const y = h - ((data[i] - minVal) / range) * (h - 6) - 3;
        
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    ctx.shadowColor = color;
    ctx.shadowBlur = 4;
    ctx.stroke();
    ctx.shadowBlur = 0;
}

function clearSparkline(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

// 8. Render frames on viewport canvas
function drawVideoFrames(data) {
    if (streamPlaceholder && streamPlaceholder.style.display !== "none") {
        streamPlaceholder.style.display = "none";
        if (videoCanvas) videoCanvas.style.display = "block";
    }

    if (activeView === "annotated") {
        renderB64Image(data.annotated_frame);
    } else if (activeView === "mask") {
        renderB64Image(data.mask_frame);
    } else if (activeView === "split") {
        renderSplitImages(data.annotated_frame, data.mask_frame);
    }
}

function renderB64Image(b64Str) {
    const img = new Image();
    img.onload = () => {
        if (videoCanvas) {
            videoCanvas.width = img.naturalWidth;
            videoCanvas.height = img.naturalHeight;
            canvasCtx.clearRect(0, 0, videoCanvas.width, videoCanvas.height);
            canvasCtx.drawImage(img, 0, 0);
        }
    };
    img.src = `data:image/jpeg;base64,${b64Str}`;
}

function renderSplitImages(annotatedB64, maskB64) {
    let imagesLoaded = 0;
    const imgAnnotated = new Image();
    const imgMask = new Image();

    const checkAndDraw = () => {
        imagesLoaded++;
        if (imagesLoaded === 2 && videoCanvas) {
            const w = imgAnnotated.naturalWidth;
            const h = imgAnnotated.naturalHeight;
            
            videoCanvas.width = w * 2;
            videoCanvas.height = h;
            canvasCtx.clearRect(0, 0, videoCanvas.width, videoCanvas.height);
            
            canvasCtx.drawImage(imgAnnotated, 0, 0, w, h);
            canvasCtx.drawImage(imgMask, w, 0, w, h);

            canvasCtx.beginPath();
            canvasCtx.moveTo(w, 0);
            canvasCtx.lineTo(w, h);
            canvasCtx.strokeStyle = "#7c4dff";
            canvasCtx.lineWidth = 4;
            canvasCtx.stroke();

            canvasCtx.font = "bold 16px Outfit, sans-serif";
            canvasCtx.fillStyle = "#00e5ff";
            canvasCtx.fillText("RGB ANNOTATED STREAM", 20, 30);
            
            canvasCtx.fillStyle = "#ffffff";
            canvasCtx.fillText("CV MASK FOREGROUND", w + 20, 30);
        }
    };

    imgAnnotated.onload = checkAndDraw;
    imgMask.onload = checkAndDraw;

    imgAnnotated.src = `data:image/jpeg;base64,${annotatedB64}`;
    imgMask.src = `data:image/jpeg;base64,${maskB64}`;
}

// Connection State UI updater
function updateConnectionStatus(type, label) {
    if (connectionStatusDot) connectionStatusDot.className = `status-dot ${type}`;
    if (connectionStatusText) connectionStatusText.textContent = label;

    if (connectionStatusBtn) {
        if (type === "connected") {
            connectionStatusBtn.className = "status-indicator-btn online";
        } else if (type === "disconnected") {
            connectionStatusBtn.className = "status-indicator-btn offline";
        } else if (type === "connecting") {
            connectionStatusBtn.className = "status-indicator-btn offline"; 
        }
    }
}

// Log Terminal printer
function logToTerminal(message, type = "info") {
    if (!eventLogContainer) return;
    
    const placeholder = eventLogContainer.querySelector(".placeholder");
    if (placeholder) {
        eventLogContainer.removeChild(placeholder);
    }

    const line = document.createElement("div");
    line.className = `terminal-line ${type}`;
    
    const timestamp = new Date().toLocaleTimeString();
    line.innerHTML = `<span style="color: var(--text-dark); font-size:10px;">[${timestamp}]</span> ${message}`;
    
    eventLogContainer.appendChild(line);
    
    // Auto-scroll to bottom only if search query is empty
    if (searchInput && searchInput.value === "") {
        eventLogContainer.scrollTop = eventLogContainer.scrollHeight;
    }
}

// Exporters
function exportLogsToCSV() {
    if (eventLogs.length === 0) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Vehicle ID,Type,Detection Frame,Timestamp (s),Speed (km/h),ROI Entry Y,ROI Exit Y\n";

    eventLogs.forEach(evt => {
        csvContent += `${evt.id},${evt.type || "Car"},${evt.frame},${evt.timestamp},${evt.speed},${evt.entry_y},${evt.exit_y}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    
    const baseName = selectVideo ? selectVideo.options[selectVideo.selectedIndex].text.replace(/[^a-zA-Z0-9]/g, "_") : "video";
    link.setAttribute("download", `traffic_report_${baseName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    logToTerminal("CSV report downloaded successfully.", "system");
}

async function exportProcessedVideo() {
    if (!currentVideoKey) return;
    
    if (btnExportVideo) btnExportVideo.disabled = true;
    if (exportLoader) exportLoader.style.display = "flex";
    logToTerminal("Starting offline processing of final annotated video on server...", "system");

    try {
        const url = `/api/download_processed?video_key=${encodeURIComponent(currentVideoKey)}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Server returned status: ${response.status}`);
        }

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        
        const originalName = selectVideo ? selectVideo.options[selectVideo.selectedIndex].text.split(" ").slice(1).join(" ").split(" (")[0] : "video";
        link.download = `processed_${originalName || "video"}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);

        logToTerminal("Processed video downloaded successfully.", "system");
    } catch (e) {
        logToTerminal(`Failed to generate final video: ${e.message}`, "error");
    } finally {
        if (exportLoader) exportLoader.style.display = "none";
        if (btnExportVideo) btnExportVideo.disabled = false;
    }
}
