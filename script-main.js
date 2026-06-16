let currentActiveUserId = null;
let currentActiveRawDate = null;
let currentActiveJuzNumber = null;
let currentSupportingUserId = null;
let rawReportData = [];
let currentHadiyaDetails = null; // Store Hadiya details locally for copying
let bulkMode = false;
let selectedUserIds = new Set();
let bulkAvailableData = [];
let searchVisible = false;

function resetMainStatusBtns() {
    ['completedActionBtn','recitingActionBtn','exceptionActionBtn'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.style.display = '';
    });
}
function resetSupportStatusBtns() {
    ['supportCompletedBtn','supportRecitingBtn'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.style.display = '';
    });
}
let bulkSelectedStatus = '';
let sortColumn = 'name';
let sortAsc = true;

// Hold local reference copy to restore upon cancels
let fetchedStateCache = null;

let userListData = [];
let allowedUserData = [];

var _connBackoff = [10, 30, 60, 120, 300];
var _connAttempt = 0;
var _connTimer = null;
var _connOnline = navigator.onLine !== false;

function initConnMonitor() {
    window.addEventListener('online', function() { if (!_connOnline) { _connOnline = true; onConnRestored(); } });
    window.addEventListener('offline', function() { if (_connOnline) { _connOnline = false; onConnLost(); } });
    if (!_connOnline) { onConnLost(); return; }
    setInterval(function() { if (_connOnline) pingSupabase(); }, 30000);
}

function onConnLost() {
    _connAttempt = 0; _connOnline = false; updateConnBanner(); scheduleConnCheck();
    if (typeof resetAssignmentDetails === 'function') resetAssignmentDetails();
    closeResult();
    var overlay = document.getElementById('connOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'connOverlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;flex-direction:column;';
        var msg = document.createElement('div');
        msg.id = 'connOverlayMsg';
        msg.style.cssText = 'color:#fff;font-size:1.1rem;text-align:center;padding:20px;';
        overlay.appendChild(msg);
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
    document.getElementById('connOverlayMsg').textContent = 'No internet connection. Retrying in ' + _connBackoff[0] + 's...';
}

function onConnRestored() {
    _connOnline = true; _connAttempt = 0;
    if (_connTimer) { clearTimeout(_connTimer); _connTimer = null; }
    updateConnBanner();
    var overlay = document.getElementById('connOverlay');
    if (overlay) overlay.style.display = 'none';
    var d = document.getElementById('dateInput');
    if (d && d.value) {
        if (typeof refreshUserDropdown === 'function') refreshUserDropdown(d.value);
        if (typeof fetchHadiyaDetails === 'function') fetchHadiyaDetails(d.value);
        if (typeof fetchAndRenderReport === 'function') fetchAndRenderReport(d.value);
        if (typeof fetchAndDisplayNotifications === 'function') fetchAndDisplayNotifications();
    }
}

function scheduleConnCheck() {
    if (_connTimer) { clearTimeout(_connTimer); _connTimer = null; }
    if (_connOnline) return;
    var idx = Math.min(_connAttempt, _connBackoff.length - 1);
    _connTimer = setTimeout(function() { pingSupabase(); }, _connBackoff[idx] * 1000);
}

function pingSupabase() {
    _supabase.from('notifications').select('id', { count: 'exact', head: true }).limit(0).then(function(r) {
        if (!_connOnline && !r.error) { _connOnline = true; onConnRestored(); }
        else if (_connOnline && r.error) { _connOnline = false; onConnLost(); }
        else if (!_connOnline && r.error) { _connAttempt++; updateConnBanner(); scheduleConnCheck(); }
    }).catch(function() {
        if (_connOnline) { _connOnline = false; onConnLost(); }
        else { _connAttempt++; updateConnBanner(); scheduleConnCheck(); }
    });
}

function updateConnBanner() {
    var banner = document.getElementById('connBanner');
    if (!banner) return;
    if (!_connOnline) {
        var idx = Math.min(_connAttempt, _connBackoff.length - 1);
        var msg = 'No internet. Retrying in ' + _connBackoff[idx] + 's...';
        banner.style.display = 'block';
        banner.textContent = msg;
        var overlayMsg = document.getElementById('connOverlayMsg');
        if (overlayMsg) overlayMsg.textContent = msg;
    } else {
        banner.style.display = 'none';
    }
}

function refreshUserDropdown(dateVal) {
    const prevId = document.getElementById('userSelect').value;
    var cu = window.currentUser ? window.currentUser() : null;
    window.appApi.withSuccessHandler(function(users) {
        userListData = users;
        var allIds = {};
        users.forEach(function(u) { allIds[u.id] = true; });
        if (cu && cu.role !== 'admin') {
            document.getElementById('userSearch').disabled = true;
            var myMember = users.filter(function(u) { return String(u.custom_id) === String(cu.customId); });
            var myMemberId = myMember.length > 0 ? myMember[0].id : null;
            var allowed = myMember.slice();
            if (myMemberId) {
                var monday = normalizeToWeekStart(dateVal);
                var effDate = myMember[0].effective_date;
                if (effDate && monday < normalizeToWeekStart(effDate)) {
                    autoSelectMember(myMember);
                    document.getElementById('submitBtn').disabled = true;
                    allowedUserData = allowed;
                    var allowedIds = {};
                    allowed.forEach(function(a) { allowedIds[a.id] = true; });
                    applyDropdown(allowed, allowedIds);
                    showSnackbar('You were not active during this week. Your effective date is ' + effDate.slice(0,10) + '.', true);
                    return;
                }
                _supabase.from('weekly_status').select('member_id').eq('week_start', monday).eq('supported_by_id', myMemberId).then(function(rSup) {
                    if (rSup.data) {
                        var supIds = {};
                        rSup.data.forEach(function(s) { supIds[s.member_id] = true; });
                        allowed = allowed.concat(users.filter(function(u) { return supIds[u.custom_id]; }));
                    }
                    allowedUserData = allowed;
                    var allowedIds = {};
                    allowed.forEach(function(a) { allowedIds[a.id] = true; });
                    applyDropdown(allowed, allowedIds);
                    autoSelectMember(myMember);
                });
            } else {
                _supabase.from('members').select('name_en,name_ta,effective_date').eq('custom_id', String(cu.customId)).order('effective_date', { ascending: false }).limit(1).maybeSingle().then(function(r) {
                    if (r.data) {
                        var display = (r.data.name_en || '') + ' | ' + (r.data.name_ta || '');
                        document.getElementById('userSearch').value = display;
                    } else {
                        document.getElementById('userSearch').value = cu.name || cu.customId || '';
                    }
                    document.getElementById('userSelect').value = '';
                    document.getElementById('submitBtn').disabled = true;
                    var effMsg = r.data && r.data.effective_date ? ' Your effective date is ' + r.data.effective_date.slice(0,10) + '.' : '';
                    showSnackbar('You are not active during this selected week.' + effMsg, true);
                });
                allowedUserData = [];
                applyDropdown([], {});
            }
        } else {
            allowedUserData = users;
            applyDropdown(users, allIds);
        }
        function applyDropdown(filtered, validIds) {
            const dropdown = document.getElementById('userDropdown');
            dropdown.innerHTML = filtered.map(u =>
                `<div class="opt" data-id="${u.id}" onmousedown="selectUserOption('${u.id}','${(u.english + ' | ' + u.tamil).replace(/'/g, "\\'")}')">${u.english} | ${u.tamil}</div>`
            ).join('');
            if (prevId && validIds[prevId]) {
                document.getElementById('userSelect').value = prevId;
            } else {
                document.getElementById('userSelect').value = '';
            }
        }
        function autoSelectMember(members) {
            if (members && members.length > 0) {
                var m = members[0];
                var display = m.english + ' | ' + m.tamil;
                document.getElementById('userSearch').value = display;
                document.getElementById('userSelect').value = m.id;
                document.getElementById('submitBtn').disabled = false;
            }
        }
    }).withFailureHandler(function(err) {
        console.error('refreshUserDropdown error:', err);
        var msg = (err && err.message) ? err.message : (typeof err === 'string' ? err : 'Failed to load users. Is the database missing the effective_date column?');
        showSnackbar('Error loading users: ' + msg, true);
    }).getUserList(dateVal);
}

function goToCurrentWeek() {
    var now = new Date();
    var IST_MS = 5.5 * 3600000;
    var ist = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + IST_MS);
    var p = function(n) { return String(n).padStart(2, '0'); };
    var val = ist.getFullYear() + '-' + p(ist.getMonth() + 1) + '-' + p(ist.getDate()) + 'T' + p(ist.getHours()) + ':' + p(ist.getMinutes());
    document.getElementById('dateInput').value = val;
    resetAssignmentDetails();
}

