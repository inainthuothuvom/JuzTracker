function fetchHadiyaDetails(dateVal) {
    window.appApi
        .withSuccessHandler(function(res) {
            try {
                displayHadiya(res);
            } catch(e) {
                console.error('displayHadiya error:', e);
                document.getElementById('hadiyaBox').classList.remove('hadiya-loading');
                showSnackbar("Error rendering Hadiya: " + e.message, true);
            }
        })
        .withFailureHandler(function(err) {
            document.getElementById('hadiyaBox').classList.remove('hadiya-loading');
            var msg = (err && err.message) ? err.message : (typeof err === 'string' ? err : 'Unknown error');
            console.error('getHadiyaDetails failed:', err);
            showSnackbar("Error loading Hadiya: " + msg, true);
        })
        .getHadiyaDetails(dateVal);
}

var countdownInterval = null;
var hadiyaBounds = null;
function startHadiyaCountdown(deadlineISO) {
    if (countdownInterval) clearInterval(countdownInterval);
    var dEl = document.getElementById('hadiyaCounterDays');
    var hEl = document.getElementById('hadiyaCounterHms');
    if (!dEl || !hEl) return;
    
    // Handle Date objects or strings
    var target;
    var s = deadlineISO ? String(deadlineISO).trim().replace(' ', 'T') : '';
    if (deadlineISO instanceof Date) {
        target = deadlineISO;
    } else if (deadlineISO) {
        target = new Date(s);
    }
    
    if (!target || isNaN(target.getTime())) {
        dEl.textContent = '--';
        hEl.textContent = '--:--:--';
        return;
    }
    
    function update() {
        var now = new Date();
        var IST_MS = 5.5 * 3600000;
        var nowIST = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + IST_MS);
        var diff = target - nowIST;
        if (diff <= 0) {
            dEl.textContent = '0D';
            hEl.textContent = '00:00:00';
            if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
            return;
        }
        var days = Math.floor(diff / 86400000);
        var hours = Math.floor((diff % 86400000) / 3600000);
        var minutes = Math.floor((diff % 3600000) / 60000);
        var seconds = Math.floor((diff % 60000) / 1000);
        var pad = function(n) { return n < 10 ? '0' + n : '' + n; };
        dEl.textContent = days + 'D';
        hEl.textContent = pad(hours) + ':' + pad(minutes) + ':' + pad(seconds);
    }
    update();
    countdownInterval = setInterval(update, 1000);
}

function openHadiyaEditModal() {
    var cur = currentHadiyaDetails && currentHadiyaDetails.current;
    if (!cur) return;
    document.getElementById('hadiyaEditNominee').innerHTML = cur.en + ' / ' + cur.ta + ' (' + cur.range + ')';
    document.getElementById('hadiyaEditStatus').innerHTML = (cur.status === "Completed" ? '✅ ' : '⏳ ') + cur.status;

    function setDL(id, iso) {
        if (!iso) return;
        var d = new Date(iso);
        if (!isNaN(d.getTime())) {
            var y = d.getFullYear(), mo = String(d.getMonth()+1).padStart(2,'0'), da = String(d.getDate()).padStart(2,'0');
            var h = String(d.getHours()).padStart(2,'0'), mi = String(d.getMinutes()).padStart(2,'0');
            document.getElementById(id).value = y + '-' + mo + '-' + da + 'T' + h + ':' + mi;
        }
    }
    setDL('hadiyaDeadlineInput', cur.deadlineISO);
    setDL('hadiyaNextStartInput', cur.nextStartISO);

    document.getElementById('hadiyaEditModal').style.display = 'flex';
}
function closeHadiyaEditModal() {
    document.getElementById('hadiyaEditModal').style.display = 'none';
}

var hadiyaMenuNavStack = [];

function openHadiyaMenuModal() {
    hadiyaMenuNavStack = [];
    var rangeEl = document.getElementById('hadiyaMenuDateRange');
    if (currentHadiyaDetails && currentHadiyaDetails.current) {
        var cur = currentHadiyaDetails.current;
        var dl = cur.deadlineISO;
        var ns = cur.nextStartISO;
        var fmt = function(iso) {
            if (!iso) return '—';
            var d = new Date(String(iso).trim().replace(' ','T'));
            if (isNaN(d.getTime())) return iso;
            var opts = { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' };
            return d.toLocaleDateString('en-US', opts);
        };
        rangeEl.innerText = fmt(dl) + ' — ' + fmt(ns);
    } else {
        rangeEl.innerText = 'No active Hadiya';
    }
    document.getElementById('hadiyaMenuMain').style.display = 'block';
    document.getElementById('hadiyaMenuSchedule').style.display = 'none';
    document.getElementById('hadiyaMenuStatus').style.display = 'none';
    document.getElementById('hadiyaMenuDetails').style.display = 'none';
    document.getElementById('hadiyaMenuAddNext').style.display = 'none';
    document.getElementById('hadiyaMenuModal').style.display = 'flex';
}
function closeHadiyaMenuModal() {
    document.getElementById('hadiyaMenuModal').style.display = 'none';
}
function openHadiyaMenuView(viewId) {
    var cur = currentHadiyaDetails && currentHadiyaDetails.current;
    if (viewId === 'hadiyaMenuSchedule' && cur) {
        function setDL(id, iso) {
            if (!iso) return;
            var d = new Date(iso);
            if (!isNaN(d.getTime())) {
                var y = d.getFullYear(), mo = String(d.getMonth()+1).padStart(2,'0'), da = String(d.getDate()).padStart(2,'0');
                var h = String(d.getHours()).padStart(2,'0'), mi = String(d.getMinutes()).padStart(2,'0');
                document.getElementById(id).value = y + '-' + mo + '-' + da + 'T' + h + ':' + mi;
            }
        }
        setDL('hadiyaDeadlineInput', cur.deadlineISO);
        setDL('hadiyaNextStartInput', cur.nextStartISO);
    }
    if (viewId === 'hadiyaMenuStatus' && cur) {
        var isCompleted = cur.status === 'Completed';
        document.getElementById('hadiyaStatusCompleteBtn').disabled = isCompleted;
        document.getElementById('hadiyaStatusCompleteBtn').style.opacity = isCompleted ? '0.4' : '1';
        document.getElementById('hadiyaStatusCompleteBtn').style.cursor = isCompleted ? 'not-allowed' : 'pointer';
        document.getElementById('hadiyaStatusProgressBtn').disabled = !isCompleted;
        document.getElementById('hadiyaStatusProgressBtn').style.opacity = !isCompleted ? '0.4' : '1';
        document.getElementById('hadiyaStatusProgressBtn').style.cursor = !isCompleted ? 'not-allowed' : 'pointer';
    }
    document.getElementById('hadiyaMenuMain').style.display = 'none';
    document.getElementById('hadiyaMenuSchedule').style.display = 'none';
    document.getElementById('hadiyaMenuStatus').style.display = 'none';
    document.getElementById('hadiyaMenuDetails').style.display = 'none';
    document.getElementById('hadiyaMenuAddNext').style.display = 'none';
    document.getElementById(viewId).style.display = 'block';
    if (viewId === 'hadiyaMenuDetails') loadHadiyaDetailsList();
    if (viewId === 'hadiyaMenuAddNext') initAddNextHadiya();
    hadiyaMenuNavStack.push('hadiyaMenuMain');
}
function goBackHadiyaMenu() {
    if (hadiyaMenuNavStack.length === 0) {
        closeHadiyaMenuModal();
        return;
    }
    var prev = hadiyaMenuNavStack.pop();
    document.getElementById('hadiyaMenuMain').style.display = 'none';
    document.getElementById('hadiyaMenuSchedule').style.display = 'none';
    document.getElementById('hadiyaMenuStatus').style.display = 'none';
    document.getElementById('hadiyaMenuDetails').style.display = 'none';
    document.getElementById('hadiyaMenuAddNext').style.display = 'none';
    document.getElementById(prev).style.display = 'block';
}
function submitHadiyaEditComplete() {
    closeHadiyaEditModal();
    updateHadiyaStatusUI('Completed');
}
function openHadiyaEditDedication() {
    closeHadiyaEditModal();
    setTimeout(function() { openDedicationModal(); }, 200);
}
function saveHadiyaScheduleTimes() {
    var cur = currentHadiyaDetails && currentHadiyaDetails.current;
    if (!cur || !cur.startDate) { showSnackbar("No Hadiya selected.", true); return; }
    function getDL(id) {
        var v = document.getElementById(id).value;
        if (!v) return '';
        // Treat datetime-local value as IST (UTC+5:30) explicitly
        return v + ':00+05:30';
    }
    var deadlineStr = getDL('hadiyaDeadlineInput');
    var nextStr = getDL('hadiyaNextStartInput');
    if (!deadlineStr || !nextStr) { showSnackbar("Please set both date-time values.", true); return; }
    document.getElementById('hadiyaConfigSaveBtn').disabled = true;
    document.getElementById('hadiyaConfigSaveBtn').innerText = "Saving...";
    window.appApi.withSuccessHandler(function(r) {
        document.getElementById('hadiyaConfigSaveBtn').disabled = false;
        document.getElementById('hadiyaConfigSaveBtn').innerHTML = 'Save Schedule Times<br>நேரத்தை சேமிக்க';
        if (r.success) {
            showSnackbar("Schedule times saved!", false);
            if (cur.startDate) fetchHadiyaDetails(cur.startDate);
        } else {
            showSnackbar("Failed: " + (r.error || 'Error'), true);
        }
    }).updateHadiyaScheduleTimes(cur.startDate, deadlineStr, nextStr);
}

function navigateHadiya(dir) {
    var bounds = hadiyaBounds || currentHadiyaDetails;
    if (bounds && typeof bounds.currentIndex === 'number') {
        var target = bounds.currentIndex + dir;
        if (typeof bounds.firstIndex === 'number' && target < bounds.firstIndex) return;
        if (typeof bounds.lastIndex === 'number' && target > bounds.lastIndex) return;
    }
    var input = document.getElementById('dateInput');
    var val = input.value || new Date().toISOString().slice(0,16);
    var datePart = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
    var timePart = val.match(/T(\d{2}:\d{2})/);
    var d = datePart ? new Date(+datePart[1], +datePart[2]-1, +datePart[3]) : new Date();
    d.setDate(d.getDate() + dir * 7);
    var p = function(n) { return String(n).padStart(2,'0'); };
    var t = timePart ? timePart[1] : '00:00';
    var newVal = d.getFullYear() + '-' + p(d.getMonth()+1) + '-' + p(d.getDate()) + 'T' + t;
    newVal = clampDateToHadiyaBounds(newVal);
    if (input.value === newVal) return;
    input.value = newVal;
    input.dispatchEvent(new Event('change'));
}

function goToCurrentWeek() {
    var input = document.getElementById('dateInput');
    var oldVal = input.value || '';
    var timePart = oldVal.match(/T(\d{2}:\d{2})/);
    var now = new Date();
    var IST_MS = 5.5 * 3600000;
    var ist = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + IST_MS);
    var p = function(n) { return String(n).padStart(2,'0'); };
    var t = timePart ? timePart[1] : p(ist.getHours()) + ':' + p(ist.getMinutes());
    var val = ist.getFullYear() + '-' + p(ist.getMonth()+1) + '-' + p(ist.getDate()) + 'T' + t;
    input.value = clampDateToHadiyaBounds(val);
    input.dispatchEvent(new Event('change'));
}

