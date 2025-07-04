// public/app.js
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element Cache ---
    const headerEl = document.querySelector('header');
    const timeSlider = document.getElementById('time-slider');
    const timestampDisplay = document.getElementById('timestamp-display');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const playIcon = playPauseBtn.querySelector('i');
    const speedControl = document.getElementById('speed-control');
    const attackStatusEl = document.getElementById('attack-status');
    const attackIdEl = document.getElementById('attack-id');
    const attackDetailsEl = document.getElementById('attack-details');
    const attackInfoWrapper = document.getElementById('attack-info-wrapper');
    const manualTimeInput = document.getElementById('manual-time-input');
    const jumpToTimeBtn = document.getElementById('jump-to-time-btn');
    const dashboardContainer = document.querySelector('.dashboard-container');
    const attackListEl = document.getElementById('attack-list');
    const rewindBtn = document.getElementById('rewind-btn');
    const forwardBtn = document.getElementById('forward-btn');
    const fillCurrentTimeBtn = document.getElementById('fill-current-time-btn');
    
    // Collapsible Header Elements
    const headerToggleBtn = document.getElementById('header-toggle-btn');
    const headerCollapsibleContent = document.getElementById('header-collapsible-content');
    const headerCollapsedView = document.getElementById('header-collapsed-view');
    const collapsedTimestampEl = document.getElementById('collapsed-timestamp');
    const collapsedAttackStatusEl = document.getElementById('collapsed-attack-status');

    // Modal elements
    const filterModal = document.getElementById('filter-modal');
    const openFilterBtn = document.getElementById('filter-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const applyFilterBtn = document.getElementById('filter-apply-btn');
    const selectAllBtn = document.getElementById('filter-select-all-btn');
    const deselectAllBtn = document.getElementById('filter-deselect-all-btn');

    // Chart Modal elements
    const chartModal = document.getElementById('chart-modal');
    const chartModalTitle = document.getElementById('chart-modal-title');
    const closeChartModalBtn = document.getElementById('close-chart-modal-btn');
    const historyChartCanvas = document.getElementById('history-chart');
    const chartControls = document.querySelector('.chart-controls');
    
    // --- State Variables ---
    let timer = null;
    let isPlaying = false;
    let totalRecords = 0;
    let historyChart = null; // To hold the Chart.js instance
    let currentChartDeviceId = null;
    let currentJsTimestamp = null; // Store the JS timestamp of the currently displayed record

    // --- Configuration with FULL Tooltips ---
    const deviceConfig = {
        p1: { name: "P1: 原水供给", devices: { "FIT101": "流量计，测量进入原水箱的流量。", "LIT101": "液位变送器，测量原水箱水位。", "MV101": "电动阀，控制水流入原水箱。", "P101": "水泵，将水从原水箱泵送到第二阶段。", "P102": "P101的备用泵。" }},
        p2: { name: "P2: 化学加药", devices: { "AIT201": "电导率分析仪，测量NaCl水平。", "AIT202": "pH分析仪，测量HCl水平。", "AIT203": "ORP分析仪，测量NaOCl水平。", "FIT201": "流量变送器，控制加药泵。", "MV201": "电动阀，控制水流向UF给水箱。", "P201": "NaCl加药泵。", "P202": "P201的备用泵。", "P203": "HCl加药泵。", "P204": "P203的备用泵。", "P205": "NaOCl加药泵。", "P206": "P205的备用泵。" }},
        p3: { name: "P3: 超滤 (UF)", devices: { "DPIT301": "压差变送器，控制反洗过程。", "FIT301": "流量计，测量UF阶段的水流量。", "LIT301": "液位变送器，UF给水箱水位。", "MV301": "电动阀，控制UF反洗过程。", "MV302": "电动阀，控制从UF到脱氯单元的水。", "MV303": "电动阀，控制UF反洗排水。", "MV304": "电动阀，控制UF排水。", "P301": "P302的备用泵。", "P302": "UF给水泵，泵水通过UF过滤。" }},
        p4: { name: "P4: 紫外线脱氯", devices: { "AIT401": "RO水硬度计。", "AIT402": "ORP计，控制NaHSO3和NaOCl加药。", "FIT401": "流量变送器，控制UV脱氯器。", "LIT401": "液位变送器，RO给水箱水位。", "P401": "P402的备用泵。", "P402": "水泵，从RO给水箱泵水到UV脱氯器。", "P403": "亚硫酸氢钠泵。", "P404": "P403的备用泵。", "UV401": "脱氯器，从水中去除氯。" }},
        p5: { name: "P5: 反渗透 (RO)", devices: { "AIT501": "RO pH分析仪，测量HCl水平。", "AIT502": "RO进料ORP分析仪，测量NaOCl水平。", "AIT503": "RO进料电导率分析仪，测量NaCl水平。", "AIT504": "RO渗透水电导率分析仪，测量NaCl水平。", "FIT501": "流量计，RO膜入口流量计。", "FIT502": "流量计，RO渗透水流量计。", "FIT503": "流量计，RO废水流量计。", "FIT504": "流量计，RO再循环流量计。", "P501": "水泵，将脱氯水泵入RO。", "P502": "P501的备用泵。", "PIT501": "压力计，RO进料压力。", "PIT502": "压力计，RO渗透水压力。", "PIT503": "压力计，RO废水压力。" }},
        p6: { name: "P6: 超滤膜反洗", devices: { "FIT601": "流量计，UF反洗流量计。", "P601": "水泵，将水从RO渗透水箱泵至原水箱（未用于数据收集）。", "P602": "水泵，从UF反洗水箱泵水以清洁膜。", "P603": "尚未在SWaT中实施。" }}
    };

    function getDeviceType(id) { return id.match(/^[A-Z]*/)[0]; }
    
    function getDeviceIcon(type) {
        const icons = { P: 'fa-solid fa-circle-chevron-right', MV: 'fa-solid fa-lock-open', UV: 'fa-solid fa-sun', LIT: 'fa-solid fa-ruler-vertical', FIT: 'fa-solid fa-gauge-high', AIT: 'fa-solid fa-flask-vial', DPIT: 'fa-solid fa-arrows-left-right-to-line', PIT: 'fa-solid fa-tachograph-digital', UNKNOWN: 'fa-solid fa-question-circle' };
        return `<i class="device-icon ${icons[type] || icons.UNKNOWN}"></i>`;
    }

    function buildDashboardAndFilters() {
        let dashboardHtml = '';
        let filterHtml = '';
        for (const stageId in deviceConfig) {
            const stage = deviceConfig[stageId];
            const deviceCount = Object.keys(stage.devices).length;
            const layoutClass = deviceCount > 6 ? 'two-columns' : '';
            const flexBasis = deviceCount > 6 ? '240px' : '100px';

            dashboardHtml += `<div class="stage-card" id="card-${stageId}" style="flex-basis: ${flexBasis};"><div class="stage-header"><h2>${stage.name}</h2></div><div class="device-group ${layoutClass}">`;
            filterHtml += `<div class="filter-stage-group" data-stage-id="${stageId}"><h3><label><input type="checkbox" class="stage-filter-checkbox" data-stage="${stageId}" checked> ${stage.name}</label></h3><div class="filter-grid">`;
            
            for (const deviceId in stage.devices) {
                const tooltip = stage.devices[deviceId];
                dashboardHtml += `
                    <div class="device" id="${deviceId}" data-device-id="${deviceId}" data-tooltip="${tooltip}">
                        <div class="device-top-row">
                            ${getDeviceIcon(getDeviceType(deviceId))}
                            <span class="device-id">${deviceId}</span>
                        </div>
                        <div class="device-bottom-row">
                            <span class="device-value" id="value-${deviceId}">_</span>
                            <span class="device-change" id="change-${deviceId}"></span>
                        </div>
                    </div>
                `;
                filterHtml += `<label><input type="checkbox" class="filter-checkbox" data-stage="${stageId}" value="${deviceId}" checked> ${deviceId}</label>`;
            }
            dashboardHtml += `</div></div>`;
            filterHtml += `</div></div>`;
        }
        dashboardContainer.innerHTML = dashboardHtml;
        document.getElementById('filter-options').innerHTML = filterHtml;
    }

    async function initialize() {
        buildDashboardAndFilters();
        addEventListeners();
        try {
            const response = await fetch('/api/data/info');
            const data = await response.json();
            totalRecords = data.totalRecords;
            timeSlider.max = totalRecords - 1;
            await updateDisplay(0, true);
            await loadAndPopulateAttacks();
        } catch (error) {
            console.error("Initialization failed:", error);
            timestampDisplay.textContent = "数据加载错误";
        }
    }
    
    async function loadAndPopulateAttacks() {
        try {
            const response = await fetch('/api/attacks');
            const attacks = await response.json();
            attacks.forEach(attack => {
                const option = document.createElement('option');
                option.value = attack.startTime;
                const displayText = `${attack.id}: ${attack.description}`;
                option.textContent = displayText.length > 30 ? displayText.substring(0, 27) + '...' : displayText;
                option.title = attack.description;
                attackListEl.appendChild(option);
            });
        } catch (error) {
            console.error("Failed to load attacks:", error);
            const option = document.createElement('option');
            option.textContent = '无法加载攻击列表';
            option.disabled = true;
            attackListEl.appendChild(option);
        }
    }


    async function updateDisplay(index, forceNoDiff = false) {
        index = parseInt(index, 10);
        if (isNaN(index) || index < 0 || !totalRecords || index >= totalRecords) return;
        try {
            const response = await fetch(`/api/data/by-index/${index}`);
            const { timestampData, prevTimestampData, attackInfo } = await response.json();
            if (!timestampData) return;

            timeSlider.value = index;
            currentJsTimestamp = timestampData.jsTimestamp;

            const date = new Date(currentJsTimestamp);
            const day = String(date.getUTCDate()).padStart(2, '0');
            const month = String(date.getUTCMonth() + 1).padStart(2, '0');
            const year = date.getUTCFullYear();
            const hours = String(date.getUTCHours()).padStart(2, '0');
            const minutes = String(date.getUTCMinutes()).padStart(2, '0');
            const seconds = String(date.getUTCSeconds()).padStart(2, '0');
            
            const displayTime = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
            timestampDisplay.textContent = displayTime;
            collapsedTimestampEl.textContent = `时间: ${displayTime}`;
            
            const prevData = forceNoDiff ? null : prevTimestampData;

            document.querySelectorAll('.device').forEach(deviceEl => {
                const key = deviceEl.dataset.deviceId;
                const valueEl = deviceEl.querySelector('.device-value');
                const changeEl = deviceEl.querySelector('.device-change');
                if (valueEl && timestampData[key] !== undefined) {
                    const currentValue = parseFloat(timestampData[key]);
                    valueEl.textContent = Number.isInteger(currentValue) ? currentValue : currentValue.toFixed(2);
                    changeEl.textContent = '';
                    changeEl.className = 'device-change';
                    if (prevData && prevData[key] !== undefined) {
                        const diff = currentValue - parseFloat(prevData[key]);
                        if (Math.abs(diff) > 1e-6) {
                            const dir = diff > 0 ? 'up' : 'down';
                            changeEl.className = `device-change ${dir}`;
                            changeEl.textContent = `${dir === 'up' ? '▲' : '▼'}${Math.abs(diff).toFixed(2)}`;
                        }
                    }
                    deviceEl.classList.remove('on', 'off');
                    if (['P', 'MV', 'UV'].includes(getDeviceType(key))) {
                        if (currentValue === 2) deviceEl.classList.add('on');
                        if (currentValue === 1) deviceEl.classList.add('off');
                    }
                }
            });
            
            document.querySelectorAll('.device.attack-target').forEach(el => el.classList.remove('attack-target'));
            attackInfoWrapper.classList.add('hidden');
            if (attackInfo.isActive) {
                attackStatusEl.textContent = '受攻击';
                attackStatusEl.classList.add('attack');
                attackIdEl.textContent = attackInfo.attackId;
                attackDetailsEl.textContent = attackInfo.description;
                attackInfoWrapper.classList.remove('hidden');
                collapsedAttackStatusEl.innerHTML = `状态: <span class="attack">受攻击 (ID: ${attackInfo.attackId})</span>`;
                attackInfo.targets.forEach(targetId => {
                    const targetEl = document.getElementById(targetId);
                    if (targetEl) targetEl.classList.add('attack-target');
                });
            } else {
                attackStatusEl.textContent = '正常';
                attackStatusEl.classList.remove('attack');
                collapsedAttackStatusEl.innerHTML = '状态: 正常';
            }
        } catch (error) { console.error(`Failed to update display for index ${index}:`, error); }
    }
    
    async function fetchAndDisplayHistory(deviceId, seconds) {
        currentChartDeviceId = deviceId;
        chartModalTitle.textContent = `${deviceId} - 历史数据`;
        
        try {
            const endIndex = timeSlider.value;
            const response = await fetch(`/api/data/history?deviceId=${deviceId}&endIndex=${endIndex}&seconds=${seconds}`);
            const data = await response.json();
            renderHistoryChart(data);
        } catch (error) {
            console.error('Failed to fetch history:', error);
        }
    }
    
    function renderHistoryChart(data) {
        if (historyChart) {
            historyChart.destroy();
        }

        if (!data || data.length === 0) {
            const ctx = historyChartCanvas.getContext('2d');
            ctx.clearRect(0, 0, historyChartCanvas.width, historyChartCanvas.height);
            ctx.textAlign = 'center';
            ctx.fillText('No data available for this period.', historyChartCanvas.width / 2, historyChartCanvas.height / 2);
            return;
        }

        const chartDataPoints = data.map(d => ({
            x: d.jsTimestamp,
            y: d.value
        }));
        
        const timeRangeMs = data.length > 1 ? data[data.length - 1].jsTimestamp - data[0].jsTimestamp : 0;
        let unit = 'day';
        
        if (timeRangeMs <= 2 * 60 * 1000) { unit = 'second';
        } else if (timeRangeMs <= 2 * 60 * 60 * 1000) { unit = 'minute';
        } else if (timeRangeMs <= 2 * 24 * 60 * 60 * 1000) { unit = 'hour';
        }

        historyChart = new Chart(historyChartCanvas, {
            type: 'line',
            data: {
                datasets: [{
                    label: currentChartDeviceId,
                    data: chartDataPoints,
                    borderColor: 'rgba(0, 123, 255, 1)',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    borderWidth: 1.5,
                    pointRadius: 0, 
                    pointHoverRadius: 5,
                    tension: 0.1,
                    fill: true,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time',
                        adapters: {
                            date: {
                                zone: 'UTC'
                            }
                        },
                        time: {
                            unit: unit,
                            tooltipFormat: 'dd/MM/yyyy HH:mm:ss',
                             displayFormats: {
                                second: 'HH:mm:ss',
                                minute: 'HH:mm',
                                hour: 'dd/MM HH:mm',
                                day: 'dd/MM/yy',
                            }
                        },
                        ticks: { source: 'auto', maxRotation: 70, minRotation: 70 }
                    },
                    y: { beginAtZero: false, title: { display: true, text: 'Value' } }
                },
                plugins: {
                    tooltip: { mode: 'index', intersect: false },
                    legend: { display: true }
                }
            }
        });
    }

    function jumpBySeconds(seconds) {
        if (isPlaying) togglePlay();
        let newIndex = parseInt(timeSlider.value, 10) + seconds;
        newIndex = Math.max(0, Math.min(totalRecords - 1, newIndex));
        updateDisplay(newIndex, true);
    }

    function addEventListeners() {
        timeSlider.addEventListener('input', (e) => updateDisplay(e.target.value, true));
        playPauseBtn.addEventListener('click', togglePlay);
        speedControl.addEventListener('change', () => { if (isPlaying) { togglePlay(); togglePlay(); } });
        jumpToTimeBtn.addEventListener('click', jumpToTime);

        rewindBtn.addEventListener('click', () => jumpBySeconds(-30));
        forwardBtn.addEventListener('click', () => jumpBySeconds(30));
        fillCurrentTimeBtn.addEventListener('click', () => {
            if (currentJsTimestamp) {
                const date = new Date(currentJsTimestamp);
                const y = date.getUTCFullYear();
                const m = String(date.getUTCMonth() + 1).padStart(2, '0');
                const d = String(date.getUTCDate()).padStart(2, '0');
                const h = String(date.getUTCHours()).padStart(2, '0');
                const min = String(date.getUTCMinutes()).padStart(2, '0');
                const s = String(date.getUTCSeconds()).padStart(2, '0');
                manualTimeInput.value = `${y}-${m}-${d}T${h}:${min}:${s}`;
            }
        });

        attackListEl.addEventListener('change', async () => {
            const selectedTime = attackListEl.value;
            if (!selectedTime) return;

            try {
                const response = await fetch(`/api/data/by-timestamp?time=${encodeURIComponent(selectedTime)}`);
                if (!response.ok) throw new Error((await response.json()).error);
                
                const { index } = await response.json();
                if (isPlaying) togglePlay();
                await updateDisplay(index, true);
                
                attackListEl.selectedIndex = 0;
            } catch(error) {
                alert(`跳转失败: ${error.message}`);
                attackListEl.selectedIndex = 0;
            }
        });

        dashboardContainer.addEventListener('click', (e) => {
            const deviceEl = e.target.closest('.device');
            if (deviceEl) {
                const deviceId = deviceEl.dataset.deviceId;
                chartModal.classList.remove('hidden');
                const defaultSeconds = 60;
                document.querySelectorAll('.range-btn.active').forEach(b => b.classList.remove('active'));
                document.querySelector(`.range-btn[data-seconds="${defaultSeconds}"]`).classList.add('active');
                fetchAndDisplayHistory(deviceId, defaultSeconds);
            }
        });
        
        openFilterBtn.addEventListener('click', () => filterModal.classList.remove('hidden'));
        closeModalBtn.addEventListener('click', () => filterModal.classList.add('hidden'));
        applyFilterBtn.addEventListener('click', applyFilters);
        selectAllBtn.addEventListener('click', () => document.querySelectorAll('.filter-checkbox, .stage-filter-checkbox').forEach(cb => cb.checked = true));
        deselectAllBtn.addEventListener('click', () => document.querySelectorAll('.filter-checkbox, .stage-filter-checkbox').forEach(cb => cb.checked = false));
        document.querySelectorAll('.stage-filter-checkbox').forEach(cb => cb.addEventListener('change', handleStageFilterChange));
        document.querySelectorAll('.filter-checkbox').forEach(cb => cb.addEventListener('change', handleDeviceFilterChange));
        
        closeChartModalBtn.addEventListener('click', () => {
            chartModal.classList.add('hidden');
            if (historyChart) { historyChart.destroy(); }
            currentChartDeviceId = null;
            document.querySelectorAll('.range-btn.active').forEach(b => b.classList.remove('active'));
        });
        chartControls.addEventListener('click', (e) => {
            if (e.target.classList.contains('range-btn')) {
                document.querySelectorAll('.range-btn.active').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                const seconds = e.target.dataset.seconds;
                if (currentChartDeviceId) {
                    fetchAndDisplayHistory(currentChartDeviceId, seconds);
                }
            }
        });
        
        headerToggleBtn.addEventListener('click', () => {
            const isCollapsing = !headerEl.classList.contains('collapsed');
            headerEl.classList.toggle('collapsed');
            headerCollapsibleContent.classList.toggle('hidden', isCollapsing);
            headerCollapsedView.classList.toggle('hidden', !isCollapsing);
            headerToggleBtn.querySelector('i').className = isCollapsing ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
        });
    }

    function togglePlay() { isPlaying = !isPlaying; playIcon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play'; clearTimeout(timer); if (isPlaying) playbackStep(); }
    async function playbackStep() { if (!isPlaying) return; let currentIndex = parseInt(timeSlider.value, 10); if (currentIndex < totalRecords - 1) { await updateDisplay(currentIndex + 1); const speed = parseFloat(speedControl.value); const interval = 1000 / speed; timer = setTimeout(playbackStep, interval); } else { togglePlay(); } }
    
    // BUG FIX: Correctly handle datetime-local input as UTC
    async function jumpToTime() {
        if (!manualTimeInput.value) return;
        
        // The input value is a string like "YYYY-MM-DDTHH:mm:ss".
        // We will treat these components as if they are UTC time.
        const [datePart, timePart] = manualTimeInput.value.split('T');
        if (!datePart || !timePart) {
            alert('无效的时间格式');
            return;
        }
        const [year, month, day] = datePart.split('-');
        
        // Construct the DD/MM/YYYY HH:MM:SS string the backend expects.
        const formattedTime = `${day}/${month}/${year} ${timePart}`;

        try {
            const response = await fetch(`/api/data/by-timestamp?time=${encodeURIComponent(formattedTime)}`);
            if (!response.ok) { throw new Error((await response.json()).error); }
            const { index } = await response.json();
            if (isPlaying) togglePlay();
            await updateDisplay(index, true);
        } catch(error) { alert(`错误: ${error.message}`); }
    }
    
    function applyFilters() {
        const visibleDevices = new Set();
        document.querySelectorAll('.filter-checkbox:checked').forEach(cb => visibleDevices.add(cb.value));
        document.querySelectorAll('.device').forEach(el => {
            el.classList.toggle('hidden', !visibleDevices.has(el.dataset.deviceId));
        });
        filterModal.classList.add('hidden');
    }
    function handleStageFilterChange(e) { const stageId = e.target.dataset.stage; document.querySelectorAll(`.filter-checkbox[data-stage="${stageId}"]`).forEach(cb => cb.checked = e.target.checked); }
    function handleDeviceFilterChange(e) { const stageId = e.target.dataset.stage; const siblings = document.querySelectorAll(`.filter-checkbox[data-stage="${stageId}"]`); const allChecked = Array.from(siblings).every(cb => cb.checked); document.querySelector(`.stage-filter-checkbox[data-stage="${stageId}"]`).checked = allChecked; }

    initialize();
});