window.onload = function() {
    initConnMonitor();
    (function(){var now=new Date();var IST_MS=5.5*3600000;var ist=new Date(now.getTime()+now.getTimezoneOffset()*60000+IST_MS);var p=function(n){return String(n).padStart(2,'0')};document.getElementById('dateInput').value=ist.getFullYear()+'-'+p(ist.getMonth()+1)+'-'+p(ist.getDate())+'T'+p(ist.getHours())+':'+p(ist.getMinutes());})();
    const today = document.getElementById('dateInput').value;
    refreshUserDropdown(today);
    fetchHadiyaDetails(today);
    document.getElementById('dateInput').addEventListener('change', resetAssignmentDetails);
    history.pushState(null, null, location.href);
    document.addEventListener('focusin', function(e) {
        if (e.target.closest('.modal')) {
            var modal = e.target.closest('.modal');
            setTimeout(function() { modal.scrollTop = 0; }, 400);
        }
    });
};

var backPressCount = 0;
var backPressTimer = null;
var lastBack = 0;
function handleBack(src) {
    var now = Date.now();
    if (now - lastBack < 400) return;
    lastBack = now;
    var modals = document.querySelectorAll('.modal');
    var topModal = null;
    for (var i = modals.length - 1; i >= 0; i--) {
        if (modals[i].style.display === 'flex') { topModal = modals[i]; break; }
    }
    if (topModal) {
        var closeBtns = topModal.querySelectorAll('.close-btn');
        var closeBtn = closeBtns[0];
        if (closeBtn && closeBtn.style.position === 'static') closeBtn.click();
        else if (closeBtns.length > 0) closeBtns[closeBtns.length - 1].click();
        backPressCount = 0;
        return;
    }
    backPressCount++;
    if (backPressCount === 1) {
        goToCurrentWeek();
        clearTimeout(backPressTimer);
        backPressTimer = setTimeout(function() { backPressCount = 0; }, 2000);
    } else if (backPressCount >= 2) {
        try { if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.App) Capacitor.Plugins.App.exitApp(); } catch(e) {}
    }
}
window.addEventListener('popstate', handleBack);
if (!window.location.hash) {
    window.location.hash = 'x';
}
var firstHash = true, busyHash = false;
window.addEventListener('hashchange', function() {
    if (firstHash) { firstHash = false; return; }
    if (busyHash) { busyHash = false; return; }
    handleBack('hash');
    if (backPressCount >= 2) {
        try { if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.App) Capacitor.Plugins.App.exitApp(); } catch(e) {}
        return;
    }
    busyHash = true;
    window.location.hash = 'x';
});
(function pollCapacitor() {
    if (typeof Capacitor !== 'undefined' && Capacitor.isNative && Capacitor.Plugins && Capacitor.Plugins.App) {
        Capacitor.Plugins.App.addListener('backButton', function() {
            handleBack('cap');
            if (backPressCount >= 2) {
                try { Capacitor.Plugins.App.exitApp(); } catch(e) {}
            }
        });
    } else {
        setTimeout(pollCapacitor, 100);
    }
})();

function resetAssignmentDetails() {
    document.getElementById('result').style.display = "none";
    currentActiveUserId = null;
    currentActiveRawDate = null;
    currentActiveJuzNumber = null;
    fetchedStateCache = null;
    document.getElementById('hadiyaBox').classList.add('hadiya-loading');
    const nextHadiyaLockBanner = document.getElementById('nextHadiyaLockBanner');
    if (nextHadiyaLockBanner) nextHadiyaLockBanner.style.display = "none";
    var d = document.getElementById('dateInput').value;
    if (d) {
        refreshUserDropdown(d);
        fetchHadiyaDetails(d);
    }
}

function updateStatusBoxColorByValue(val) {
    const box = document.getElementById('statusBoxContainer');
    box.classList.remove('state-progress', 'state-completed', 'state-exception');
    
    if (!val || val === "Reciting" || val === "Not Started") {
        box.classList.add('state-progress');
    } else if (val === "Completed") {
        box.classList.add('state-completed');
    } else if (val === "Exception Raised") {
        box.classList.add('state-exception');
    }
}

function isSelectedDateInFuture() {
    const selectedDateStr = document.getElementById('dateInput').value;
    if (!selectedDateStr) return false;
    
    const selectedDate = new Date(selectedDateStr);
    selectedDate.setHours(0,0,0,0,0);
    
    const today = new Date();
    today.setHours(0,0,0,0,0);
    
    return selectedDate > today;
}

function isNonAdminPastWeek() {
    var cu = window.currentUser ? window.currentUser() : null;
    if (cu && cu.role === 'admin') return false;
    var selectedVal = document.getElementById('dateInput').value;
    if (!selectedVal) return false;
    var selectedWeek = normalizeToWeekStart(selectedVal);
    var currentWeek = normalizeToWeekStart(new Date());
    return selectedWeek !== currentWeek;
}