function hideHadiya() {
    document.getElementById('hadiyaBox').style.display = "none";
    var shareBtn = document.getElementById('hadiyaShareBtn');
    if (shareBtn) { shareBtn.style.display = 'none'; }
}

function hadiyaDateOnly(val) {
    if (!val) return '';
    var m = String(val).match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
}
function hadiyaEndDateOnly(startVal) {
    var s = hadiyaDateOnly(startVal);
    if (!s) return '';
    var p = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!p) return s;
    var d = new Date(+p[1], +p[2]-1, +p[3]);
    d.setDate(d.getDate() + 6);
    var pad = function(n){ return String(n).padStart(2,'0'); };
    return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
}
function applyHadiyaDateBounds() {
    var input = document.getElementById('dateInput');
    if (!input || !hadiyaBounds) return;
    var first = hadiyaDateOnly(hadiyaBounds.firstStartDate);
    var lastEnd = hadiyaEndDateOnly(hadiyaBounds.lastStartDate);
    if (first) input.min = first + 'T00:00'; else input.removeAttribute('min');
    if (lastEnd) input.max = lastEnd + 'T23:59'; else input.removeAttribute('max');
    var clamped = clampDateToHadiyaBounds(input.value);
    if (clamped !== input.value) input.value = clamped;
}
function clampDateToHadiyaBounds(val) {
    if (!hadiyaBounds) return val;
    var first = hadiyaDateOnly(hadiyaBounds.firstStartDate);
    var lastEnd = hadiyaEndDateOnly(hadiyaBounds.lastStartDate);
    if (!first && !lastEnd) return val;
    var m = String(val || '').match(/^(\d{4}-\d{2}-\d{2})/);
    if (!m) return val;
    var d = m[1];
    var t = (String(val).match(/T(\d{2}:\d{2})/) || [,'00:00'])[1];
    if (first && d < first) { d = first; t = '00:00'; }
    if (lastEnd && d > lastEnd) { d = lastEnd; t = '23:59'; }
    return d + 'T' + t;
}

function displayHadiya(res) {
    var hadiyaBox = document.getElementById('hadiyaBox');
    hadiyaBox.classList.remove('hadiya-loading');
    hadiyaBox.classList.remove('current-week', 'past-week', 'past-week-completed', 'future-week');
    
    if (!res || !res.current) {
        hideHadiya();
        currentHadiyaDetails = null;
        return;
    }
    hadiyaBox.style.display = "block";
    currentHadiyaDetails = res;
    hadiyaBounds = {
        firstIndex: res.firstIndex,
        lastIndex: res.lastIndex,
        currentIndex: res.currentIndex,
        firstStartDate: res.firstStartDate,
        lastStartDate: res.lastStartDate
    };
    applyHadiyaDateBounds();
    
    var cur = res.current;
    var isCompleted = cur.status === "Completed";
    var isCurrentWeek = res.currentIndex === res.todayIndex;

    var titleEl = hadiyaBox.querySelector('.hadiya-title');
    if (titleEl) {
        if (isCurrentWeek) {
            titleEl.innerHTML = "This Week's Hadiya <br> இந்த வார ஹதியா";
            titleEl.style.display = '';
        } else {
            var label = res.currentIndex < res.todayIndex
                ? 'Previous Hadiya<br>கடந்த ஹதியா'
                : 'Upcoming Hadiya<br>வரவிருக்கும் ஹதியா';
            titleEl.innerHTML = label;
            titleEl.style.position = '';
        }
    }
    
    // Apply color class
    var accentColor = '#58a6ff';
    if (isCurrentWeek) {
        hadiyaBox.classList.add('current-week');
        accentColor = '#58a6ff';
    } else if (cur.weekEndDate && new Date(cur.weekEndDate) < new Date()) {
        hadiyaBox.classList.add(isCompleted ? 'past-week-completed' : 'past-week');
        accentColor = isCompleted ? '#3fb950' : '#8b949e';
    } else {
        hadiyaBox.classList.add('future-week');
        accentColor = '#d29922';
    }

    var canPrev = (typeof res.firstIndex === 'number' && typeof res.currentIndex === 'number') ? (res.currentIndex > res.firstIndex) : true;
    var canNext = (typeof res.lastIndex === 'number' && typeof res.currentIndex === 'number') ? (res.currentIndex < res.lastIndex) : true;
    var prevArrow = canPrev
        ? `<a href="#" class="hadiya-nav-arrow" onclick="event.preventDefault(); navigateHadiya(-1);" style="color:${accentColor};">&lt;</a>`
        : `<span class="hadiya-nav-arrow hadiya-nav-disabled" style="color:${accentColor};opacity:0.3;cursor:not-allowed;pointer-events:none;">&lt;</span>`;
    var nextArrow = canNext
        ? `<a href="#" class="hadiya-nav-arrow" onclick="event.preventDefault(); navigateHadiya(1);" style="color:${accentColor};">&gt;</a>`
        : `<span class="hadiya-nav-arrow hadiya-nav-disabled" style="color:${accentColor};opacity:0.3;cursor:not-allowed;pointer-events:none;">&gt;</span>`;
    var headerHtml = `<div class="hadiya-header">
        <div style="font-size:0.75rem; color:${accentColor}; font-weight:bold;">
            ${prevArrow}
            ${cur.range}
            ${nextArrow}
        </div>
    </div>`;

    var hasDedication = cur.dedicatedTo && cur.dedicatedTo !== cur.en;
    var dedName = hasDedication ? (cur.dedicatedToTa || cur.dedicatedTo) : '';

    var nomSize = hasDedication ? '0.85rem' : '1rem';
    var nameCol = `<div class="hadiya-name-col">
        <div style="font-size:${nomSize}; font-weight:600; color:#e6edf3;">${cur.en}</div>
        <div style="font-size:0.75rem; color:#8b949e; font-weight:600;">${cur.ta}</div>
    </div>`;

    var counterCol = '';
    var shouldStartCountdown = false;
    
    // Show countdown only for current week and before next Hadiya start
    if (!isCompleted && cur.deadlineISO && isCurrentWeek) {
        var canShowCountdown = true;
        if (cur.nextStartISO && cur.nextStartISO.length > 0) {
            var now = new Date();
            var IST_MS = 5.5 * 3600000;
            var nowIST = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + IST_MS);
            // Parse nextStartISO - handle both timezone-aware and local times
            var s = String(cur.nextStartISO).trim().replace(' ', 'T');
            var nextStart = new Date(s);
            if (!isNaN(nextStart.getTime())) {
                canShowCountdown = nowIST.getTime() < nextStart.getTime();
            } else {
                // Try parsing as local time (for format without timezone)
                var p = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
                if (p) {
                    nextStart = new Date(+p[1], +p[2]-1, +p[3], +p[4], +p[5], +(p[6]||0));
                    if (!isNaN(nextStart.getTime())) {
                        canShowCountdown = nowIST.getTime() < nextStart.getTime();
                    }
                }
            }
        }
        
        if (canShowCountdown) {
            counterCol = `<div class="hadiya-counter-col" style="border-color:${accentColor};">
                <div class="counter-days" id="hadiyaCounterDays" style="color:${accentColor};">--</div>
                <div class="counter-hms" id="hadiyaCounterHms">--:--:--</div>
            </div>`;
            shouldStartCountdown = true;
        }
    }

    var nameRow = `<div class="hadiya-name-row">${nameCol}${counterCol}</div>`;

    var dedicationHtml = '';
    if (hasDedication) {
        var dNamesEn = cur.dedicatedToEn ? cur.dedicatedToEn.split(';').map(function(s) { return s.trim(); }).filter(function(s) { return s; }) : [];
        var dNamesTa = cur.dedicatedToTa ? cur.dedicatedToTa.split(';').map(function(s) { return s.trim(); }).filter(function(s) { return s; }) : [];
        var dPurpEn = cur.dedicatedPurposeEn ? cur.dedicatedPurposeEn.split(';').map(function(s) { return s.trim(); }).filter(function(s) { return s; }) : [];
        var dPurpTa = cur.dedicatedPurposeTa ? cur.dedicatedPurposeTa.split(';').map(function(s) { return s.trim(); }).filter(function(s) { return s; }) : [];
        var dedEntriesHtml = '';
        for (var di = 0; di < dNamesEn.length; di++) {
            var rows = '';
            rows += '<div style="font-size:0.8rem; color:#e6edf3;"><strong>Name:</strong></div>' +
                    '<div style="font-size:0.8rem; color:#e6edf3;">' + escapeHtml(dNamesEn[di]) + '</div>';
            rows += '<div></div>' +
                    '<div style="font-size:0.75rem; color:#8b949e;">' + escapeHtml(dNamesTa[di] || dNamesEn[di]) + '</div>';
            if (dPurpEn[di]) {
                rows += '<div style="font-size:0.75rem; color:#c9d1d9;"><strong>Intention:</strong></div>' +
                        '<div style="font-size:0.75rem; color:#c9d1d9;">' + escapeHtml(dPurpEn[di]) + '</div>';
            }
            if (dPurpTa[di]) {
                rows += '<div></div>' +
                        '<div style="font-size:0.7rem; color:#8b949e;">' + escapeHtml(dPurpTa[di]) + '</div>';
            }
            dedEntriesHtml += '<div style="margin-bottom:6px; padding-bottom:4px;' + (di < dNamesEn.length - 1 ? 'border-bottom:1px solid #30363d;' : '') + '">' +
                '<div style="display:grid; grid-template-columns:auto 1fr; gap:1px 10px; align-items:start;">' + rows + '</div>' +
            '</div>';
        }
        var isExpanded = localStorage.getItem('hadiyaDedicationExpanded') === 'true';
        dedicationHtml = '<div class="hadiya-name-col" style="margin-top:2px;">' +
            '<div onclick="toggleDedicationExpand()" style="cursor:pointer; font-size:0.75rem; color:#d29922; font-weight:600; margin-bottom:2px; user-select:none;">' +
            '<span id="dedExpandIcon">' + (isExpanded ? '▼' : '▶') + '</span> 🎯 Dedicated | அர்பணித்தல்:</div>' +
            '<div id="dedicationDetails" style="' + (isExpanded ? 'display:block;' : 'display:none;') + '">' +
            dedEntriesHtml +
            '</div>' +
        '</div>';
    }

    var statusLabel = isCompleted ? '✅ Completed | நிறைவேறியது' : '⏳ Pending | நிலுவையில்';
    var statusColor = isCompleted ? '#3fb950' : '#d29922';
    var statusHtml = `<div style="margin-top:8px; font-size:0.8rem; color:${statusColor}; font-weight:600;">${statusLabel}</div>`;

    var pendingCount = (res.recitingList || []).length;
    var pendingBadge = (!isCompleted && pendingCount > 0) ?
        `<div style="margin-top:4px; padding:4px 10px; background:#3b1818; color:#f87171; border-radius:16px; font-size:0.75rem; font-weight:600; display:inline-block; border:1px dashed #da3633;">
            ⏳ ${pendingCount} left to start Hadiya | இன்னும் ${pendingCount} பேர் மீதம்
        </div>` : '';

    document.getElementById('hadCurrent').innerHTML = headerHtml + nameRow + dedicationHtml + (isCompleted ? statusHtml : '') + pendingBadge;

    if (shouldStartCountdown) {
        startHadiyaCountdown(cur.deadlineISO);
    }

    const prevSec = document.getElementById('prevSection');
    if (isCurrentWeek && res.previous) {
        prevSec.style.display = "block";
        document.getElementById('hadPrev').innerHTML = 
            `<b style="font-size:0.65rem;">${res.previous.range}</b><br>` +
            `${res.previous.en}<br>` +
            `<span style="font-size:0.65rem; color:#8b949e; font-weight:600;">${res.previous.ta}</span>`;
    } else {
        prevSec.style.display = "none";
    }
    
    const nextSec = document.getElementById('nextSection');
    if (isCurrentWeek && res.next) {
        nextSec.style.display = "block";
        document.getElementById('hadNext').innerHTML = 
            `<b style="font-size:0.65rem;">${res.next.range}</b><br>` +
            `${res.next.en}<br>` +
            `<span style="font-size:0.65rem; color:#8b949e; font-weight:600;">${res.next.ta}</span>`;
    } else {
        nextSec.style.display = "none";
    }

    var shareBtn = document.getElementById('hadiyaShareBtn');
    if (shareBtn) {
        if (isCompleted) {
            shareBtn.style.display = 'block';
            shareBtn.disabled = false;
            shareBtn.style.opacity = '1';
            shareBtn.style.cursor = 'pointer';
        } else {
            shareBtn.style.display = 'block';
            shareBtn.disabled = true;
            shareBtn.style.opacity = '0.4';
            shareBtn.style.cursor = 'not-allowed';
        }
    }
}

