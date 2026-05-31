function fetchHadiyaDetails(dateVal) {
    window.appApi
        .withSuccessHandler(function(res) {
            displayHadiya(res);
        })
        .withFailureHandler(function(err) {
            document.getElementById('hadiyaBox').classList.remove('hadiya-loading');
            showSnackbar("Error loading Hadiya data", true);
        })
        .getHadiyaDetails(dateVal);
}

var countdownInterval = null;
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

    var isPast = cur.deadlineISO ? new Date() >= new Date(cur.deadlineISO) : false;
    var alertEl = document.getElementById('hadiyaScheduleTimeAlert');
    alertEl.innerHTML = isPast ? '⚠️ This week is in the past.' : '';
    document.getElementById('hadiyaEditModal').style.display = 'flex';
}
function closeHadiyaEditModal() {
    document.getElementById('hadiyaEditModal').style.display = 'none';
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
    function getDL(id) { var v = document.getElementById(id).value; return v ? new Date(v).toISOString() : ''; }
    var deadlineStr = getDL('hadiyaDeadlineInput');
    var nextStr = getDL('hadiyaNextStartInput');
    if (!deadlineStr || !nextStr) { showSnackbar("Please set both date-time values.", true); return; }
    document.getElementById('hadiyaConfigSaveBtn').disabled = true;
    document.getElementById('hadiyaConfigSaveBtn').innerText = "Saving...";
    var dateVal = document.getElementById('dateInput').value;
    window.appApi.withSuccessHandler(function(r) {
        document.getElementById('hadiyaConfigSaveBtn').disabled = false;
        document.getElementById('hadiyaConfigSaveBtn').innerHTML = 'Save Schedule Times<br>நேரத்தை சேமிக்க';
        if (r.success) {
            showSnackbar("Schedule times saved!", false);
            if (dateVal) fetchHadiyaDetails(dateVal);
        } else {
            showSnackbar("Failed: " + (r.error || 'Error'), true);
        }
    }).updateHadiyaScheduleTimes(dateVal, deadlineStr, nextStr);
}

function navigateHadiya(dir) {
    var input = document.getElementById('dateInput');
    var d = new Date(input.value || new Date());
    d.setDate(d.getDate() + dir * 7);
    var p = function(n) { return String(n).padStart(2,'0'); };
    input.value = d.getFullYear() + '-' + p(d.getMonth()+1) + '-' + p(d.getDate());
    input.dispatchEvent(new Event('change'));
}

function goToCurrentWeek() {
    var input = document.getElementById('dateInput');
    var d = new Date();
    var p = function(n) { return String(n).padStart(2,'0'); };
    input.value = d.getFullYear() + '-' + p(d.getMonth()+1) + '-' + p(d.getDate());
    input.dispatchEvent(new Event('change'));
}

function displayHadiya(res) {
    var hadiyaBox = document.getElementById('hadiyaBox');
    hadiyaBox.classList.remove('hadiya-loading');
    hadiyaBox.classList.remove('current-week', 'past-week', 'future-week');
    
    if (!res || !res.current) {
        hadiyaBox.style.display = "none";
        currentHadiyaDetails = null;
        var shareBtn = document.getElementById('hadiyaShareBtn');
        if (shareBtn) { shareBtn.style.display = 'none'; }
        return;
    }
    hadiyaBox.style.display = "block";
    currentHadiyaDetails = res;
    
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
    if (isCurrentWeek) {
        hadiyaBox.classList.add('current-week');
    } else if (cur.weekEndDate && new Date(cur.weekEndDate) < new Date()) {
        hadiyaBox.classList.add('past-week');
    } else {
        hadiyaBox.classList.add('future-week');
    }

    var headerHtml = `<div class="hadiya-header">
        <div style="font-size:0.75rem; color:#7ee787; font-weight:bold;">
            <a href="#" class="hadiya-nav-arrow" onclick="event.preventDefault(); navigateHadiya(-1);">&lt;</a>
            ${cur.range}
            <a href="#" class="hadiya-nav-arrow" onclick="event.preventDefault(); navigateHadiya(1);">&gt;</a>
        </div>
        <a href="#" id="hadiyaEditBtn" class="hadiya-edit-btn" onclick="event.preventDefault(); openHadiyaEditModal();">Edit / மாற்ற</a>
    </div>`;

    var hasDedication = cur.dedicatedTo && cur.dedicatedTo !== cur.en;
    var dedName = hasDedication ? (cur.dedicatedToTa || cur.dedicatedTo) : '';

    var nomSize = hasDedication ? '0.85rem' : '1rem';
    var nameCol = `<div class="hadiya-name-col">
        <div style="font-size:${nomSize}; font-weight:600; color:#e6edf3;">${cur.en}</div>
        <div style="font-size:0.75rem; color:#8b949e;">${cur.ta}</div>
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
            counterCol = `<div class="hadiya-counter-col">
                <div class="counter-days" id="hadiyaCounterDays">--</div>
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
            `<span style="font-size:0.65rem; color:#8b949e;">${res.previous.ta}</span>`;
    } else {
        prevSec.style.display = "none";
    }
    
    const nextSec = document.getElementById('nextSection');
    if (isCurrentWeek && res.next) {
        nextSec.style.display = "block";
        document.getElementById('hadNext').innerHTML = 
            `<b style="font-size:0.65rem;">${res.next.range}</b><br>` +
            `${res.next.en}<br>` +
            `<span style="font-size:0.65rem; color:#8b949e;">${res.next.ta}</span>`;
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
    const dateVal = document.getElementById('dateInput').value;
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
    var tBtnStyle = 'background:none;border:1px solid #30363d;border-radius:4px;color:#5eead4;font-size:0.7rem;padding:4px 8px;margin-bottom:6px;margin-top:2px;cursor:pointer;';
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
                    <input type="checkbox" id="dedHasIntention${idx}" onchange="toggleIntentionFields(${idx})" ${entry.hasIntention ? 'checked' : ''} style="accent-color:#2e7d32; width:16px; height:16px;">
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
        toggleHtml = '<div style="margin-bottom:8px;"><button onclick="enableDedicationEdit()" style="background:none;border:1px solid #5eead4;border-radius:6px;color:#5eead4;padding:6px 14px;font-size:0.8rem;cursor:pointer;font-family:inherit;">✏️ Edit</button></div>';
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
        event.target.style.borderColor = '#5eead4';
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
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + GROQ_KEY },
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