function isPastNextHadiyaStart() {
    const hadiya = currentHadiyaDetails;
    if (!hadiya || !hadiya.current || !hadiya.current.nextStartISO) {
        return false;
    }
    if (hadiya.currentIndex !== hadiya.todayIndex) {
        return false;
    }
    var selectedVal = document.getElementById('dateInput').value;
    if (!selectedVal) return false;
    var selDate = new Date(selectedVal);
    if (isNaN(selDate.getTime())) return false;
    var IST_OFFSET = 5.5 * 3600000;
    var selectedIST = new Date(selDate.getTime() + selDate.getTimezoneOffset() * 60000 + IST_OFFSET);

    var nextStart = new Date(hadiya.current.nextStartISO);
    var s = String(hadiya.current.nextStartISO).trim().replace(' ', 'T');
    var hasTimezone = s.endsWith('Z') || /[\+\-]\d{2}:\d{2}$/.test(s) || /[\+\-]\d{4}$/.test(s);

    if (!hasTimezone && !isNaN(nextStart.getTime())) {
        var p = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
        if (p) {
            nextStart = new Date(+p[1], +p[2]-1, +p[3], +p[4], +p[5], +(p[6]||0));
        }
    }

    return selectedIST.getTime() >= nextStart.getTime();
}

function configureStatusEditLock(statusVal, resData) {
    const unlockLink = document.getElementById('unlockBtn');
    const closeEditLink = document.getElementById('closeEditBtn');
    const buttonsGroup = document.getElementById('statusButtonsGroup');
    const textDisplay = document.getElementById('statusTextDisplay');
    const mainSupportWidget = document.getElementById('mainSupportWidget');
    const supportBtnsGroup = document.getElementById('supportButtonsGroup');
    const unlockSupportLink = document.getElementById('unlockSupportBtn');
    const closeSupportEditLink = document.getElementById('closeSupportEditBtn');
    const futureLockBanner = document.getElementById('futureScheduleLockBanner');
    const mainTimeToggle = document.getElementById('mainTimeToggle');
    const mainTimeRow = document.getElementById('mainTimePickerRow');
    const supportTimeToggle = document.getElementById('supportTimeToggle');
    const supportTimeRow = document.getElementById('supportTimePickerRow');

    closeEditLink.style.display = "none";
    closeSupportEditLink.style.display = "none";
    
    const nextHadiyaLockBanner = document.getElementById('nextHadiyaLockBanner');
    if (nextHadiyaLockBanner) nextHadiyaLockBanner.style.display = "none";

    if (isSelectedDateInFuture()) {
        unlockLink.style.display = "none";
        buttonsGroup.style.display = "none";
        textDisplay.style.display = "none";
        mainSupportWidget.style.display = "none";
        futureLockBanner.style.display = "block";
        if (mainTimeToggle) { mainTimeToggle.style.display = 'none'; mainTimeRow.style.display = 'none'; mainTimeToggle.classList.remove('active'); }
        if (supportTimeToggle) { supportTimeToggle.style.display = 'none'; supportTimeRow.style.display = 'none'; supportTimeToggle.classList.remove('active'); }
        updateStatusBoxColorByValue("Reciting");
        return;
    }

    futureLockBanner.style.display = "none";
    
    if (isNonAdminPastWeek()) {
        unlockLink.style.display = "none";
        unlockSupportLink.style.display = "none";
        buttonsGroup.style.display = "none";
        supportBtnsGroup.style.display = "none";
        mainSupportWidget.style.display = "none";
        if (mainTimeToggle) { mainTimeToggle.style.display = 'none'; mainTimeRow.style.display = 'none'; mainTimeToggle.classList.remove('active'); }
        if (supportTimeToggle) { supportTimeToggle.style.display = 'none'; supportTimeRow.style.display = 'none'; supportTimeToggle.classList.remove('active'); }
        if (!statusVal || statusVal === "Not Started") {
            textDisplay.innerText = "Not Started \n தொடங்கப்படவில்லை";
            textDisplay.style.display = "block";
            updateStatusBoxColorByValue("Reciting");
        } else if (statusVal === "Reciting" || statusVal === "Completed" || statusVal === "Exception Raised") {
            var txt = statusVal === "Reciting" ? "Reciting \n ஓதிக்கொண்டிருக்கிறேன் 🔄" : statusVal === "Completed" ? "Completed \n நிறைவேற்றப்பட்டது ✅" : "Exception Raised \n விதிவிலக்கு ⚠️";
            textDisplay.innerText = txt;
            textDisplay.style.display = "block";
            updateStatusBoxColorByValue(statusVal);
        } else {
            updateStatusBoxColorByValue(statusVal);
        }
        return;
    }

    if (isPastNextHadiyaStart()) {
        unlockLink.style.display = "none";
        unlockSupportLink.style.display = "none";
        buttonsGroup.style.display = "none";
        supportBtnsGroup.style.display = "none";
        textDisplay.style.display = "none";
        mainSupportWidget.style.display = "none";
        if (nextHadiyaLockBanner) {
            nextHadiyaLockBanner.innerHTML = "🔒 Next Hadiya has started. Status updates are now locked for this week.<br>அடுத்த ஹதியா தொடங்கியுள்ளது. இந்த வாரத்தின் நிலை புதுப்பிக்க முடியாமல்.";
            nextHadiyaLockBanner.style.display = "block";
        }
        if (mainTimeToggle) { mainTimeToggle.style.display = 'none'; mainTimeRow.style.display = 'none'; mainTimeToggle.classList.remove('active'); }
        if (supportTimeToggle) { supportTimeToggle.style.display = 'none'; supportTimeRow.style.display = 'none'; supportTimeToggle.classList.remove('active'); }
        updateStatusBoxColorByValue("Reciting");
        return;
    }

    if (!statusVal || statusVal === "Not Started") {
        statusVal = "Reciting";
    }

    if (statusVal === "Reciting") {
        unlockLink.style.display = "none";
        resetMainStatusBtns();
        buttonsGroup.style.display = "flex"; 
        document.getElementById('recitingActionBtn').style.display = 'none';
        textDisplay.innerText = "Reciting \n ஓதிக்கொண்டிருக்கிறேன் 🔄";
        textDisplay.style.display = "block";
        mainSupportWidget.style.display = "none";
        if (mainTimeToggle) { mainTimeToggle.style.display = 'inline-flex'; }
        if (supportTimeToggle) { supportTimeToggle.style.display = 'none'; supportTimeRow.style.display = 'none'; supportTimeToggle.classList.remove('active'); }
        updateStatusBoxColorByValue("Reciting");
    } else {
        unlockLink.style.display = "inline-block";
        buttonsGroup.style.display = "none";
        if (mainTimeToggle) { mainTimeToggle.style.display = 'none'; mainTimeRow.style.display = 'none'; mainTimeToggle.classList.remove('active'); }
        
        if (statusVal === "Completed") {
            textDisplay.innerText = "Completed \n நிறைவேற்றபட்டது ✓";
            mainSupportWidget.style.display = "none";
        } else if (statusVal === "Exception Raised") {
            textDisplay.innerText = "Exception Raised \n விதிவிலக்கு ⚠️";
            
            if (resData && resData.supportedByName) {
                mainSupportWidget.style.display = "block";
                let supStatus = resData.supportStatus || "Reciting";
                document.getElementById('supportDetailsBanner').innerHTML = 
                    `🤝<br><b>Backup Reader | உதவி வாசகர்:</b><br>${resData.supportedByName}<br><br>` +
                    `<b>Status | நிலை :</b> ${supStatus === "Completed" ? "Completed ✅ <br> நிறைவேற்றபட்டது" : "Reciting 🔄 <br> ஓதிக்கொண்டிருக்கிறேன்"}`;
                
                if (supStatus === "Reciting") {
                    unlockSupportLink.style.display = "none";
                    closeSupportEditLink.style.display = "none";
                    resetSupportStatusBtns();
                    supportBtnsGroup.style.display = "flex"; 
                    document.getElementById('supportRecitingBtn').style.display = 'none';
                    if (supportTimeToggle) { supportTimeToggle.style.display = 'inline-flex'; }
                } else {
                    unlockSupportLink.style.display = "inline-block";
                    resetSupportStatusBtns();
                    supportBtnsGroup.style.display = "none";
                    if (supportTimeToggle) { supportTimeToggle.style.display = 'none'; supportTimeRow.style.display = 'none'; supportTimeToggle.classList.remove('active'); }
                }

            } else if (resData) {
                mainSupportWidget.style.display = "block";
                document.getElementById('supportDetailsBanner').innerHTML = `⚠️ <b>Exception: NOT Reassigned Yet</b>`;
                supportBtnsGroup.style.display = "none";
                unlockSupportLink.style.display = "none";
                closeSupportEditLink.style.display = "none";
                if (supportTimeToggle) { supportTimeToggle.style.display = 'none'; supportTimeRow.style.display = 'none'; supportTimeToggle.classList.remove('active'); }
                
                let assignBtn = document.createElement('button');
                assignBtn.className = "btn-support-status";
                assignBtn.style.marginTop = "10px";
                assignBtn.innerText = "Assign Backup Reader\nஉதவி வாசகர் நியமனம்";
                assignBtn.onclick = function() { openReassignModal(); };
                
                let container = document.getElementById('supportDetailsBanner');
                container.innerHTML = '⚠️ <b>Exception: NOT Reassigned Yet</b>';
                container.appendChild(assignBtn);
            } else {
                if (supportTimeToggle) { supportTimeToggle.style.display = 'none'; supportTimeRow.style.display = 'none'; supportTimeToggle.classList.remove('active'); }
            }
        }
        textDisplay.style.display = "block";
    }
    updateStatusBoxColorByValue(statusVal);
}