function updateHadiyaStatusUI(newStatus) {
    const dateVal = (currentHadiyaDetails && currentHadiyaDetails.current && currentHadiyaDetails.current.startDate) || document.getElementById('dateInput').value;
    if (!dateVal) return;
    window.appApi.withSuccessHandler(function(r) {
        if (r.success) {
            showSnackbar("Hadiya status updated: " + newStatus, false);
            fetchHadiyaDetails(dateVal);
        } else {
            showSnackbar("Failed: " + (r.error || 'Error'), true);
        }
    }).updateHadiyaStatus(dateVal, newStatus);
}

var dedicationEntries = [];
var isEditingDedication = false;

function openDedicationModal() {
    document.getElementById('dedicationModal').style.display = "flex";
    dedicationEntries = [];
    isEditingDedication = false;
    loadExistingDedications();
}

function loadExistingDedications() {
    var container = document.getElementById('dedicationListContainer');
    container.innerHTML = '<div style="font-size:0.8rem;color:#8b949e;margin-bottom:8px;">Loading existing dedications...</div>';
    
    if (currentHadiyaDetails && currentHadiyaDetails.current) {
        var cur = currentHadiyaDetails.current;
        var dedEn = cur.dedicatedToEn || cur.dedicatedTo || '';
        var dedTa = cur.dedicatedToTa || '';
        var purpEn = cur.dedicatedPurposeEn || '';
        var purpTa = cur.dedicatedPurposeTa || '';
        
        var entries = [];
        if (dedEn && dedEn.length > 0) {
            var names = dedEn.split(';').map(function(s) { return s.trim(); }).filter(function(s) { return s; });
            var nameTas = dedTa ? dedTa.split(';').map(function(s) { return s.trim(); }).filter(function(s) { return s; }) : [];
            var purposes = purpEn ? purpEn.split(';').map(function(s) { return s.trim(); }).filter(function(s) { return s; }) : [];
            var purposeTas = purpTa ? purpTa.split(';').map(function(s) { return s.trim(); }).filter(function(s) { return s; }) : [];
            
            for (var i = names.length - 1; i >= 0; i--) {
                entries.push({
                    nameEn: names[i],
                    nameTa: (nameTas[i] || names[i]).trim(),
                    purposeEn: purposes[i] || '',
                    purposeTa: purposeTas[i] || '',
                    hasIntention: !!(purposes[i] && purposes[i].trim())
                });
            }
        }
        
        dedicationEntries = entries;
        renderDedicationEntries();
    } else {
        dedicationEntries = [{ nameEn: '', nameTa: '', purposeEn: '', purposeTa: '', hasIntention: true }];
        isEditingDedication = true;
        renderDedicationEntries();
    }
}

function renderDedicationEntries() {
    var container = document.getElementById('dedicationListContainer');
    var html = '';
    var tBtnStyle = 'background:none;border:1px solid #30363d;border-radius:4px;color:#79c0ff;font-size:0.7rem;padding:4px 8px;margin-bottom:6px;margin-top:2px;cursor:pointer;';
    var arrBtnStyle = 'background:none;border:1px solid #30363d;border-radius:4px;color:#8b949e;font-size:0.75rem;padding:2px 8px;cursor:pointer;';
    var delBtnStyle = 'background:none;border:1px solid #f87171;border-radius:4px;color:#f87171;font-size:0.7rem;padding:3px 8px;cursor:pointer;';
    var trashSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
    
    dedicationEntries.forEach(function(entry, idx) {
        if (isEditingDedication) {
            html += `
            <div class="dedication-entry-box" style="border:1px solid #30363d; border-radius:8px; padding:12px; margin-bottom:10px; position:relative; background:#0d1117;">
                <div style="position:absolute; top:6px; right:6px; display:flex; gap:4px;">
                    <span onclick="confirmRemoveDedication(${idx})" style="font-size:0.9rem; cursor:pointer; color:#f87171; display:flex; align-items:center;" title="Remove">${trashSvg}</span>
                </div>
                <div style="font-size:0.75rem; color:#c9d1d9; margin-bottom:4px; font-weight:600;">Name (English)</div>
                <input type="text" id="dedNameEn${idx}" value="${entry.nameEn}" placeholder="Name in English" style="width:100%; background:#161b22; border:1px solid #30363d; border-radius:6px; color:#e6edf3; padding:8px; font-size:0.85rem; font-family:inherit; margin-bottom:2px; box-sizing:border-box;">
                <div><button onclick="translateField(${idx}, 'Name', 'toTa')" style="${tBtnStyle}">Translate to தமிழ்</button></div>

                <div style="font-size:0.75rem; color:#c9d1d9; margin-bottom:4px; font-weight:600;">பெயர் (தமிழ்)</div>
                <input type="text" id="dedNameTa${idx}" value="${entry.nameTa}" placeholder="பெயர் தமிழில்" style="width:100%; background:#161b22; border:1px solid #30363d; border-radius:6px; color:#e6edf3; padding:8px; font-size:0.85rem; font-family:inherit; margin-bottom:2px; box-sizing:border-box;">
                <div><button onclick="translateField(${idx}, 'Name', 'toEn')" style="${tBtnStyle}">Translate to English</button></div>

                <div style="margin:8px 0 4px; display:flex; align-items:center; justify-content:space-between;">
                    <label for="dedHasIntention${idx}" style="font-size:0.75rem; color:#c9d1d9; cursor:pointer;">Has Intention / நோக்கம் உள்ளது</label>
                    <input type="checkbox" id="dedHasIntention${idx}" onchange="toggleIntentionFields(${idx})" ${entry.hasIntention ? 'checked' : ''} style="accent-color:#79c0ff; width:16px; height:16px;">
                </div>

                <div id="intentionFields${idx}" style="${entry.hasIntention ? '' : 'display:none;'}">
                    <div style="font-size:0.75rem; color:#c9d1d9; margin-bottom:4px; font-weight:600;">Intention (English)</div>
                    <textarea id="dedPurposeEn${idx}" placeholder="Intention in English" style="width:100%; background:#161b22; border:1px solid #30363d; border-radius:6px; color:#e6edf3; padding:8px; font-size:0.85rem; font-family:inherit; margin-bottom:2px; box-sizing:border-box; min-height:50px;">${entry.purposeEn}</textarea>
                    <div><button onclick="translateField(${idx}, 'Purpose', 'toTa')" style="${tBtnStyle}">Translate to தமிழ்</button></div>

                    <div style="font-size:0.75rem; color:#c9d1d9; margin-bottom:4px; font-weight:600;">நோக்கம் (தமிழ்)</div>
                    <textarea id="dedPurposeTa${idx}" placeholder="நோக்கம் தமிழில்" style="width:100%; background:#161b22; border:1px solid #30363d; border-radius:6px; color:#e6edf3; padding:8px; font-size:0.85rem; font-family:inherit; margin-bottom:2px; box-sizing:border-box; min-height:50px;">${entry.purposeTa}</textarea>
                    <div><button onclick="translateField(${idx}, 'Purpose', 'toEn')" style="${tBtnStyle}">Translate to English</button></div>
                </div>

                <div style="display:flex; gap:6px; margin-top:4px;">
                    <button onclick="moveDedication(${idx}, -1)" style="${arrBtnStyle}" ${idx === 0 ? 'disabled' : ''}>▲ Up</button>
                    <button onclick="moveDedication(${idx}, 1)" style="${arrBtnStyle}" ${idx === dedicationEntries.length - 1 ? 'disabled' : ''}>▼ Down</button>
                </div>
            </div>`;
        } else {
            html += `
            <div class="dedication-entry-box" draggable="true"
                 data-index="${idx}"
                 ondragstart="dragStart(event, ${idx})"
                 ondragend="dragEnd(event)"
                 ondragover="dragOver(event, ${idx})"
                 ondragleave="dragLeave(event)"
                 ondrop="dropReorder(event, ${idx})"
                 style="border:1px solid #30363d; border-radius:8px; padding:12px; margin-bottom:10px; position:relative; background:#0d1117;">
                <div style="position:absolute; top:6px; right:8px; display:flex; gap:6px; align-items:center;">
                    <span onclick="confirmRemoveDedication(${idx})" style="font-size:0.8rem; cursor:pointer; color:#f87171; display:flex; align-items:center;" title="Remove">${trashSvg}</span>
                    <span style="font-size:1rem; color:#8b949e; cursor:grab; user-select:none;">⠿</span>
                </div>
                <div style="font-size:0.85rem; color:#e6edf3;"><strong>Name:</strong> ${escapeHtml(entry.nameEn)}</div>
                <div style="margin-left:12px; font-size:0.8rem; color:#8b949e;">${escapeHtml(entry.nameTa)}</div>
                <div style="margin:6px 0; border-top:1px solid #30363d;"></div>
                ${entry.purposeEn ? '<div style="font-size:0.8rem; color:#c9d1d9;"><strong>Intention:</strong> ' + escapeHtml(entry.purposeEn) + '</div>' : ''}
                ${entry.purposeTa ? '<div style="margin-left:12px; font-size:0.75rem; color:#8b949e;">' + escapeHtml(entry.purposeTa) + '</div>' : ''}
            </div>`;
        }
    });
    
    var toggleHtml = '';
    if (isEditingDedication) {
        toggleHtml = '<div style="margin-bottom:8px;"><button onclick="cancelDedicationEdit()" style="background:none;border:1px solid #f87171;border-radius:6px;color:#f87171;padding:6px 14px;font-size:0.8rem;cursor:pointer;font-family:inherit;">✕ Cancel Editing</button></div>';
    } else if (dedicationEntries.length > 0) {
        toggleHtml = '<div style="margin-bottom:8px;"><button onclick="enableDedicationEdit()" style="background:none;border:1px solid #79c0ff;border-radius:6px;color:#79c0ff;padding:6px 14px;font-size:0.8rem;cursor:pointer;font-family:inherit;">✏️ Edit</button></div>';
    }
    container.innerHTML = toggleHtml + (html || '<div style="font-size:0.8rem;color:#8b949e;">No dedications added yet.</div>');
}

function escapeHtml(t) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(t));
    return d.innerHTML;
}

function enableDedicationEdit() {
    isEditingDedication = true;
    renderDedicationEntries();
}

function cancelDedicationEdit() {
    isEditingDedication = false;
    loadExistingDedications();
}

function addDedicationEntry() {
    if (!isEditingDedication) enableDedicationEdit();
    dedicationEntries.unshift({ nameEn: '', nameTa: '', purposeEn: '', purposeTa: '', hasIntention: true });
    renderDedicationEntries();
}

function removeDedicationEntry(idx) {
    dedicationEntries.splice(idx, 1);
    renderDedicationEntries();
}

function confirmRemoveDedication(idx) {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;';
    var modal = document.createElement('div');
    modal.style.cssText = 'background:#161b22;border:1px solid #30363d;border-radius:12px;padding:24px;max-width:340px;width:90%;text-align:center;';
    modal.innerHTML =
        '<div style="font-size:1rem;color:#f87171;font-weight:600;margin-bottom:8px;">Remove Dedication?</div>' +
        '<div style="font-size:0.85rem;color:#8b949e;margin-bottom:16px;">இந்த அர்ப்பணிப்பை நீக்கவேண்டியதா?</div>' +
        '<div style="display:flex;gap:8px;justify-content:center;">' +
        '<button id="confirmDelYes" style="background:#da3633;color:#fff;border:none;border-radius:8px;padding:8px 20px;font-size:0.85rem;cursor:pointer;font-family:inherit;">Remove</button>' +
        '<button id="confirmDelNo" style="background:#21262d;color:#c9d1d9;border:none;border-radius:8px;padding:8px 20px;font-size:0.85rem;cursor:pointer;font-family:inherit;">Cancel</button>' +
        '</div>';
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.getElementById('confirmDelYes').onclick = function() { document.body.removeChild(overlay); removeDedicationEntry(idx); };
    document.getElementById('confirmDelNo').onclick = function() { document.body.removeChild(overlay); };
    overlay.onclick = function(e) { if (e.target === overlay) document.body.removeChild(overlay); };
}

function moveDedication(idx, dir) {
    var target = idx + dir;
    if (target < 0 || target >= dedicationEntries.length) return;
    var tmp = dedicationEntries[idx];
    dedicationEntries[idx] = dedicationEntries[target];
    dedicationEntries[target] = tmp;
    renderDedicationEntries();
}

// Drag and drop for view mode reordering
var dragSourceIdx = null;

function dragStart(event, idx) {
    dragSourceIdx = idx;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', idx);
    event.target.style.opacity = '0.4';
}

function dragEnd(event) {
    event.target.style.opacity = '1';
    dragSourceIdx = null;
    document.querySelectorAll('.dedication-entry-box').forEach(function(el) {
        el.style.borderColor = '#30363d';
    });
}

function dragOver(event, idx) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (dragSourceIdx !== idx) {
        event.target.style.borderColor = '#79c0ff';
    }
}

function dragLeave(event) {
    event.target.style.borderColor = '#30363d';
}

function dropReorder(event, targetIdx) {
    event.preventDefault();
    event.target.style.borderColor = '#30363d';
    var sourceIdx = parseInt(event.dataTransfer.getData('text/plain'));
    if (isNaN(sourceIdx)) sourceIdx = dragSourceIdx;
    if (sourceIdx === null || sourceIdx === targetIdx) return;
    var item = dedicationEntries.splice(sourceIdx, 1)[0];
    var adjustedTarget = targetIdx > sourceIdx ? targetIdx - 1 : targetIdx;
    dedicationEntries.splice(adjustedTarget, 0, item);
    renderDedicationEntries();
}

function toggleDedicationExpand() {
    var d = document.getElementById('dedicationDetails');
    var e = document.getElementById('dedExpandIcon');
    if (!d || !e) return;
    if (d.style.display === 'none' || !d.style.display) {
        d.style.display = 'block';
        e.textContent = '▼';
        localStorage.setItem('hadiyaDedicationExpanded', 'true');
    } else {
        d.style.display = 'none';
        e.textContent = '▶';
        localStorage.setItem('hadiyaDedicationExpanded', 'false');
    }
}

function toggleIntentionFields(idx) {
    var cb = document.getElementById('dedHasIntention' + idx);
    var fields = document.getElementById('intentionFields' + idx);
    if (cb && fields) {
        fields.style.display = cb.checked ? '' : 'none';
        if (!cb.checked) {
            var en = document.getElementById('dedPurposeEn' + idx);
            var ta = document.getElementById('dedPurposeTa' + idx);
            if (en) en.value = '';
            if (ta) ta.value = '';
        }
    }
}