function enableStatusEditing() {
    if (isPastNextHadiyaStart()) {
        showSnackbar("Next Hadiya has started. Status updates are locked.", true);
        return;
    }
    document.getElementById('unlockBtn').style.display = "none";
    document.getElementById('closeEditBtn').style.display = "inline-block";
    resetMainStatusBtns();
    document.getElementById('statusButtonsGroup').style.display = "flex";
    if (fetchedStateCache && fetchedStateCache.savedStatus) {
        var cur = fetchedStateCache.savedStatus === 'Not Started' ? 'Reciting' : fetchedStateCache.savedStatus;
        var idMap = {'Reciting':'recitingActionBtn','Completed':'completedActionBtn','Exception Raised':'exceptionActionBtn'};
        var btn = document.getElementById(idMap[cur]);
        if (btn) btn.style.display = 'none';
    }
    document.getElementById('statusTextDisplay').style.display = "none";
    document.getElementById('mainSupportWidget').style.display = "none";
    const mt = document.getElementById('mainTimeToggle');
    if (mt) { mt.style.display = 'inline-flex'; }
    
    const box = document.getElementById('statusBoxContainer');
    box.classList.remove('state-completed', 'state-exception');
    box.classList.add('state-progress');
    
    showSnackbar("Status edit mode unlocked!", false);
}

function cancelStatusEditing() {
    closeTimePickers();
    if (fetchedStateCache) {
        configureStatusEditLock(fetchedStateCache.savedStatus, fetchedStateCache);
        showSnackbar("Status changes cancelled.", false);
    }
}

function enableSupportStatusEditing() {
    if (isPastNextHadiyaStart()) {
        showSnackbar("Next Hadiya has started. Support status updates are locked.", true);
        return;
    }
    resetSupportStatusBtns();
    document.getElementById('supportButtonsGroup').style.display = "flex";
    if (fetchedStateCache) {
        var supCur = fetchedStateCache.supportStatus || fetchedStateCache.supportAssignmentStatus || 'Reciting';
        var supIdMap = {'Reciting':'supportRecitingBtn','Completed':'supportCompletedBtn'};
        var supBtn = document.getElementById(supIdMap[supCur]);
        if (supBtn) supBtn.style.display = 'none';
    }
    document.getElementById('unlockSupportBtn').style.display = "none";
    document.getElementById('closeSupportEditBtn').style.display = "inline-block";
    const st = document.getElementById('supportTimeToggle');
    if (st) { st.style.display = 'inline-flex'; }
    showSnackbar("Support reader edits unlocked!", false);
}

function cancelSupportStatusEditing() {
    closeTimePickers();
    if (fetchedStateCache) {
        configureStatusEditLock(fetchedStateCache.savedStatus, fetchedStateCache);
        showSnackbar("Support reader status changes cancelled.", false);
    }
}

function openUserDropdown() {
    document.getElementById('userDropdown').style.display = 'block';
}
function closeUserDropdown() {
    document.getElementById('userDropdown').style.display = 'none';
}
function filterUserOptions() {
    const q = document.getElementById('userSearch').value.toLowerCase();
    const dropdown = document.getElementById('userDropdown');
    var cu = window.currentUser ? window.currentUser() : null;
    var source = (cu && cu.role !== 'admin' && allowedUserData.length > 0) ? allowedUserData : userListData;
    const filtered = source.filter(u =>
        (u.english + ' | ' + u.tamil).toLowerCase().includes(q)
    );
    if (filtered.length === 0) {
        dropdown.innerHTML = '<div class="opt no-match">No matches found / பொருந்தவில்லை</div>';
    } else {
        dropdown.innerHTML = filtered.map(u =>
            `<div class="opt" data-id="${u.id}" onmousedown="selectUserOption('${u.id}','${(u.english + ' | ' + u.tamil).replace(/'/g, "\\'")}')">${u.english} | ${u.tamil}</div>`
        ).join('');
    }
    dropdown.style.display = 'block';
}
function selectUserOption(id, displayName) {
    document.getElementById('userSearch').value = displayName;
    document.getElementById('userSelect').value = id;
    document.getElementById('userDropdown').style.display = 'none';
    document.getElementById('submitBtn').disabled = false;
    resetAssignmentDetails();
}

const _origResetAssignment = resetAssignmentDetails;
// Redefine resetAssignmentDetails to release timers
resetAssignmentDetails = function() {
    _origResetAssignment();
    closeTimePickers();
};

let timePickerState = { main: '', support: '', report: '' };
function toggleTimePicker(area) {
    const row = document.getElementById(area + 'TimePickerRow');
    const btn = document.getElementById(area + 'TimeToggle');
    const isOpen = row.style.display !== 'none' && row.style.display !== '';
    if (isOpen) {
        row.style.display = 'none';
        btn.classList.remove('active');
    } else {
        row.style.display = 'flex';
        btn.classList.add('active');
        const input = document.getElementById(area + 'CustomTime');
        if (!input.value) {
            input.value = new Date().toISOString().slice(0, 16);
        }
    }
}
function closeTimePickers() {
    ['main', 'support', 'report', 'bulkstep2'].forEach(area => {
        const row = document.getElementById(area + 'TimePickerRow');
        const btn = document.getElementById(area + 'TimeToggle');
        if (row) row.style.display = 'none';
        if (btn) btn.classList.remove('active');
    });
}
function resetCustomTime(area) {
    const input = document.getElementById(area + 'CustomTime');
    var now = new Date();
    var pad = function(n) { return String(n).padStart(2, '0'); };
    input.value = now.getFullYear() + '-' + pad(now.getMonth()+1) + '-' + pad(now.getDate()) + 'T' + pad(now.getHours()) + ':' + pad(now.getMinutes());
}
function getCustomTime(area) {
    const input = document.getElementById(area + 'CustomTime');
    if (!input || !input.value) return '';
    return input.value.replace('T', ' ') + ':00';
}
function setCustomTime(area, dateTimeStr) {
    const input = document.getElementById(area + 'CustomTime');
    if (!input) return;
    if (dateTimeStr) {
        const m = dateTimeStr.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/);
        if (m) {
            input.value = m[1] + 'T' + m[2];
        }
    }
}