function translateField(idx, field, direction) {
    if (!window.GROQ_KEY) {
        showSnackbar("Translation is not configured. / மொழிபெயர்ப்பு கிடைக்கவில்லை", true);
        return;
    }

    var prefix = field === 'Name' ? 'dedName' : 'dedPurpose';
    var srcId = prefix + (direction === 'toTa' ? 'En' : 'Ta') + idx;
    var tgtId = prefix + (direction === 'toTa' ? 'Ta' : 'En') + idx;
    var srcEl = document.getElementById(srcId);
    var tgtEl = document.getElementById(tgtId);
    if (!srcEl || !tgtEl) return;
    var sourceText = srcEl.value.trim();
    if (!sourceText) {
        showSnackbar("Enter text to translate / மொழிபடுத்த உரையை உள்ளிடவும்", true);
        return;
    }

    function setResult(t) { if (t) tgtEl.value = t; else showSnackbar("Transliteration failed / மொழிபெயர்ப்பு தோல்வி", true); }

    var mode = field === 'Name' ? 'transliterate (convert by sound only)' : 'translate (convert by meaning, then transliterate the result)';
    var srcLang = direction === 'toTa' ? 'English' : 'Tamil';
    var tgtLang = direction === 'toTa' ? 'Tamil' : 'English';
    var prompt = 'You are a Tamil-English translator. ' + mode + ' the given text from ' + srcLang + ' to ' + tgtLang + '. Handle Arabic-origin words (like Magfirrath, Salman, etc.) correctly by sound. Return ONLY the result with no extra words, quotes, or formatting.\n\n' + sourceText;

    fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + window.GROQ_KEY },
        body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 200
        })
    }).then(function(r) { return r.json(); }).then(function(d) {
        if (d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) {
            setResult(d.choices[0].message.content.trim());
        } else if (d && d.error) {
            showSnackbar("Groq error: " + d.error.message, true);
        } else {
            setResult(null);
        }
    }).catch(function(err) {
        showSnackbar("Translation error / மொழிபெயர்ப்பு பிழை", true);
    });
}

function closeDedicationModal() {
    document.getElementById('dedicationModal').style.display = "none";
}

function saveDedication() {
    var dateVal = document.getElementById('dateInput').value;
    if (!dateVal) { showSnackbar("Select a date first.", true); return; }
    if (!isEditingDedication) { showSnackbar("Click 'Edit' first to modify dedications.", true); return; }
    
    var namesEn = [];
    var namesTa = [];
    var purposesEn = [];
    var purposesTa = [];
    
    // Find all rendered inputs in the DOM
    var idx = 0;
    while (true) {
        var nameEn = document.getElementById('dedNameEn' + idx);
        var nameTa = document.getElementById('dedNameTa' + idx);
        var purpEn = document.getElementById('dedPurposeEn' + idx);
        var purpTa = document.getElementById('dedPurposeTa' + idx);
        var hasIntCb = document.getElementById('dedHasIntention' + idx);
        
        if (!nameEn || !nameTa) break;
        
        var ne = nameEn.value.trim();
        var nt = nameTa.value.trim();
        if (ne || nt) {
            namesEn.push(ne);
            namesTa.push(nt || ne);
            if (hasIntCb && hasIntCb.checked) {
                purposesEn.push(purpEn ? purpEn.value.trim() : '');
                purposesTa.push(purpTa ? purpTa.value.trim() : '');
            } else {
                purposesEn.push('');
                purposesTa.push('');
            }
        }
        idx++;
    }
    
    document.getElementById('saveDedicationBtn').disabled = true;
    window.appApi.withSuccessHandler(function(r) {
        document.getElementById('saveDedicationBtn').disabled = false;
        if (r.success) {
            showSnackbar("Dedication updated! / அர்ப்பணிப்பு சேமிக்கப்பட்டது!", false);
            closeDedicationModal();
            fetchHadiyaDetails(dateVal);
        } else {
            showSnackbar("Failed: " + (r.error || 'Error'), true);
        }
    }).updateHadiyaDedication(dateVal, namesEn.join(';'), namesTa.join(';'), purposesEn.join(';'), purposesTa.join(';'));
}

var hadiyaDetailsList = [];
var hadiyaRenameStartDate = null;

function loadHadiyaDetailsList() {
    var container = document.getElementById('hadiyaDetailsListContainer');
    if (!container) return;
    if (!window.appApi || typeof window.appApi.getAllHadiyaDetails !== 'function') {
        container.innerHTML = '<div style="font-size:0.8rem;color:#f87171;">Hadiya details are unavailable in this cached version. Close and reopen the app.</div>';
        return;
    }
    var savedScrollTop = container.scrollTop;
    container.innerHTML = '<div style="font-size:0.8rem;color:#8b949e;">Loading...</div>';
    try {
        window.appApi.withSuccessHandler(function(rows) {
            hadiyaDetailsList = rows || [];
            renderHadiyaDetailsList();
            container.scrollTop = savedScrollTop;
        }).withFailureHandler(function(e) {
            var msg = (e && e.message) ? e.message : (typeof e === 'string' ? e : 'Unknown error');
            container.innerHTML = '<div style="font-size:0.8rem;color:#f87171;">Failed to load Hadiya details.</div>';
            showSnackbar("Failed to load Hadiya details: " + msg, true);
        }).getAllHadiyaDetails();
    } catch (e) {
        container.innerHTML = '<div style="font-size:0.8rem;color:#f87171;">Failed to load Hadiya details.</div>';
        showSnackbar("Failed to load Hadiya details: " + ((e && e.message) ? e.message : String(e)), true);
    }
}

function renderHadiyaDetailsList() {
    var container = document.getElementById('hadiyaDetailsListContainer');
    if (!container) return;
    if (hadiyaDetailsList.length === 0) {
        container.innerHTML = '<div style="font-size:0.8rem;color:#8b949e;">No pending Hadiya details found.</div>';
        return;
    }
    var arrowStyle = 'background:#21262d;border:1px solid #30363d;border-radius:4px;color:#c9d1d9;padding:2px 8px;font-size:0.7rem;cursor:pointer;font-family:inherit;';
    var editStyle = 'background:none;border:1px solid #79c0ff;border-radius:4px;color:#79c0ff;font-size:0.7rem;padding:3px 8px;cursor:pointer;font-family:inherit;';
    var html = '';
    hadiyaDetailsList.forEach(function(row, idx) {
        var statusColor = row.status === 'Completed' ? '#3fb950' : '#8b949e';
        var overrideBadge = row.isOverride
            ? '<span style="margin-left:6px;font-size:0.6rem;color:#d29922;border:1px solid #d29922;border-radius:8px;padding:0 5px;">CUSTOM</span>'
            : '';
        html += '<div style="border:1px solid ' + (row.isOverride ? '#d29922' : '#30363d') + ';border-radius:8px;padding:10px;margin-bottom:8px;background:#0d1117;">' +
            '<div style="display:flex;gap:8px;align-items:flex-start;justify-content:space-between;">' +
                '<div style="min-width:0;">' +
                    '<div style="font-size:0.7rem;color:#8b949e;font-weight:600;">' + escapeHtml(row.range || row.startDate) +
                        ' <span style="color:' + statusColor + ';">· ' + escapeHtml(row.status || 'Pending') + '</span>' +
                    '</div>' +
                    '<div style="font-size:0.85rem;color:#e6edf3;font-weight:600;word-break:break-word;">' + escapeHtml(row.nameEn || 'No nominee') + overrideBadge + '</div>' +
                    (row.nameTa ? '<div style="font-size:0.75rem;color:#8b949e;">' + escapeHtml(row.nameTa) + '</div>' : '') +
                '</div>' +
                '<div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0;">' +
                    '<button onclick="moveHadiyaNominee(' + idx + ',-1)" style="' + arrowStyle + '" ' + (idx === 0 ? 'disabled' : '') + '>▲</button>' +
                    '<button onclick="moveHadiyaNominee(' + idx + ',1)" style="' + arrowStyle + '" ' + (idx === hadiyaDetailsList.length - 1 ? 'disabled' : '') + '>▼</button>' +
                '</div>' +
            '</div>' +
            '<div style="display:flex;justify-content:flex-end;margin-top:6px;">' +
                '<button onclick="openHadiyaNameEditModal(' + idx + ')" style="' + editStyle + '">✏️ Change Name</button>' +
            '</div>' +
        '</div>';
    });
    container.innerHTML = html;
}

function moveHadiyaNominee(idx, dir) {
    var target = idx + dir;
    if (target < 0 || target >= hadiyaDetailsList.length) return;
    var a = hadiyaDetailsList[idx];
    var b = hadiyaDetailsList[target];
    if (!a || !b) return;
    var dirText = dir < 0 ? 'up' : 'down';
    showHadiyaConfirm(
        'Reorder Hadiya? / வரிசையை மாற்றவா?',
        'Move "' + (a.nameEn || 'this Hadiya') + '" ' + dirText + ' and swap with "' + (b.nameEn || 'the adjacent Hadiya') + '"?',
        function() { applyHadiyaMove(a, b); }
    );
}

function applyHadiyaMove(a, b) {
    window.appApi.withSuccessHandler(function(r) {
        if (r && r.success) {
            showSnackbar("Hadiya order updated!", false);
            loadHadiyaDetailsList();
            refreshHadiyaAfterDetailsChange();
        } else {
            showSnackbar("Failed: " + ((r && r.error) || 'Error'), true);
        }
    }).withFailureHandler(function(e) {
        var msg = (e && e.message) ? e.message : (typeof e === 'string' ? e : 'Unknown error');
        showSnackbar("Failed: " + msg, true);
    }).swapHadiyaNominees(a.startDate, b.startDate);
}