function submitQuery() {
    var id = document.getElementById('userSelect').value;
    if (!id) {
        var searchVal = document.getElementById('userSearch').value.trim();
        if (searchVal) {
            var match = userListData.find(function(x) { return (x.english + ' | ' + x.tamil).toLowerCase().includes(searchVal.toLowerCase()); });
            if (match) {
                id = match.id;
                document.getElementById('userSelect').value = id;
            }
        }
    }
    if (!id) {
        showSnackbar("Please select a member first.", true);
        document.getElementById('submitBtn').disabled = false;
        document.getElementById('loader').style.display = 'none';
        return;
    }
    const date = document.getElementById('dateInput').value;
    var curMember = userListData.find(function(x) { return String(x.id) === id; });
    var cid = curMember ? curMember.custom_id : null;
    const btn = document.getElementById('submitBtn');
    const loader = document.getElementById('loader');
    const resDiv = document.getElementById('result');

    document.getElementById('lastModLabel').innerText = "";

    btn.disabled = true;
    resDiv.style.display = "none";
    loader.style.display = "block";

    window.appApi.withSuccessHandler(function(res) {
        btn.disabled = false;
        loader.style.display = "none";
        
        if (res.error) {
            resDiv.innerHTML = `<div class="error">${res.error}</div>`;
        } else {
            currentActiveUserId = id;
            currentActiveRawDate = res.rawDate;
            currentActiveJuzNumber = res.number;
            fetchedStateCache = res; 

            document.getElementById('weekInfo').innerText = "Schedule for week of: " + res.dateFound + " | Juz " + res.number;
            document.getElementById('resAr').innerText = res.arabic;
            document.getElementById('resEn').innerText = res.english;
            document.getElementById('resTa').innerText = res.tamil;

            if (res.savedStatus) {
                configureStatusEditLock(res.savedStatus, res);
            }

            if (res.savedLastModified) {
                document.getElementById('lastModLabel').innerText = res.savedLastModified;
            }

            setCustomTime('main', res.statusTimestamp || '');
            
            // Show support assignment if user is a backup reader
            currentSupportingUserId = res.supportingUserId || null;
            var supWidget = document.getElementById('supportAssignmentWidget');
            var supDetails = document.getElementById('supportAssignmentDetails');
            var supStatusIcon = document.getElementById('supportAssignmentStatusIcon');
            if (res.supportingName && supWidget) {
                var supName = res.supportingName || '';
                var supNameTa = res.supportingNameTa || '';
                supDetails.innerHTML = '<b>' + supName + '</b>' + (supNameTa ? '<br><span style="font-size:0.75rem;color:#8b949e;">' + supNameTa + '</span>' : '');
                if (supStatusIcon) {
                    var icon = res.supportAssignmentStatus === 'Completed' ? '✅' : '🔄';
                    supStatusIcon.innerHTML = '<span style="color:#8b949e;">|</span> ' + icon;
                }
                supWidget.style.display = 'block';
            } else if (supWidget) {
                supWidget.style.display = 'none';
            }
        }
        resDiv.style.display = "block";
        resDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).withFailureHandler(function(err) {
        btn.disabled = false;
        loader.style.display = "none";
        resDiv.innerHTML = '<div class="error">Error: ' + (err.message || 'Unknown error') + '</div>';
        resDiv.style.display = "block";
    }).findJuzAssignment(id, cid, date);
}

function submitDirectStatus(statusVal) {
    const id = document.getElementById('userSelect').value;
    const dateInputVal = document.getElementById('dateInput').value;
    const weekVal = (currentHadiyaDetails && currentHadiyaDetails.weekStart) || dateInputVal;
    
    if (!id || !dateInputVal) {
        showSnackbar("Please select a date and name first.", true);
        return;
    }

    if (isSelectedDateInFuture()) {
        showSnackbar("You cannot modify the status of a future schedule date.", true);
        return;
    }

    if (isPastNextHadiyaStart()) {
        showSnackbar("Next Hadiya has started. Status updates are locked for this week.", true);
        return;
    }

    const compBtn = document.getElementById('completedActionBtn');
    const recBtn = document.getElementById('recitingActionBtn');
    const excBtn = document.getElementById('exceptionActionBtn');
    
    compBtn.disabled = true;
    recBtn.disabled = true;
    excBtn.disabled = true;

    const customTime = getCustomTime('main');
    window.appApi.withSuccessHandler(function(response) {
        compBtn.disabled = false;
        recBtn.disabled = false;
        excBtn.disabled = false;
        
        if (response.success) {
            if (fetchedStateCache) {
                fetchedStateCache.savedStatus = statusVal;
                if (statusVal !== 'Exception Raised') {
                    fetchedStateCache.supportedByName = '';
                    fetchedStateCache.supportStatus = '';
                }
            }
            closeTimePickers();
            if (fetchedStateCache) {
                configureStatusEditLock(fetchedStateCache.savedStatus, fetchedStateCache);
            }
            if (response.noChange) {
                showSnackbar("No changes detected. Tracker was not modified.", false);
                if (statusVal === "Exception Raised") {
                    openReassignModal();
                }
            } else {
                showSnackbar("Status updated successfully!", false);
                setTimeout(function() {
                    submitQuery();
                    fetchHadiyaDetails(dateInputVal);
                    if (typeof fetchAndRenderReport === 'function') fetchAndRenderReport(dateInputVal);
                }, 300);
            }
        } else {
            showSnackbar("Failed to update status: " + response.error, true);
        }
    }).updateWeeklyStatus(id, weekVal, statusVal, customTime);
}

function submitSupportStatusDirect(newSupStatus) {
    if (isPastNextHadiyaStart()) {
        showSnackbar("Next Hadiya has started. Support status updates are locked.", true);
        return;
    }
    const dateInputVal = document.getElementById('dateInput').value;
    const weekVal = (currentHadiyaDetails && currentHadiyaDetails.weekStart) || dateInputVal;
    const compBtn = document.getElementById('supportCompletedBtn');
    const recBtn = document.getElementById('supportRecitingBtn');

    compBtn.disabled = true;
    recBtn.disabled = true;

    const customTime = getCustomTime('support');
    window.appApi.withSuccessHandler(function(response) {
        compBtn.disabled = false;
        recBtn.disabled = false;
        if (response.success) {
            showSnackbar("Support Reciting status updated to " + newSupStatus, false);
            setTimeout(function() {
                submitQuery(); 
                fetchHadiyaDetails(dateInputVal);
                if (typeof fetchAndRenderReport === 'function') fetchAndRenderReport(dateInputVal);
            }, 300);
        } else {
            showSnackbar("Failed to update support status: " + response.error, true);
        }
    }).updateSupportStatus(currentActiveUserId, weekVal, newSupStatus, customTime);
}

function submitSupportFromAssignment(newSupStatus) {
    if (!currentSupportingUserId) { showSnackbar("No support assignment found.", true); return; }
    if (isPastNextHadiyaStart()) {
        showSnackbar("Next Hadiya has started. Support status updates are locked.", true);
        return;
    }
    const dateInputVal = document.getElementById('dateInput').value;
    const weekVal = (currentHadiyaDetails && currentHadiyaDetails.weekStart) || dateInputVal;
    var btns = document.querySelectorAll('#supportAssignmentModal .modal-content button');
    btns.forEach(function(b) { b.disabled = true; });
    const customTime = getCustomTime('support');
    window.appApi.withSuccessHandler(function(response) {
        btns.forEach(function(b) { b.disabled = false; });
        if (response.success) {
            showSnackbar("Support status updated to " + newSupStatus, false);
            closeSupportAssignmentModal();
            if (fetchedStateCache) {
                fetchedStateCache.supportAssignmentStatus = newSupStatus;
                var supDetails = document.getElementById('supportAssignmentDetails');
                var supStatusIcon = document.getElementById('supportAssignmentStatusIcon');
                if (supDetails) {
                    var supName = fetchedStateCache.supportingName || '';
                    var supNameTa = fetchedStateCache.supportingNameTa || '';
                    supDetails.innerHTML = '<b>' + supName + '</b>' + (supNameTa ? '<br><span style="font-size:0.75rem;color:#8b949e;">' + supNameTa + '</span>' : '');
                }
                if (supStatusIcon) {
                    var icon = newSupStatus === 'Completed' ? '✅' : '🔄';
                    supStatusIcon.innerHTML = '<span style="color:#8b949e;">|</span> ' + icon;
                }
            }
        } else {
            showSnackbar("Failed: " + (response.error || 'Error'), true);
        }
    }).updateSupportStatus(currentSupportingUserId, weekVal, newSupStatus, customTime);
}

function openSupportAssignmentModal() {
    console.log('=== DEBUG openSupportAssignmentModal called ===');
    var modal = document.getElementById('supportAssignmentModal');
    console.log('modal element:', modal);
    if (modal) {
        // Fix: ensure modal is a direct child of body (not nested inside hadiya menu)
        if (modal.parentElement !== document.body) {
            console.log('FIX: moving supportAssignmentModal back to body');
            document.body.appendChild(modal);
        }
        console.log('modal className:', modal.className);
        console.log('modal classList:', modal.classList.toString());
        console.log('modal computed display before:', getComputedStyle(modal).display);
        console.log('modal inline style before:', modal.getAttribute('style'));
        console.log('modal offsetParent before:', modal.offsetParent);
        console.log('modal z-index:', getComputedStyle(modal).zIndex);
        console.log('modal position:', getComputedStyle(modal).position);
        console.log('modal visibility:', getComputedStyle(modal).visibility);
        console.log('modal opacity:', getComputedStyle(modal).opacity);
        console.log('modal parent:', modal.parentElement);
        console.log('modal parent id:', modal.parentElement ? modal.parentElement.id : 'N/A');
        console.log('modal parent tag:', modal.parentElement ? modal.parentElement.tagName : 'N/A');
        console.log('modal parent is body:', modal.parentElement === document.body);
        // Check if any ancestor has display:none
        var el = modal;
        var chain = [];
        while (el) {
            var d = getComputedStyle(el).display;
            if (d === 'none') console.log('ANCESTOR with display:none:', el.id || el.className || el.tagName, el);
            chain.push({ tag: el.tagName, id: el.id, class: el.className, display: d });
            if (el === document.body) break;
            el = el.parentElement;
        }
        console.log('ANCESTOR CHAIN:', JSON.stringify(chain));
        // Check how many modal overlays are visible
        document.querySelectorAll('.modal').forEach(function(m) {
            if (getComputedStyle(m).display !== 'none') {
                console.log('VISIBLE modal:', m.id, m.className);
            }
        });
        modal.style.display = 'flex';
        console.log('modal computed display after:', getComputedStyle(modal).display);
        console.log('modal inline style after:', modal.getAttribute('style'));
    } else {
        console.error('MODAL NOT FOUND IN DOM!');
    }
    try {
        var info = document.getElementById('supportAssignmentModalInfo');
        var juzDetails = document.getElementById('supportAssignmentJuzDetails');
        var details = document.getElementById('supportAssignmentDetails');
        console.log('info element:', info, 'juzDetails:', juzDetails, 'details:', details);
        if (details && info) {
            info.innerHTML = '<div style="font-weight:600;font-size:1rem;color:#e6edf3;">' + details.innerHTML + '</div>';
        }
        if (typeof fetchedStateCache !== 'undefined' && fetchedStateCache && info && juzDetails) {
            var statusTxt = fetchedStateCache.supportAssignmentStatus === 'Completed' ? '✅ Completed / நிறைவேற்றப்பட்டது' : '🔄 Reciting / ஓதிக்கொண்டிருக்கிறேன்';
            info.innerHTML += '<div style="color:#8b949e;font-size:0.8rem;margin-top:6px;padding-top:6px;border-top:1px solid #30363d;">' + statusTxt + '</div>';
            juzDetails.innerHTML =
                '<div><span class="num-badge" style="background:#1c2d35;color:#58a6ff;font-weight:600;font-size:0.8rem;padding:3px 8px;border-radius:4px;display:inline-block;">Juz ' + fetchedStateCache.supportingJuz + '</span></div>' +
                '<div style="font-size:1.05rem;font-weight:600;color:#a5b4fc;margin:4px 0 2px;">' + (fetchedStateCache.supportingJuzAr || '') + '</div>' +
                '<div style="font-size:0.85rem;color:#58a6ff;">' + (fetchedStateCache.supportingJuzEn || '') + '</div>' +
                '<div style="font-size:0.85rem;color:#c9d1d9;">' + (fetchedStateCache.supportingJuzTa || '') + '</div>';
        }
    } catch(e) {
        console.error('openSupportAssignmentModal error:', e);
    }
    // Check if modal gets hidden shortly after
    var checkModal = document.getElementById('supportAssignmentModal');
    if (checkModal) {
        var initialDisplay = getComputedStyle(checkModal).display;
        setTimeout(function() {
            var laterDisplay = getComputedStyle(checkModal).display;
            console.log('DEBUG: modal display after 500ms:', laterDisplay, '(was:', initialDisplay + ')');
        }, 500);
    }
}

function closeSupportAssignmentModal() {
    document.getElementById('supportAssignmentModal').style.display = 'none';
}

var supportCandData = [];

function openReassignModal() {
    const modal = document.getElementById('reassignModal');
    const searchInput = document.getElementById('supportUserSearch');
    const dropdown = document.getElementById('supportCandDropdown');
    const hiddenInput = document.getElementById('supportUserSelect');
    const metaText = document.getElementById('reassignMetaText');
    const reassignBtn = document.getElementById('reassignBtn');
    const dateVal = (currentHadiyaDetails && currentHadiyaDetails.weekStart) || document.getElementById('dateInput').value;

    searchInput.value = '';
    hiddenInput.value = '';
    dropdown.innerHTML = '<div class="opt no-match" style="padding:20px;">Loading available candidates...</div>';
    searchInput.disabled = true;
    reassignBtn.disabled = true;
    modal.style.display = "flex";

    let originalName = document.getElementById('userSearch').value;
    metaText.innerHTML = `An exception has been registered.<br><br>விதிவிலக்கு பதிவு செய்யப்பட்டுள்ளது<br><br><b>Juz ${currentActiveJuzNumber}</b><br><b>Original Reader:</b> ${originalName}`;

    window.appApi.withSuccessHandler(function(candidates) {
        supportCandData = candidates;
        searchInput.disabled = false;
        reassignBtn.disabled = false;
        searchInput.focus();
        filterSupportCandidates();
    }).getAvailableSupportUsers(dateVal, currentActiveUserId);
}

function openSupportCandDropdown() {
    document.getElementById('supportCandDropdown').style.display = 'block';
    filterSupportCandidates();
}
function closeSupportCandDropdown() {
    document.getElementById('supportCandDropdown').style.display = 'none';
}
function filterSupportCandidates() {
    const q = document.getElementById('supportUserSearch').value.toLowerCase();
    const dropdown = document.getElementById('supportCandDropdown');
    if (supportCandData.length === 0) {
        dropdown.innerHTML = '<div class="opt no-match" style="padding:20px;">No readers available</div>';
        dropdown.style.display = 'block';
        return;
    }
    const filtered = supportCandData.filter(c =>
        (c.english + ' | ' + c.tamil).toLowerCase().includes(q)
    );
    if (filtered.length === 0) {
        dropdown.innerHTML = '<div class="opt no-match">No matches found / பொருந்தவில்லை</div>';
    } else {
        dropdown.innerHTML = filtered.map(c =>
            `<div class="opt" data-id="${c.id}" onmousedown="selectSupportCandidate('${c.id}','${(c.english + ' | ' + c.tamil).replace(/'/g, "\\'")}')">${c.english} | ${c.tamil}</div>`
        ).join('');
    }
    dropdown.style.display = 'block';
}
function selectSupportCandidate(id, displayName) {
    document.getElementById('supportUserSearch').value = displayName;
    document.getElementById('supportUserSelect').value = id;
    document.getElementById('supportCandDropdown').style.display = 'none';
}

function submitReassignment() {
    if (isPastNextHadiyaStart()) {
        showSnackbar("Next Hadiya has started. Reassignment is locked.", true);
        return;
    }
    const supportId = document.getElementById('supportUserSelect').value;
    const dateInputVal = document.getElementById('dateInput').value;
    const weekVal = (currentHadiyaDetails && currentHadiyaDetails.weekStart) || dateInputVal;
    const reassignBtn = document.getElementById('reassignBtn');

    if (!supportId) {
        showSnackbar("Please select a support partner first.", true);
        return;
    }

    reassignBtn.disabled = true;
    reassignBtn.innerText = "Assigning...";

    window.appApi.withSuccessHandler(function(response) {
        reassignBtn.disabled = false;
        reassignBtn.innerText = "Assign Reciting Partner";
        
            if (response.success) {
                showSnackbar("Successfully reassigned Reciting support to " + response.assignedName, false);
                closeReassignModal();
                setTimeout(function() {
                    submitQuery();
                    fetchHadiyaDetails(weekVal);
                    if (typeof fetchAndRenderReport === 'function') fetchAndRenderReport(weekVal);
                }, 300);
            } else {
            showSnackbar("Failed to reassign support: " + response.error, true);
        }
    }).reassignJuz(currentActiveUserId, weekVal, supportId);
}

function closeReassignModal() {
    document.getElementById('reassignModal').style.display = "none";
    submitQuery();
}

function closeResult() {
    document.getElementById('loader').style.display = 'none';
    resetAssignmentDetails();
}

function openReassignFromReport(userId, juzNum, rawName) {
    var enName = rawName.split('|')[0].trim();
    document.getElementById('userSearch').value = enName;
    currentActiveUserId = userId;
    currentActiveJuzNumber = juzNum;
    openReassignModal();
}

// ----------------------------------------------------------------
// Member Management
// ----------------------------------------------------------------
var memberListData = [];

function openMemberManager() {
    document.getElementById('memberManagerModal').style.display = 'flex';
    document.getElementById('memberFormFields').style.display = 'none';
    document.getElementById('memberSelectId').value = '';
    document.getElementById('memberSearch').value = '';
    document.getElementById('memberDropdown').innerHTML = '';
    loadMemberDropdown();
}
function closeMemberManager() {
    document.getElementById('memberManagerModal').style.display = 'none';
}
function loadMemberDropdown() {
    window.appApi.withSuccessHandler(function(members) {
        memberListData = members;
    }).getAllMembers();
}
function openMemberDropdown() {
    var q = document.getElementById('memberSearch').value.toLowerCase();
    var dropdown = document.getElementById('memberDropdown');
    var filtered = memberListData.filter(function(u) {
        return (u.name_en + ' | ' + u.name_ta).toLowerCase().includes(q);
    });
    if (filtered.length === 0) {
        dropdown.innerHTML = '<div class="opt no-match">No matches / பொருந்தவில்லை</div>';
    } else {
        dropdown.innerHTML = filtered.map(function(u) {
            var display = (u.name_en || '') + ' | ' + (u.name_ta || '');
            return '<div class="opt" data-id="' + u.id + '" onmousedown="selectMemberOption(\'' + u.id + '\',\'' + display.replace(/'/g, "\\'") + '\')">' + display + '</div>';
        }).join('');
    }
    dropdown.style.display = 'block';
}
function closeMemberDropdown() {
    document.getElementById('memberDropdown').style.display = 'none';
}
function filterMemberOptions() {
    openMemberDropdown();
}
function selectMemberOption(id, displayName) {
    document.getElementById('memberSearch').value = displayName;
    document.getElementById('memberSelectId').value = id;
    document.getElementById('memberDropdown').style.display = 'none';
    var m = memberListData.find(function(x) { return String(x.id) === String(id); });
    if (m) {
        document.getElementById('memberFormEditId').value = m.id;
        document.getElementById('memberFormNameEn').value = m.name_en || '';
        document.getElementById('memberFormNameTa').value = m.name_ta || '';
        document.getElementById('memberFormEffDate').value = (m.effective_date || '').slice(0, 16);
        document.getElementById('replaceSection').style.display = 'none';
        document.getElementById('memberFormFields').style.display = 'block';
    }
}
function resetMemberForm() {
    document.getElementById('memberFormEditId').value = '';
    document.getElementById('memberFormNameEn').value = '';
    document.getElementById('memberFormNameTa').value = '';
    document.getElementById('memberFormEffDate').value = '';
    document.getElementById('replaceSearch').value = '';
    document.getElementById('replaceSelectId').value = '';
    document.getElementById('replaceSection').style.display = 'block';
    document.getElementById('memberFormFields').style.display = 'block';
}
function cancelMemberForm() {
    document.getElementById('memberFormFields').style.display = 'none';
}
function openReplaceDropdown() {
    var q = document.getElementById('replaceSearch').value.toLowerCase();
    var dropdown = document.getElementById('replaceDropdown');
    var filtered = memberListData.filter(function(u) {
        return (u.name_en + ' | ' + u.name_ta).toLowerCase().includes(q);
    });
    if (filtered.length === 0) {
        dropdown.innerHTML = '<div class="opt no-match">No matches / பொருந்தவில்லை</div>';
    } else {
        dropdown.innerHTML = filtered.map(function(u) {
            var display = (u.name_en || '') + ' | ' + (u.name_ta || '');
            return '<div class="opt" data-id="' + u.id + '" onmousedown="selectReplaceOption(\'' + u.id + '\',\'' + display.replace(/'/g, "\\'") + '\')">' + display + '</div>';
        }).join('');
    }
    dropdown.style.display = 'block';
}
function closeReplaceDropdown() {
    document.getElementById('replaceDropdown').style.display = 'none';
}
function filterReplaceOptions() {
    openReplaceDropdown();
}
function selectReplaceOption(id, displayName) {
    document.getElementById('replaceSearch').value = displayName;
    document.getElementById('replaceSelectId').value = id;
    document.getElementById('replaceDropdown').style.display = 'none';
}
function saveMember() {
    var editId = document.getElementById('memberFormEditId').value;
    var nameEn = document.getElementById('memberFormNameEn').value.trim();
    var nameTa = document.getElementById('memberFormNameTa').value.trim();
    var effDateRaw = document.getElementById('memberFormEffDate').value;
    var effDate = effDateRaw ? effDateRaw + ':00' : null;
    if (!nameEn) {
        showSnackbar("Name (English) is required.", true);
        return;
    }
    if (editId) {
        // Update existing: keep current custom_id
        var cur = memberListData.find(function(x) { return String(x.id) === String(editId); });
        var cid = cur ? cur.custom_id : 1;
        window.appApi.withSuccessHandler(function(r) {
            if (r.success) { showSnackbar("Member updated!", false); loadMemberDropdown(); cancelMemberForm(); }
            else showSnackbar("Error: " + (r.error || 'unknown'), true);
        }).withFailureHandler(function(e) {
            showSnackbar("Update failed: " + (e.message || e || 'unknown'), true);
        }).updateMember(editId, nameEn, nameTa, cid, effDate);
    } else {
        // New member: add new row with same custom_id as replaced member
        var replaceId = document.getElementById('replaceSelectId').value;
        if (!replaceId) {
            showSnackbar("Please select who you are replacing.", true);
            return;
        }
        var replaced = memberListData.find(function(x) { return String(x.id) === String(replaceId); });
        if (!replaced) {
            showSnackbar("Replaced member not found.", true);
            return;
        }
        window.appApi.withSuccessHandler(function(r) {
            if (r.success) { showSnackbar("Member added!", false); loadMemberDropdown(); cancelMemberForm(); }
            else showSnackbar("Error: " + (r.error || 'unknown'), true);
        }).withFailureHandler(function(e) {
            showSnackbar("Add failed: " + (e.message || e || 'unknown'), true);
        }).addMember(nameEn, nameTa, replaced.custom_id, effDate);
    }
}