function showHadiyaConfirm(title, message, onConfirm) {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;';
    var modal = document.createElement('div');
    modal.style.cssText = 'background:#161b22;border:1px solid #30363d;border-radius:12px;padding:24px;max-width:340px;width:90%;text-align:center;';
    var titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-size:1rem;color:#79c0ff;font-weight:600;margin-bottom:8px;';
    titleEl.textContent = title;
    var msgEl = document.createElement('div');
    msgEl.style.cssText = 'font-size:0.85rem;color:#8b949e;margin-bottom:16px;line-height:1.4;';
    msgEl.textContent = message;
    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;justify-content:center;';
    var yesBtn = document.createElement('button');
    yesBtn.textContent = 'Confirm';
    yesBtn.style.cssText = 'background:#1f6feb;color:#fff;border:none;border-radius:8px;padding:8px 20px;font-size:0.85rem;cursor:pointer;font-family:inherit;';
    var noBtn = document.createElement('button');
    noBtn.textContent = 'Cancel';
    noBtn.style.cssText = 'background:#21262d;color:#c9d1d9;border:none;border-radius:8px;padding:8px 20px;font-size:0.85rem;cursor:pointer;font-family:inherit;';
    btnRow.appendChild(yesBtn);
    btnRow.appendChild(noBtn);
    modal.appendChild(titleEl);
    modal.appendChild(msgEl);
    modal.appendChild(btnRow);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    yesBtn.onclick = function() { document.body.removeChild(overlay); if (onConfirm) onConfirm(); };
    noBtn.onclick = function() { document.body.removeChild(overlay); };
    overlay.onclick = function(e) { if (e.target === overlay) document.body.removeChild(overlay); };
}

function openHadiyaNameEditModal(idx) {
    var row = hadiyaDetailsList[idx];
    if (!row) return;
    hadiyaRenameStartDate = row.startDate;
    document.getElementById('hadiyaNameEditRange').innerText = row.range || row.startDate;
    document.getElementById('hadiyaNameEnInput').value = row.nameEn || '';
    document.getElementById('hadiyaNameTaInput').value = row.nameTa || '';
    document.getElementById('hadiyaNameEditModal').style.display = 'flex';
}

function closeHadiyaNameEditModal() {
    document.getElementById('hadiyaNameEditModal').style.display = 'none';
}

function saveHadiyaNameOverride() {
    var en = document.getElementById('hadiyaNameEnInput').value.trim();
    var ta = document.getElementById('hadiyaNameTaInput').value.trim();
    if (!hadiyaRenameStartDate) return;
    if (!en) { showSnackbar("Name (English) is required.", true); return; }
    var btn = document.getElementById('hadiyaNameSaveBtn');
    btn.disabled = true;
    btn.innerText = "Saving...";
    window.appApi.withSuccessHandler(function(r) {
        btn.disabled = false;
        btn.innerHTML = 'Save Name<br>பெயரை சேமிக்க';
        if (r && r.success) {
            closeHadiyaNameEditModal();
            showSnackbar("Hadiya name updated!", false);
            loadHadiyaDetailsList();
            refreshHadiyaAfterDetailsChange();
        } else {
            showSnackbar("Failed: " + ((r && r.error) || 'Error'), true);
        }
    }).withFailureHandler(function(e) {
        btn.disabled = false;
        btn.innerHTML = 'Save Name<br>பெயரை சேமிக்க';
        var msg = (e && e.message) ? e.message : (typeof e === 'string' ? e : 'Unknown error');
        showSnackbar("Failed: " + msg, true);
    }).updateHadiyaName(hadiyaRenameStartDate, en, ta || en);
}

function refreshHadiyaAfterDetailsChange() {
    var input = document.getElementById('dateInput');
    var dateVal = (input && input.value) ? input.value : (currentHadiyaDetails && currentHadiyaDetails.current ? currentHadiyaDetails.current.startDate : '');
    if (dateVal) fetchHadiyaDetails(dateVal);
}

// ----------------------------------------------------------------
// Add Next Hadiya
// ----------------------------------------------------------------
var addNextState = { startDate: null, defaultCustomId: '' };
var addNextMembers = [];

function initAddNextHadiya() {
    var infoEl = document.getElementById('addNextDateInfo');
    var hintEl = document.getElementById('addNextDefaultHint');
    var saveBtn = document.getElementById('addNextSaveBtn');
    if (!infoEl) return;
    document.getElementById('addNextMemberSearch').value = '';
    document.getElementById('addNextMemberCustomId').value = '';
    document.getElementById('addNextDropdown').innerHTML = '';
    addNextState = { startDate: null, defaultCustomId: '' };
    addNextMembers = [];
    infoEl.textContent = 'Loading...';
    hintEl.textContent = '';
    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = 'Add Hadiya<br>ஹதியாவை சேர்க்க'; }

    window.appApi.withSuccessHandler(function(info) {
        addNextState.startDate = info.startDate || null;
        addNextState.defaultCustomId = info.defaultCustomId || '';
        addNextMembers = info.members || [];
        infoEl.textContent = info.startDate ? ('Week of ' + info.startDate) : 'Unable to determine next week.';
        if (info.defaultCustomId) {
            var defDisplay = (info.defaultNameEn || info.defaultCustomId || '') + (info.defaultNameTa ? ' | ' + info.defaultNameTa : '');
            hintEl.textContent = 'Default: Juz 30 reader (' + (info.defaultNameEn || info.defaultCustomId) + ')';
            selectAddNextMember(info.defaultCustomId, defDisplay);
        } else {
            hintEl.textContent = 'No Juz 30 assignment found for this week. Please choose a member.';
        }
        if (saveBtn) saveBtn.disabled = false;
    }).withFailureHandler(function(e) {
        var msg = (e && e.message) ? e.message : (typeof e === 'string' ? e : 'Unknown error');
        infoEl.textContent = 'Failed to load.';
        hintEl.textContent = msg;
        showSnackbar('Failed to load next Hadiya: ' + msg, true);
    }).getNextHadiyaInfo();
}

function renderAddNextDropdown() {
    var q = (document.getElementById('addNextMemberSearch').value || '').toLowerCase();
    var dropdown = document.getElementById('addNextDropdown');
    if (!dropdown) return;
    var filtered = [];
    addNextMembers.forEach(function(m, idx) {
        var display = (m.name_en || '') + ' | ' + (m.name_ta || '');
        if (display.toLowerCase().indexOf(q) > -1) filtered.push({ m: m, idx: idx });
    });
    if (filtered.length === 0) {
        dropdown.innerHTML = '<div class="opt no-match">No matches / பொருந்தவில்லை</div>';
    } else {
        dropdown.innerHTML = filtered.map(function(x) {
            var display = (x.m.name_en || '') + ' | ' + (x.m.name_ta || '');
            return '<div class="opt" onmousedown="selectAddNextByIndex(' + x.idx + ')">' + escapeHtml(display) + '</div>';
        }).join('');
    }
    dropdown.style.display = 'block';
}
function openAddNextDropdown() { renderAddNextDropdown(); }
function filterAddNextOptions() { renderAddNextDropdown(); }
function closeAddNextDropdown() {
    var d = document.getElementById('addNextDropdown');
    if (d) d.style.display = 'none';
}
function selectAddNextByIndex(idx) {
    var m = addNextMembers[idx];
    if (!m) return;
    selectAddNextMember(m.custom_id, (m.name_en || '') + ' | ' + (m.name_ta || ''));
}
function selectAddNextMember(customId, display) {
    document.getElementById('addNextMemberSearch').value = display;
    document.getElementById('addNextMemberCustomId').value = customId;
    closeAddNextDropdown();
}

function saveNextHadiya() {
    var customId = document.getElementById('addNextMemberCustomId').value;
    if (!addNextState.startDate) { showSnackbar('Still loading. Please wait.', true); return; }
    if (!customId) { showSnackbar('Please choose a member.', true); return; }
    var btn = document.getElementById('addNextSaveBtn');
    btn.disabled = true;
    btn.innerText = 'Adding...';
    var addedDate = addNextState.startDate;
    window.appApi.withSuccessHandler(function(r) {
        btn.disabled = false;
        btn.innerHTML = 'Add Hadiya<br>ஹதியாவை சேர்க்க';
        if (r && r.success) {
            showSnackbar('Next Hadiya added!', false);
            closeHadiyaMenuModal();
            fetchHadiyaDetails(addedDate);
        } else {
            showSnackbar('Failed: ' + ((r && r.error) || 'Error'), true);
        }
    }).withFailureHandler(function(e) {
        btn.disabled = false;
        btn.innerHTML = 'Add Hadiya<br>ஹதியாவை சேர்க்க';
        var msg = (e && e.message) ? e.message : (typeof e === 'string' ? e : 'Unknown error');
        showSnackbar('Failed: ' + msg, true);
    }).addNextHadiya(addNextState.startDate, customId);
}

function openCaptureOptionsModal() {
    if (!(window._isAdmin || (window.isAdmin && window.isAdmin()))) {
        showSnackbar('Admin access only.', true);
        return;
    }
    var m = document.getElementById('captureOptionsModal');
    if (m) m.style.display = 'flex';
}
function closeCaptureOptionsModal() {
    var m = document.getElementById('captureOptionsModal');
    if (m) m.style.display = 'none';
}

function openDepartureWelcomeModal() {
    if (!(window._isAdmin || (window.isAdmin && window.isAdmin()))) { showSnackbar('Admin access only.', true); return; }
    if (!currentHadiyaDetails || !currentHadiyaDetails.current) { showSnackbar('No Hadiya week selected.', true); return; }
    closeCaptureOptionsModal();
    var cur = currentHadiyaDetails.current;
    var range = cur.range || (cur.startDate || '');
    var label = document.getElementById('departureWeekLabel');
    if (label) label.textContent = range ? ('Effective this week: ' + range) : '';
    // clear/prefill defaults
    ['outgoingNameEn','outgoingNameTa','newcomerNameEn','newcomerNameTa'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
    var modal = document.getElementById('departureWelcomeModal');
    if (modal) modal.style.display = 'flex';
    // best-effort prefill: detect members whose effective_date falls in this hadiya week
    tryPrefillDepartureWelcome(cur);
}
function closeDepartureWelcomeModal() {
    var m = document.getElementById('departureWelcomeModal');
    if (m) m.style.display = 'none';
}

function tryPrefillDepartureWelcome(cur) {
    if (!window.appApi || typeof window.appApi.getAllMembers !== 'function') return;
    var start = hadiyaDateOnly(cur.startDate);
    if (!start) return;
    var end = hadiyaEndDateOnly(cur.startDate);
    window.appApi.withSuccessHandler(function(members) {
        members = members || [];
        // find newcomer(s) with effective_date in [start,end]
        var newcomers = members.filter(function(m){
            var eff = hadiyaDateOnly(m.effective_date);
            return eff && eff >= start && eff <= end;
        });
        if (!newcomers.length) return;
        // pick one with a same-custom_id predecessor as likely replacement
        var chosen = null, outgoing = null;
        for (var i=0;i<newcomers.length;i++) {
            var n = newcomers[i];
            var same = members.filter(function(m){ return String(m.custom_id) === String(n.custom_id) && String(m.id) !== String(n.id); });
            // outgoing: most recent effective before newcomer
            var prev = null;
            same.forEach(function(m){
                var eff = hadiyaDateOnly(m.effective_date);
                var neff = hadiyaDateOnly(n.effective_date) || start;
                if (!eff || eff < neff) {
                    if (!prev) prev = m;
                    else {
                        var pe = hadiyaDateOnly(prev.effective_date);
                        if (!pe || (eff && eff > pe)) prev = m;
                    }
                }
            });
            if (prev) { chosen = n; outgoing = prev; break; }
            if (!chosen) chosen = n;
        }
        if (!chosen) return;
        var setVal = function(id,val){ var el=document.getElementById(id); if(el && !el.value) el.value = val || ''; };
        setVal('newcomerNameEn', chosen.name_en || '');
        setVal('newcomerNameTa', chosen.name_ta || '');
        if (outgoing) {
            setVal('outgoingNameEn', outgoing.name_en || '');
            setVal('outgoingNameTa', outgoing.name_ta || '');
        }
    }).getAllMembers();
}

function previewDepartureWelcome() {
    if (!(window._isAdmin || (window.isAdmin && window.isAdmin()))) { showSnackbar('Admin access only.', true); return; }
    if (!currentHadiyaDetails || !currentHadiyaDetails.current) { showSnackbar('No Hadiya week selected.', true); return; }
    var outEn = (document.getElementById('outgoingNameEn').value || '').trim();
    var outTa = (document.getElementById('outgoingNameTa').value || '').trim();
    var inEn = (document.getElementById('newcomerNameEn').value || '').trim();
    var inTa = (document.getElementById('newcomerNameTa').value || '').trim();
    if (!outEn || !inEn) { showSnackbar('Please enter outgoing and newcomer names (English).', true); return; }
    if (!outTa) outTa = outEn;
    if (!inTa) inTa = inEn;
    var cur = currentHadiyaDetails.current;
    var range = cur.range || '';
    var node = buildDepartureWelcomeNode({ outEn: outEn, outTa: outTa, inEn: inEn, inTa: inTa, range: range });
    closeDepartureWelcomeModal();
    openCapturePreview(node, { bgColor: '#0d1117', scale: 3, successMsg: 'Announcement image copied!' });
}

function buildDepartureWelcomeNode(d) {
    var esc = function(s){ return escapeHtml(s || ''); };
    var html = '<div style="width:640px;background:#0d1117;padding:28px 30px;box-sizing:border-box;font-family:Poppins,Arial,sans-serif;color:#e6edf3;position:relative;">' +
        '<div style="position:absolute;left:0;top:0;right:0;height:5px;background:linear-gradient(90deg,#1f6feb,#58a6ff,#79c0ff);"></div>' +
        '<div style="text-align:center;margin-bottom:14px;">' +
            '<div style="font-size:18px;font-weight:700;color:#79c0ff;">Announcement / அறிவிப்பு</div>' +
            (d.range ? '<div style="font-size:12px;color:#8b949e;margin-top:3px;">' + esc(d.range) + '</div>' : '') +
        '</div>' +
        '<div style="background:#161b22;border:1px solid #30363d;border-radius:12px;padding:16px 18px;margin-bottom:12px;">' +
            '<div style="font-size:12px;color:#58a6ff;font-weight:700;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">English</div>' +
            '<div style="font-size:14px;line-height:1.7;color:#e6edf3;">' +
                '<p style="margin:0 0 10px;">Effective this week, <strong>' + esc(d.inEn) + '</strong> will be joining us, replacing <strong>' + esc(d.outEn) + '</strong>.</p>' +
                '<p style="margin:0 0 10px;">Jazakallah Khair, <strong>' + esc(d.outEn) + '</strong>, for your dedication and participation in our weekly Juz recitation thus far.</p>' +
                '<p style="margin:0;">A warm welcome to you, <strong>' + esc(d.inEn) + '</strong>! We are glad to have you in <strong>Inainthu Othuvom (Hadiya)</strong>.</p>' +
            '</div>' +
        '</div>' +
        '<div style="background:#161b22;border:1px solid #30363d;border-radius:12px;padding:16px 18px;">' +
            '<div style="font-size:12px;color:#58a6ff;font-weight:700;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">தமிழ்</div>' +
            '<div style="font-size:14px;line-height:1.8;color:#e6edf3;">' +
                '<p style="margin:0 0 10px;">இந்த வாரம் முதல், <strong>' + esc(d.outTa) + '</strong> அவர்களுக்கு பதிலாக <strong>' + esc(d.inTa) + '</strong> அவர்கள் எங்களுடன் இணைகிறார்.</p>' +
                '<p style="margin:0 0 10px;">இதுவரை வாராந்திர ஜுஸ் ஓதலில் நீங்கள் காட்டிய அர்ப்பணிப்பிற்கும் பங்களிப்பிற்கும், <strong>' + esc(d.outTa) + '</strong> அவர்களே, ஜஸாக்கல்லாஹு கைர்.</p>' +
                '<p style="margin:0;"><strong>' + esc(d.inTa) + '</strong> அவர்களே, <strong>இணைந்து ஓதுவோம் (ஹதியா)</strong> குழுவில் உங்களை அன்புடன் வரவேற்கிறோம்.</p>' +
            '</div>' +
        '</div>' +
    '</div>';
    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    return wrap.firstElementChild || wrap;
}

function renderNodeToClipboard(node, successMsg) {
    // Backward-compatible direct capture (no preview) - kept for safety
    openCapturePreview(node, { bgColor: '#0d1117', scale: 3, successMsg: successMsg, autoCopy: true });
}

function openCapturePreview(contentNode, opts) {
    opts = opts || {};
    if (typeof html2canvas !== 'function') { showSnackbar('Image capture unavailable.', true); return; }
    var bgColor = opts.bgColor || '#0d1117';
    var scale = opts.scale || 3;
    var successMsg = opts.successMsg || 'Image copied!';
    var autoCopy = !!opts.autoCopy;

    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(13,17,23,0.98);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px 16px;box-sizing:border-box;';

    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex;flex-direction:column;align-items:center;max-width:100%;';

    var topBar = document.createElement('div');
    topBar.style.cssText = 'width:100%;max-width:' + ((contentNode.offsetWidth || 480)) + 'px;display:flex;justify-content:space-between;align-items:center;gap:10px;padding:0 0 10px;box-sizing:border-box;';

    var closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = 'background:#30363d;color:#e6edf3;border:none;border-radius:8px;padding:8px 14px;cursor:pointer;font-family:inherit;font-size:0.8rem;font-weight:600;';

    var copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy Image';
    copyBtn.style.cssText = 'background:#1f6feb;color:#fff;border:none;border-radius:8px;padding:8px 14px;cursor:pointer;font-family:inherit;font-size:0.8rem;font-weight:600;';

    topBar.appendChild(closeBtn);
    topBar.appendChild(copyBtn);

    var previewBox = document.createElement('div');
    previewBox.style.cssText = 'max-height:80vh;overflow:auto;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.5);';
    previewBox.appendChild(contentNode);

    wrapper.appendChild(topBar);
    wrapper.appendChild(previewBox);
    overlay.appendChild(wrapper);
    document.body.appendChild(overlay);

    // scale down preview if wider than viewport
    var baseW = contentNode.offsetWidth || contentNode.style.width.replace('px','') || 480;
    var avail = Math.max(200, window.innerWidth - 40);
    if (baseW > avail) {
        var sc = avail / baseW;
        previewBox.style.transform = 'scale(' + sc + ')';
        previewBox.style.transformOrigin = 'top center';
        previewBox.style.marginBottom = ((sc - 1) * (contentNode.offsetHeight || 600)) + 'px';
    }

    function closePreview() {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
    closeBtn.onclick = closePreview;
    overlay.onclick = function(e){ if (e.target === overlay) closePreview(); };

    function doCopy() {
        copyBtn.disabled = true;
        var oldText = copyBtn.textContent;
        copyBtn.textContent = 'Rendering...';
        // capture full content without scroll clipping
        var origMaxH = previewBox.style.maxHeight;
        var origOverflow = previewBox.style.overflow;
        var origTransform = previewBox.style.transform;
        previewBox.style.maxHeight = 'none';
        previewBox.style.overflow = 'visible';
        previewBox.style.transform = 'none';
        html2canvas(contentNode, { scale: scale, useCORS: true, backgroundColor: bgColor, logging: false }).then(function(canvas) {
            previewBox.style.maxHeight = origMaxH;
            previewBox.style.overflow = origOverflow;
            previewBox.style.transform = origTransform;
            canvas.toBlob(function(blob) {
                if (!blob) { copyBtn.disabled=false; copyBtn.textContent=oldText; showSnackbar('Failed to create image.', true); return; }
                if (navigator.clipboard && window.ClipboardItem) {
                    navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(function() {
                        copyBtn.textContent = 'Copied!';
                        copyBtn.style.background = '#238636';
                        showSnackbar(successMsg, false);
                        setTimeout(function(){ copyBtn.textContent = oldText; copyBtn.style.background = '#1f6feb'; copyBtn.disabled = false; }, 2000);
                    }).catch(function() {
                        downloadBlob(blob, 'capture.png');
                        copyBtn.textContent = oldText; copyBtn.disabled = false;
                        showSnackbar('Downloaded image (clipboard unavailable).', false);
                    });
                } else {
                    downloadBlob(blob, 'capture.png');
                    copyBtn.textContent = oldText; copyBtn.disabled = false;
                    showSnackbar('Downloaded image.', false);
                }
            }, 'image/png');
        }).catch(function() {
            previewBox.style.maxHeight = origMaxH;
            previewBox.style.overflow = origOverflow;
            previewBox.style.transform = origTransform;
            copyBtn.disabled = false; copyBtn.textContent = oldText;
            showSnackbar('Rendering failed.', true);
        });
    }
    copyBtn.onclick = doCopy;
    if (autoCopy) doCopy();
}
function downloadBlob(blob, filename) {
    var a = document.createElement('a');
    var url = URL.createObjectURL(blob);
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function() { URL.revokeObjectURL(url); if (a.parentNode) a.parentNode.removeChild(a); }, 1000);
}

function captureHadiyaSection() {
    if (!(window._isAdmin || (window.isAdmin && window.isAdmin()))) { showSnackbar('Admin access only.', true); return; }
    if (!currentHadiyaDetails || !currentHadiyaDetails.current) {
        showSnackbar('No Hadiya details to capture.', true);
        return;
    }
    var box = document.getElementById('hadiyaBox');
    if (!box) { showSnackbar('Hadiya section not found.', true); return; }
    closeCaptureOptionsModal();
    closeHadiyaMenuModal();
    var clone = box.cloneNode(true);
    // remove interactive elements
    var removeSelectors = ['#hadiyaShareBtn', 'button', '.hadiya-nav-arrow', '#hadiyaMenuBtn'];
    removeSelectors.forEach(function(sel) {
        clone.querySelectorAll(sel).forEach(function(el) { if (el && el.parentNode) el.parentNode.removeChild(el); });
    });
    // replace nav arrows/text containers if any remain by disabling clicks
    clone.querySelectorAll('a').forEach(function(a){ a.removeAttribute('onclick'); a.style.pointerEvents='none'; a.style.textDecoration='none'; });
    var wrap = document.createElement('div');
    wrap.style.cssText = 'width:420px;background:#0d1117;padding:16px;box-sizing:border-box;font-family:Poppins,Arial,sans-serif;color:#e6edf3;';
    clone.style.display = 'block';
    clone.style.margin = '0';
    clone.style.width = '100%';
    wrap.appendChild(clone);
    openCapturePreview(wrap, { bgColor: '#0d1117', scale: 3, successMsg: 'Hadiya image copied!' });
}

function captureReadingList() {
    if (!(window._isAdmin || (window.isAdmin && window.isAdmin()))) { showSnackbar('Admin access only.', true); return; }
    if (!currentHadiyaDetails || !currentHadiyaDetails.current) {
        showSnackbar('No Hadiya details available.', true);
        return;
    }
    var cur = currentHadiyaDetails.current;
    // Use end-of-week date so getWeeklyReport's cutoff logic doesn't shift to previous week
    var dateForReport = cur.weekEndDate || cur.startDate;
    var range = cur.range || '';
    closeCaptureOptionsModal();
    closeHadiyaMenuModal();
    showSnackbar('Preparing reading list...', false);
    window.appApi.withSuccessHandler(function(resp) {
        var rows = (resp && resp.data) ? resp.data : [];
        if (!rows.length) { showSnackbar('No reading list data found for this week.', true); return; }
        rows = rows.slice().sort(function(a,b){
            var ja = parseInt(a.juzNum,10) || 0, jb = parseInt(b.juzNum,10) || 0;
            if (ja !== jb) return ja - jb;
            return String(a.name||'').localeCompare(String(b.name||''));
        });
        function buildPairItem(r, idx) {
            var name = r.name || '';
            var nameEn = name.indexOf('|')>-1 ? name.split('|')[0].trim() : name;
            var nameTa = name.indexOf('|')>-1 ? name.split('|')[1].trim() : '';
            var juzNo = r.juzNum || '';
            var juzAr = r.juzAr || '';
            var juzEn = r.juzEn || '';
            var juzTa = r.juzTa || '';
            var bg = (idx % 2 === 0) ? '#0d1117' : '#121922';
            return '<div style="background:' + bg + ';border:1px solid #21262d;border-radius:8px;padding:8px 10px;margin-bottom:6px;box-sizing:border-box;">' +
                '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">' +
                    '<span style="display:inline-block;min-width:30px;padding:2px 8px;border-radius:999px;background:#12263a;color:#58a6ff;font-weight:700;font-size:12px;text-align:center;">' + escapeHtml(String(juzNo)) + '</span>' +
                    '<div style="flex:1;min-width:0;">' +
                        '<div style="font-size:12.5px;color:#e6edf3;font-weight:600;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(nameEn) + '</div>' +
                        (nameTa ? '<div style="font-size:10.5px;color:#8b949e;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(nameTa) + '</div>' : '') +
                    '</div>' +
                '</div>' +
                '<div style="border-top:1px dashed #30363d;margin:4px 0 4px;"></div>' +
                '<div style="font-size:11px;line-height:1.3;">' +
                    (juzAr ? '<div style="color:#d2a8ff;font-weight:600;margin-bottom:1px;">' + escapeHtml(juzAr) + '</div>' : '') +
                    '<div style="color:#c9d1d9;">' + escapeHtml(juzEn) + (juzTa ? ' <span style="color:#6e7681;">•</span> <span style="color:#8b949e;">' + escapeHtml(juzTa) + '</span>' : '') + '</div>' +
                '</div>' +
            '</div>';
        }
        var left = rows.slice(0, 15).map(function(r,i){ return buildPairItem(r,i); }).join('');
        var right = rows.slice(15).map(function(r,i){ return buildPairItem(r,i+15); }).join('');
        var nominated = (cur.en || '') + (cur.ta ? ' / ' + cur.ta : '');
        // A4 portrait @96dpi ~ 794x1123. Two columns (15 + 15) for compact fit.
        var html = '<div style="width:794px;min-height:1123px;background:#0d1117;padding:30px 32px 22px;box-sizing:border-box;font-family:Poppins,Arial,sans-serif;color:#e6edf3;position:relative;display:flex;flex-direction:column;">' +
            '<div style="position:absolute;left:0;top:0;right:0;height:6px;background:linear-gradient(90deg,#1f6feb,#58a6ff,#79c0ff);"></div>' +
            '<div style="text-align:center;margin-bottom:10px;">' +
                '<div style="font-size:21px;font-weight:700;color:#e6edf3;letter-spacing:0.3px;">Inainthu Othuvom</div>' +
                '<div style="font-size:12.5px;color:#8b949e;margin-top:1px;">இணைந்து ஓதுவோம்</div>' +
            '</div>' +
            '<div style="background:#161b22;border:1px solid #30363d;border-radius:12px;padding:10px 14px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:16px;">' +
                '<div>' +
                    '<div style="font-size:10.5px;color:#8b949e;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:2px;">Reading Assignment / வாசிப்பு பட்டியல்</div>' +
                    '<div style="font-size:17px;font-weight:700;color:#79c0ff;">' + escapeHtml(range) + '</div>' +
                '</div>' +
                '<div style="text-align:right;">' +
                    '<div style="font-size:10.5px;color:#8b949e;margin-bottom:1px;">This Week\'s Hadiya</div>' +
                    '<div style="font-size:12.5px;color:#e6edf3;font-weight:600;max-width:300px;line-height:1.25;">' + escapeHtml(nominated) + '</div>' +
                '</div>' +
            '</div>' +
            '<div style="flex:1 0 auto;display:flex;gap:10px;align-items:flex-start;">' +
                '<div style="flex:1;min-width:0;">' + left + '</div>' +
                '<div style="flex:1;min-width:0;">' + right + '</div>' +
            '</div>' +
            '<div style="margin-top:8px;display:flex;justify-content:space-between;color:#6e7681;font-size:10px;">' +
                '<span>Inainthu Othuvom</span><span>' + escapeHtml(range) + '</span>' +
            '</div>' +
        '</div>';
        var wrap = document.createElement('div');
        wrap.innerHTML = html;
        var content = wrap.firstElementChild || wrap;
        openCapturePreview(content, { bgColor: '#0d1117', scale: 2, successMsg: 'Reading list image copied!' });
    }).withFailureHandler(function(e){
        var msg = (e && e.message) ? e.message : (typeof e === 'string' ? e : 'Failed to load reading list.');
        showSnackbar(msg, true);
    }).getWeeklyReport(dateForReport);
}
