let reportIsEditable = false;
let currentReportWeek = '';

function fetchAndRenderReport(dateVal, onComplete) {
    const tableBody = document.getElementById('reportTableBody');
    tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px; color:#8b949e;">Fetching status records from database...</td></tr>';

    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.filter-btn[data-filter="ALL"]')?.classList.add('active');

    window.appApi.withSuccessHandler(function(res) {
        if (res.error) {
            tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#f87171; padding:20px;">${res.error}</td></tr>`;
            if (onComplete) onComplete();
            return;
        }
        currentReportWeek = res.week || '';
        var rangeLabel = currentReportWeek;
        if (currentHadiyaDetails && currentHadiyaDetails.current && currentHadiyaDetails.current.range) {
            rangeLabel = currentHadiyaDetails.current.range;
        }
        document.getElementById('reportWeekLabel').innerText = rangeLabel;
        rawReportData = res.data;
        reportIsEditable = res.isEditable || false;
        document.querySelectorAll('.sort-indicator').forEach(el => { el.textContent = ''; el.classList.remove('active'); });
        sortColumn = 'dateLogged';
        sortAsc = false;
        applyReportFilter();
        requestAnimationFrame(function() {
            var hb = document.querySelector('.report-header-bar');
            var th = document.querySelector('.report-table thead');
            if (hb && th) th.style.top = hb.offsetHeight + 'px';
        });
        if (onComplete) onComplete();
    }).getWeeklyReport(dateVal);
}

function openReportModal() {
    const modal = document.getElementById('reportModal');
    const dateVal = document.getElementById('dateInput').value;
    const reportBtn = document.getElementById('reportBtn');

    if (!dateVal) {
        showSnackbar("Please select a date first.", true);
        return;
    }

    reportBtn.disabled = true;
    reportBtn.innerText = "Loading Report...";
    modal.style.display = "flex";

    fetchAndRenderReport(dateVal, function() {
        reportBtn.disabled = false;
        reportBtn.innerText = "View Weekly Report \n வாராந்திர அறிக்கை";
    });
}

let reportEditUserId = null;

function openReportEditModal(userId, name, currentStatus, dateLogged) {
    if (!reportIsEditable) {
        showSnackbar("Status updates are locked for this week.", true);
        return;
    }
    reportEditUserId = userId;
    document.getElementById('reportEditName').innerText = name;
    document.getElementById('reportEditCurrentStatus').innerText = currentStatus === "Not Started" ? "Reciting" : currentStatus;
    setCustomTime('report', dateLogged || '');
    document.getElementById('reportEditModal').style.display = "flex";
}

function closeReportEditModal() {
    document.getElementById('reportEditModal').style.display = "none";
    const rtr = document.getElementById('reportTimePickerRow');
    const rtt = document.getElementById('reportTimeToggle');
    if (rtr) rtr.style.display = 'none';
    if (rtt) rtt.classList.remove('active');
    reportEditUserId = null;
}

function submitReportEditStatus(newStatus) {
    if (!reportEditUserId) return;
    if (!rawReportData) return;
    
    if (!reportIsEditable) {
        showSnackbar("Status updates are locked for this week.", true);
        return;
    }
    const weekVal = currentReportWeek || document.getElementById('dateInput').value;
    const btns = document.querySelectorAll('#reportEditModal .status-btn');
    btns.forEach(b => b.disabled = true);

    window.appApi.withSuccessHandler(function(response) {
        btns.forEach(b => b.disabled = false);
        if (response.success) {
            const entry = rawReportData.find(r => r.userId === reportEditUserId);
            if (entry) {
                entry.status = newStatus;
                const customReportTime = getCustomTime('report');
                const useTs = newStatus === 'Completed' ? (customReportTime || formatCurrentTimestamp()) : '';
                entry.dateLogged = useTs;
                if (newStatus !== 'Exception Raised') {
                    entry.supportedBy = '';
                    entry.supportStatus = '';
                }
            }
            showSnackbar("Status updated: " + newStatus, false);
            closeReportEditModal();
            setTimeout(function() {
                submitQuery();
                fetchHadiyaDetails(document.getElementById('dateInput').value);
                applyReportFilter();
            }, 300);
        } else {
            showSnackbar("Failed: " + (response.error || 'Error'), true);
        }
    }).updateWeeklyStatus(reportEditUserId, weekVal, newStatus, getCustomTime('report'));
}

function updateReportCounter(filteredCount, totalCount) {
    const badge = document.getElementById('reportCountBadge');
    badge.innerText = `Count / எண்ணிக்கை - ${filteredCount}`;
}

function scrollReportToResults() {
    setTimeout(function() {
        const el = document.getElementById('reportSearchInput') || document.getElementById('reportTableWrapper');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 400);
}
function toggleSearchBar() {
    searchVisible = !searchVisible;
    const input = document.getElementById('reportSearchInput');
    input.style.display = searchVisible ? 'block' : 'none';
    if (searchVisible) {
        setTimeout(function() {
            input.focus();
            input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    } else {
        input.value = '';
        applyReportFilter();
    }
}
function toggleBulkMode() {
    bulkMode = !bulkMode;
    const btn = document.getElementById('bulkToggleBtn');
    const panel = document.getElementById('bulkPanel');
    const ths = document.querySelectorAll('.report-bulk-th');
    if (bulkMode) {
        btn.classList.add('active');
        btn.innerHTML = 'Bulk ⚡';
        panel.style.display = 'flex';
        ths.forEach(th => th.style.display = 'table-cell');
        document.getElementById('reportSearchInput').style.display = 'block';
        searchVisible = true;
    } else {
        btn.classList.remove('active');
        btn.innerHTML = 'Bulk ⚡';
        panel.style.display = 'none';
        ths.forEach(th => th.style.display = 'none');
        selectedUserIds.clear();
        document.getElementById('bulkApplyBtn').disabled = true;
        document.getElementById('bulkApplyBtn').innerText = 'Process 0';
        if (!searchVisible) {
            document.getElementById('reportSearchInput').style.display = 'none';
        }
    }
    closeTimePickers();
    applyReportFilter();
}
function toggleBulkSelect(uid, checked) {
    if (checked === undefined) {
        if (selectedUserIds.has(uid)) selectedUserIds.delete(uid);
        else selectedUserIds.add(uid);
        var cb = document.querySelector('.bulk-checkbox[data-uid="' + uid + '"]');
        if (cb) cb.checked = selectedUserIds.has(uid);
    } else {
        if (checked) selectedUserIds.add(uid);
        else selectedUserIds.delete(uid);
    }
    updateBulkApplyBtn();
}
function toggleSelectAll() {
    const allChecked = bulkAvailableData.every(r => selectedUserIds.has(r.userId));
    if (allChecked) {
        bulkAvailableData.forEach(r => selectedUserIds.delete(r.userId));
    } else {
        bulkAvailableData.forEach(r => selectedUserIds.add(r.userId));
    }
    applyReportFilter();
    updateBulkApplyBtn();
}
function updateBulkApplyBtn() {
    const btn = document.getElementById('bulkApplyBtn');
    const n = selectedUserIds.size;
    btn.disabled = n === 0;
    btn.innerText = 'Process ' + n;
}
function openBulkStep2() {
    if (selectedUserIds.size === 0) return;
    if (!rawReportData) return;
    if (!reportIsEditable) {
        showSnackbar("Status updates are locked for this week.", true);
        return;
    }
    bulkSelectedStatus = '';
    const names = [];
    rawReportData.forEach(r => {
        if (selectedUserIds.has(r.userId)) {
            const parts = r.name.split(' | ');
            names.push(parts[0] || r.name);
        }
    });
    document.getElementById('bulkStep2Info').innerHTML = `<b>${names.length}</b> record(s) selected`;
    document.getElementById('bulkStep2List').innerHTML = names.join('<br>');
    document.getElementById('bulkStep2ConfirmBtn').disabled = true;
    document.getElementById('bulkStep2Overlay').style.display = 'flex';
    document.getElementById('bulkstep2CustomTime').value = '';
}
function closeBulkStep2() {
    document.getElementById('bulkStep2Overlay').style.display = 'none';
    const row = document.getElementById('bulkstep2TimePickerRow');
    const btn = document.getElementById('bulkstep2TimeToggle');
    if (row) row.style.display = 'none';
    if (btn) btn.classList.remove('active');
}
function selectBulkStatus(status) {
    bulkSelectedStatus = status;
    const labels = {'Completed':'Completed ✓','Reciting':'Reciting 🔄','Exception Raised':'Exception ⚠️'};
    document.getElementById('bulkStep2ConfirmBtn').disabled = false;
    document.getElementById('bulkStep2ConfirmBtn').innerText = 'Continue — ' + (labels[status] || status);
    document.querySelectorAll('#bulkStep2Overlay .btn-status-completed, #bulkStep2Overlay .btn-status-reciting, #bulkStep2Overlay .btn-status-exception').forEach(b => {
        b.style.outline = b.getAttribute('onclick').includes("'" + status + "'") ? '2px solid #5eead4' : 'none';
    });
}
function openBulkConfirm() {
    if (!rawReportData) return;
    if (!reportIsEditable) {
        showSnackbar("Status updates are locked for this week.", true);
        return;
    }
    const weekVal = currentReportWeek || document.getElementById('dateInput').value;
    const names = [];
    rawReportData.forEach(r => {
        if (selectedUserIds.has(r.userId)) {
            const parts = r.name.split(' | ');
            names.push(parts[0] || r.name);
        }
    });
    const labels = {'Completed':'Completed ✓','Reciting':'Reciting 🔄','Exception Raised':'Exception ⚠️'};
    document.getElementById('bulkConfirmInfo').innerHTML =
        `<b>Status:</b> ${labels[bulkSelectedStatus] || bulkSelectedStatus}<br><b>Date:</b> ${weekVal}<br><b>Records:</b> ${names.length}`;
    document.getElementById('bulkConfirmList').innerHTML = names.join('<br>');
    document.getElementById('bulkConfirmOverlay').style.display = 'flex';
    closeBulkStep2();
}
function closeBulkConfirm() {
    document.getElementById('bulkConfirmOverlay').style.display = 'none';
}
function executeBulkUpdate() {
    const status = bulkSelectedStatus;
    const weekVal = currentReportWeek || document.getElementById('dateInput').value;
    const originalDate = document.getElementById('dateInput').value;
    const customTime = getCustomTime('bulkstep2');
    const userIds = Array.from(selectedUserIds);
    const btn = document.getElementById('bulkConfirmYesBtn');
    btn.disabled = true;
    btn.innerText = 'Updating...';
    let completed = 0, failed = 0;
    const total = userIds.length;
    function processNext(i) {
        if (i >= total) {
            btn.disabled = false;
            btn.innerText = 'Confirm / உறுதி';
            closeBulkConfirm();
            showSnackbar('Bulk update: ' + completed + ' updated, ' + failed + ' failed', failed > 0);
            if (completed > 0) {
                if (bulkMode) toggleBulkMode();
                selectedUserIds.clear();
                setTimeout(function() {
                    submitQuery();
                    fetchHadiyaDetails(originalDate);
                    fetchAndRenderReport(originalDate);
                }, 300);
            }
            return;
        }
        window.appApi.withSuccessHandler(function(res) {
            if (res.success) completed++;
            else failed++;
            processNext(i + 1);
        }).updateWeeklyStatus(userIds[i], weekVal, status, customTime);
    }
    processNext(0);
}

function renderReportRows(items) {
    const tableBody = document.getElementById('reportTableBody');
    bulkAvailableData = items;
    if (items.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#8b949e;">No matching records found.</td></tr>';
        return;
    }

    let html = "";
    items.forEach(row => {
        let badgeClass = "badge-default";
        
        let resolvedStatus = row.status;
        if (!resolvedStatus || resolvedStatus === "Not Started") {
            resolvedStatus = "Reciting";
        }

        if (resolvedStatus === "Completed") badgeClass = "badge-completed";
        else if (resolvedStatus === "Reciting") badgeClass = "badge-progress";
        else if (resolvedStatus === "Exception Raised") badgeClass = "badge-exception";

        let dateLoggedInfo = '';
        let showDateLogged = row.dateLogged;
        if (showDateLogged) {
            var dtParts = formatDisplayDateParts(row.dateLogged);
            if (dtParts) {
                dateLoggedInfo = '<span class="date-logged"><span class="date-line">' + dtParts.day + ', ' + dtParts.date + '</span><span class="time-line">' + dtParts.time + '</span></span>';
            } else {
                dateLoggedInfo = '<span class="date-logged">' + formatDisplayDate(row.dateLogged) + '</span>';
            }
        }
        
        if (row.status === "Exception Raised") {
            if (row.supportedBy) {
                let supStatusText = row.supportStatus === "Completed" ? "Completed ✅" : "Reciting 🔄";
                dateLoggedInfo += `<span class="date-logged" style="color: #58a6ff; font-weight:600;">🤝 Support: ${row.supportedBy} (${supStatusText})</span>`;
            } else {
                dateLoggedInfo += `<span class="date-logged" style="color: #f87171; font-weight:600;">⚠️ <a href="#" onclick="openReassignFromReport('${row.userId}', ${row.juzNum}, '${row.name.replace(/'/g, "\\'")}'); return false;" style="color:#f87171;">Exception Unassigned</a></span>`;
            }
        }

        let nameParts = row.name.split(" | ");
        let enName = nameParts[0];
        let taName = nameParts[1] ? `<span>${nameParts[1]}</span>` : '';

        let statusBadgeHtml = `<span class="badge ${badgeClass}">${resolvedStatus}</span>`;
        if (reportIsEditable && row.userId && !bulkMode) {
            const rawStatus = row.status || "Not Started";
            const encName = row.name.replace(/'/g, "\\'");
            const encDate = (row.dateLogged || '').replace(/'/g, "\\'");
            statusBadgeHtml = `<a href="#" onclick="event.stopPropagation(); openReportEditModal('${row.userId}','${encName}','${rawStatus}','${encDate}'); return false;" class="badge ${badgeClass}">${resolvedStatus}</a>`;
        }

        const isChecked = selectedUserIds.has(row.userId);
        const cbHtml = bulkMode ? `<td class="bulk-checkbox-cell"><input type="checkbox" class="bulk-checkbox" data-uid="${row.userId}" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation()" onchange="toggleBulkSelect('${row.userId}', this.checked)"></td>` : '';

        html += `<tr onclick="toggleBulkSelect('${row.userId}')">
            ${cbHtml}
            <td class="report-name-col">
                <div class="name-cell">
                    ${enName}
                    ${taName}
                </div>
            </td>
            <td class="report-juz-col">
                <div class="juz-info-block">
                    <span class="num-badge">Juz ${row.juzNum}</span>
                    <span class="ar-val">${row.juzAr}</span>
                    <span class="en-val">${row.juzEn}</span>
                    <span class="ta-val">${row.juzTa}</span>
                </div>
            </td>
            <td class="report-status-col">
                <div class="status-row">
                    <div class="status-with-time">
                        ${statusBadgeHtml}
                        ${dateLoggedInfo}
                    </div>
                </div>
            </td>
        </tr>`;
    });

    tableBody.innerHTML = html;
}

function getSortValue(row, col) {
    if (col === 'name') return row.name.toLowerCase();
    if (col === 'juz') return parseInt(row.juzNum) || 0;
    if (col === 'status') {
        let s = row.status;
        if (!s || s === "Not Started") s = "Reciting";
        return s;
    }
    if (col === 'dateLogged') {
        if (!row.dateLogged) return 0;
        var t = new Date(row.dateLogged).getTime();
        return isNaN(t) ? 0 : t;
    }
    return '';
}

function sortReportData(col) {
    if (sortColumn === col) {
        sortAsc = !sortAsc;
    } else {
        sortColumn = col;
        sortAsc = true;
    }
    document.querySelectorAll('.sort-indicator').forEach(el => el.classList.remove('active'));
    const indicator = document.getElementById('sortIndicator' + col.charAt(0).toUpperCase() + col.slice(1));
    if (indicator) {
        indicator.textContent = sortAsc ? ' ▲' : ' ▼';
        indicator.classList.add('active');
    }
    applyReportFilter();
}

function applyReportFilter(filterVal) {
    if (!rawReportData) {
        renderReportRows([]);
        updateReportCounter(0, 0);
        return;
    }
    if (filterVal === undefined) {
        const activeBtn = document.querySelector('.filter-btn.active');
        filterVal = activeBtn ? activeBtn.dataset.filter : 'ALL';
    } else {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.filter-btn[data-filter="' + filterVal + '"]')?.classList.add('active');
    }

    const searchQ = document.getElementById('reportSearchInput').value.toLowerCase().trim();

    let filtered = [];
    if (filterVal === "ALL") {
        filtered = rawReportData;
    } else if (filterVal === "EXCEPTION_ALL") {
        filtered = rawReportData.filter(row => row.status === "Exception Raised");
    } else if (filterVal === "EXCEPTION_REASSIGNED") {
        filtered = rawReportData.filter(row => row.status === "Exception Raised" && row.supportedBy);
    } else if (filterVal === "EXCEPTION_UNASSIGNED") {
        filtered = rawReportData.filter(row => row.status === "Exception Raised" && !row.supportedBy);
    } else if (filterVal === "Reciting") {
        filtered = rawReportData.filter(row => !row.status || row.status === "Reciting" || row.status === "Not Started");
    } else {
        filtered = rawReportData.filter(row => row.status === filterVal);
    }

    if (searchQ) {
        filtered = filtered.filter(row =>
            row.name.toLowerCase().includes(searchQ) ||
            (row.juzNum && row.juzNum.toString() === searchQ) ||
            (row.juzEn && row.juzEn.toLowerCase().includes(searchQ)) ||
            (row.juzTa && row.juzTa.toLowerCase().includes(searchQ)) ||
            (row.juzAr && row.juzAr.toLowerCase().includes(searchQ))
        );
    }

    filtered.sort((a, b) => {
        let va = getSortValue(a, sortColumn);
        let vb = getSortValue(b, sortColumn);
        if (typeof va === 'string') {
            return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
        }
        return sortAsc ? va - vb : vb - va;
    });

    renderReportRows(filtered);
    updateReportCounter(filtered.length, rawReportData.length);
}

function captureElementToClipboard(element, btn, fileName, successMsg) {
    btn.disabled = true;
    btn.innerText = "Rendering...";
    btn.style.background = "#37474f";
    btn.style.color = "#ffffff";

    html2canvas(element, {
        scale: 4,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
    }).then(function(canvas) {
        canvas.toBlob(function(blob) {
            try {
                navigator.clipboard.write([new ClipboardItem({'image/png': blob})]).then(function() {
                    btn.innerText = "Copied! ✓";
                    btn.style.background = "#1b5e20";
                    btn.style.color = "#ffffff";
                    setTimeout(function() {
                        btn.innerText = fileName;
                        btn.style.background = btn.id === 'shareBtn' ? "#2e7d32" : "#e65100";
                        btn.style.color = "#ffffff";
                        btn.disabled = false;
                    }, 2500);
                    showSnackbar(successMsg || "Image copied!", false);
                }).catch(function() {
                    btn.disabled = false;
                    btn.innerText = fileName;
                    btn.style.background = btn.id === 'shareBtn' ? "#2e7d32" : "#e65100";
                    btn.style.color = "#ffffff";
                    showSnackbar("Failed to copy image. Try again.", true);
                });
            } catch(e) {
                btn.disabled = false;
                btn.innerText = fileName;
                btn.style.background = btn.id === 'shareBtn' ? "#2e7d32" : "#e65100";
                btn.style.color = "#ffffff";
                showSnackbar("Failed to copy image.", true);
            }
        }, 'image/png');
    }).catch(function(err) {
        btn.disabled = false;
        btn.innerText = fileName;
        btn.style.background = btn.id === 'shareBtn' ? "#2e7d32" : "#e65100";
        btn.style.color = "#ffffff";
        showSnackbar("Rendering failed.", true);
    });
}

function copyReportToClipboard() {
    if (!rawReportData || rawReportData.length === 0) {
        showSnackbar("No data available to copy.", true);
        return;
    }

    var captureArea = document.getElementById('reportCaptureArea');
    var shareBtn = document.getElementById('shareBtn');

    var tempDiv = document.createElement('div');
    var w = captureArea.offsetWidth;
    tempDiv.style.cssText = 'position:fixed;left:-9999px;top:0;width:' + w + 'px;box-sizing:border-box;background:#0d1117;border-top:1px solid #21262d;border-bottom:1px solid #21262d;padding:12px 0;font-family:Poppins,sans-serif;';
    tempDiv.innerHTML = captureArea.innerHTML;

    tempDiv.querySelectorAll('th').forEach(function(th) { th.style.position = 'static'; });
    tempDiv.querySelectorAll('a[onclick*="openReportEditModal"]').forEach(function(el) { el.style.display = 'none'; });
    var cw = tempDiv.querySelector('#reportTableWrapper');
    if (cw) { cw.style.maxHeight = 'none'; }

    document.body.appendChild(tempDiv);

    shareBtn.disabled = true;
    shareBtn.innerText = "Rendering...";
    shareBtn.style.background = "#37474f";
    shareBtn.style.color = "#ffffff";

    html2canvas(tempDiv, {
        scale: 4,
        useCORS: true,
        backgroundColor: '#0d1117',
        logging: false
    }).then(function(canvas) {
        document.body.removeChild(tempDiv);
        canvas.toBlob(function(blob) {
            try {
                navigator.clipboard.write([new ClipboardItem({'image/png': blob})]).then(function() {
                    shareBtn.innerText = "Copied! ✓";
                    shareBtn.style.background = "#1b5e20";
                    shareBtn.style.color = "#ffffff";
                    setTimeout(function() {
                        shareBtn.innerText = "Copy Report 📋";
                        shareBtn.style.background = "#2e7d32";
                        shareBtn.style.color = "#ffffff";
                        shareBtn.disabled = false;
                    }, 2500);
                    showSnackbar("Report copied as image!", false);
                }).catch(function() {
                    shareBtn.disabled = false;
                    shareBtn.innerText = "Copy Report 📋";
                    shareBtn.style.background = "#2e7d32";
                    shareBtn.style.color = "#ffffff";
                    showSnackbar("Failed to copy image. Try again.", true);
                });
            } catch(e) {
                shareBtn.disabled = false;
                shareBtn.innerText = "Copy Report 📋";
                shareBtn.style.background = "#2e7d32";
                shareBtn.style.color = "#ffffff";
                showSnackbar("Failed to copy image.", true);
            }
        }, 'image/png');
    }).catch(function(err) {
        document.body.removeChild(tempDiv);
        shareBtn.disabled = false;
        shareBtn.innerText = "Copy Report 📋";
        shareBtn.style.background = "#2e7d32";
        shareBtn.style.color = "#ffffff";
        showSnackbar("Rendering failed.", true);
    });
}

// Hadiya note preview with overlay
function copyHadiyaNoteToClipboard() {
    if (!currentHadiyaDetails || !currentHadiyaDetails.current) {
        showSnackbar("No Hadiya details available to copy.", true);
        return;
    }

    var hadiyaBtn = document.getElementById('hadiyaShareBtn');
    var res = currentHadiyaDetails;
    var cur = res.current;

    var captureDiv = document.getElementById('hadiyaCaptureArea');

    var dedHtml = '';
    var dedEn = cur.dedicatedToEn || cur.dedicatedTo || '';
    var dedTa = cur.dedicatedToTa || '';
    var purpEn = cur.dedicatedPurposeEn || '';
    var purpTa = cur.dedicatedPurposeTa || '';
    if (dedEn && dedEn.length > 0) {
        var dNames = dedEn.split(';').map(function(s) { return s.trim(); }).filter(function(s) { return s; });
        var dNamesTa = dedTa ? dedTa.split(';').map(function(s) { return s.trim(); }).filter(function(s) { return s; }) : [];
        var dPurp = purpEn ? purpEn.split(';').map(function(s) { return s.trim(); }).filter(function(s) { return s; }) : [];
        var dPurpTa = purpTa ? purpTa.split(';').map(function(s) { return s.trim(); }).filter(function(s) { return s; }) : [];
        if (dNames.length > 0) {
            var dedList = '';
            for (var di = 0; di < dNames.length; di++) {
                var num = di + 1;
                var enLine = '(' + num + ') ' + dNames[di] + (dPurp[di] ? ' - ' + dPurp[di] : '');
                var taLine = (dNamesTa[di] || dNames[di]) + (dPurpTa[di] ? ' - ' + dPurpTa[di] : (dPurp[di] ? ' - ' + dPurp[di] : ''));
                dedList += '<div style="font-size:0.85rem; color:#e6edf3; margin-bottom:2px;">' + escapeHtml(enLine) + '</div>' +
                    '<div style="font-size:0.8rem; color:#8b949e; margin-bottom:8px;">' + escapeHtml(taLine) + '</div>';
            }
            dedHtml = '<div style="font-size:0.85rem; color:#d29922; font-weight:600; margin-bottom:6px;">🎯 Dedicated to / அர்ப்பணித்தல்:</div>' +
                dedList;
        }
    }

    var tHadiyaSub = 'ஹதியா நிறைவேற்றப்பட்டது';
    var tWeek = 'வாரம்';
    var tAlhamdulillah = 'அல்ஹம்துலில்லாஹ், இந்த வாரத்திற்கான அனைத்து ஜுஸ் ஓதுதல்களும் திட்டமிட்டபடி சரியான நேரத்தில் வெற்றிகரமாக நிறைவு பெற்றுள்ளன!';
    var tJazak = 'ஜஜாக்குமுல்லாஹு கைரான், உங்களின் விரைவான அர்ப்பணிப்பிற்கு நன்றி!';
    var tDedicated = 'இந்த வார முழுமையான கத்தம் ஹதியா கீழே உள்ள உறுப்பினரால் நிறைவேற்றப்பட்டு அர்ப்பணிக்கப்படுகிறது:';
    var tDua = 'யா அல்லாஹ், எங்களின் ஒருங்கிணைந்த முயற்சிகளை ஏற்றுக்கொண்டு, ஈடுபட்ட அனைவருக்கும் மகத்தான பரக்கத்தை வழங்கி, அனைத்து ஓதுனர்களுக்கும் இம்மையிலும் மறுமையிலும் உயர்ந்த அந்தஸ்தை வழங்குவாயாக்!';

    captureDiv.innerHTML =
        '<div style="width:480px; background:#0d1117; padding:28px 24px; box-sizing:border-box; font-family:Poppins, Arial, sans-serif;">' +
        '<div style="height:3px; background:linear-gradient(90deg, #2dd4bf, #5eead4); margin:-28px -24px 20px -24px;"></div>' +
        '<div style="font-size:1.1rem; font-weight:700; color:#5eead4; margin-bottom:1px;">' +
        'Hadiya Completed</div>' +
        '<div style="font-size:0.85rem; color:#5eead4; margin-bottom:10px;">' +
        tHadiyaSub + '</div>' +
        '<div style="border:none; border-top:1px solid #21262d; margin-bottom:12px;"></div>' +
        '<div style="font-size:0.85rem; color:#8b949e; margin-bottom:14px;">' +
        'Week / ' + tWeek + ': <span style="color:#e6edf3;font-weight:600;">' + cur.range + '</span></div>' +
        '<div style="border:none; border-top:1px solid #21262d; margin-bottom:14px;"></div>' +
        '<div style="font-size:0.85rem; color:#c9d1d9; line-height:1.7; text-align:start; margin-bottom:6px;">' +
        tAlhamdulillah + '</div>' +
        '<div style="font-size:0.85rem; color:#c9d1d9; line-height:1.7; text-align:start; margin-bottom:6px;">' +
        tJazak + '</div>' +
        '<div style="font-size:0.85rem; color:#c9d1d9; line-height:1.7; margin-bottom:16px;">' +
        tDedicated + '</div>' +
        '<div style="font-size:1rem; font-weight:600; color:#5eead4; margin-bottom:1px;">' +
        escapeHtml(cur.ta || cur.en) + '</div>' +
        '<div style="font-size:0.9rem; color:#c9d1d9; margin-bottom:14px;">' +
        escapeHtml(cur.en) + '</div>' +
        '<div style="border:none; border-top:1px solid #21262d; margin-bottom:14px;"></div>' +
        '<div style="font-size:0.85rem; color:#c9d1d9; line-height:1.7; margin-bottom:4px;">' +
        'Alhamdulillah, all assigned Juz recitations for this week have been completed successfully on time!</div>' +
        '<div style="font-size:0.85rem; color:#c9d1d9; line-height:1.7; text-align:start; margin-bottom:4px;">' +
        'Jazakumullahu Khairan for your swift dedication!</div>' +
        '<div style="font-size:0.85rem; color:#c9d1d9; line-height:1.7; text-align:start; margin-bottom:16px;">' +
        'The Khatam Hadiya is dedicated to and completed by the above member.</div>' +
        '<div style="border:none; border-top:1px solid #21262d; margin-top:12px; margin-bottom:14px;"></div>' +
        dedHtml +
        '<div style="border:none; border-top:1px solid #21262d; margin-bottom:14px;"></div>' +
        '<div style="border:none; border-top:1px solid #21262d; margin-bottom:14px;"></div>' +
        '<div style="font-size:0.8rem; color:#8b949e; line-height:1.7; text-align:start; margin-bottom:10px;">' +
        tDua + '</div>' +
        '<div style="font-size:0.75rem; color:#8b949e; line-height:1.6; text-align:start; margin-bottom:14px;">' +
        'May Allah accept our combined efforts, grant immense barakah to everyone involved, and reward all readers with the highest ranks in Dunya and Akhirah.</div>' +
        '<div style="text-align:center; font-size:0.65rem; color:#30363d; border-top:1px solid #21262d; padding-top:12px;">— Inainthu Othuvom —</div>' +
        '</div>';

    // Build everything off-DOM first to avoid flash
    var overlay = document.createElement('div');
    overlay.id = 'hadiyaPreviewOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;background:#0d1117;display:flex;align-items:center;justify-content:center;overflow:hidden;opacity:0;transition:opacity 0s;';

    captureDiv.style.display = 'block';
    captureDiv.style.position = 'static';
    captureDiv.style.width = '480px';
    captureDiv.style.maxHeight = '80vh';
    captureDiv.style.overflowX = 'hidden';
    captureDiv.style.overflowY = 'auto';
    captureDiv.style.borderRadius = '0 0 12px 12px';
    captureDiv.style.boxShadow = 'none';

    var previewScale = Math.min(1, (window.innerWidth - 40) / 480);

    var topBar = document.createElement('div');
    topBar.style.cssText = 'width:480px;display:flex;justify-content:space-between;align-items:center;padding:10px 24px;box-sizing:border-box;';
    topBar.innerHTML =
        '<button id="hadiyaCopyBtn" style="background:#238636;color:#fff;border:none;border-radius:6px;padding:8px 18px;font-size:0.85rem;font-weight:600;cursor:pointer;font-family:inherit;box-shadow:0 1px 3px rgba(0,0,0,0.3);">Copy 📋</button>' +
        '<button id="hadiyaCloseBtn" style="background:none;border:none;font-size:1.8rem;color:#8b949e;cursor:pointer;line-height:1;padding:0;margin-right:-4px;font-family:inherit;">&times;</button>';

    var previewWrap = document.createElement('div');
    previewWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;';
    if (previewScale < 1) {
        previewWrap.style.transform = 'scale(' + previewScale + ')';
        previewWrap.style.transformOrigin = 'center center';
    }
    previewWrap.appendChild(topBar);
    previewWrap.appendChild(captureDiv);
    overlay.appendChild(previewWrap);

    // Append to DOM only when fully built
    document.body.appendChild(overlay);

    // Fade in after paint to avoid blink
    requestAnimationFrame(function() {
        requestAnimationFrame(function() {
            overlay.style.opacity = '1';
        });
    });

    document.getElementById('hadiyaCloseBtn').onclick = function() {
        closePreview();
    };

    var closePreview = function() {
        overlay.parentNode.insertBefore(captureDiv, overlay);
        overlay.remove();
        captureDiv.style.display = 'none';
        captureDiv.innerHTML = '';
        captureDiv.style.position = '';
        captureDiv.style.width = '';
        captureDiv.style.maxHeight = '';
        captureDiv.style.overflowX = '';
        captureDiv.style.overflowY = '';
        captureDiv.style.boxShadow = '';
        captureDiv.style.borderRadius = '';
    };

    overlay.onclick = function(e) {
        if (e.target === overlay) closePreview();
    };

    document.getElementById('hadiyaCopyBtn').onclick = function() {
        var btn = this;
        btn.disabled = true;
        btn.innerText = "Rendering...";
        // Hide preview scale before capture (no visual expansion)
        var origTransform = '';
        var origTransformOrigin = '';
        if (previewScale < 1) {
            origTransform = previewWrap.style.transform;
            origTransformOrigin = previewWrap.style.transformOrigin;
            previewWrap.style.opacity = '0';
            previewWrap.style.transform = 'none';
            previewWrap.style.transformOrigin = '';
        }
        var origMaxH = captureDiv.style.maxHeight;
        var origOverflow = captureDiv.style.overflowY;
        captureDiv.style.maxHeight = 'none';
        captureDiv.style.overflowY = 'visible';
        html2canvas(captureDiv, {
            scale: 4,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false
        }).then(function(canvas) {
            captureDiv.style.maxHeight = origMaxH;
            captureDiv.style.overflowY = origOverflow;
            if (previewScale < 1) {
                previewWrap.style.transform = origTransform;
                previewWrap.style.transformOrigin = origTransformOrigin;
                previewWrap.style.opacity = '';
            }
            canvas.toBlob(function(blob) {
                navigator.clipboard.write([new ClipboardItem({'image/png': blob})]).then(function() {
                    btn.innerText = "Copied! ✓";
                    btn.style.background = "#1b5e20";
                    setTimeout(function() {
                        btn.disabled = false;
                        btn.innerText = "Copy 📋";
                        btn.style.background = "#238636";
                    }, 2000);
                    showSnackbar("Hadiya note copied!", false);
                }).catch(function() {
                    // Fallback: copy as text
                    var text = captureDiv.innerText || captureDiv.textContent || '';
                    navigator.clipboard.writeText(text).then(function() {
                        captureDiv.style.maxHeight = origMaxH;
                        captureDiv.style.overflowY = origOverflow;
                        btn.innerText = "Copied! ✓";
                        btn.style.background = "#1b5e20";
                        setTimeout(function() {
                            btn.disabled = false;
                            btn.innerText = "Copy 📋";
                            btn.style.background = "#238636";
                        }, 2000);
                        showSnackbar("Hadiya note copied as text!", false);
                    }).catch(function() {
                        captureDiv.style.maxHeight = origMaxH;
                        captureDiv.style.overflowY = origOverflow;
                        btn.disabled = false;
                        btn.innerText = "Copy 📋";
                        showSnackbar("Failed to copy.", true);
                    });
                });
            }, 'image/png');
        }).catch(function() {
            captureDiv.style.maxHeight = origMaxH;
            captureDiv.style.overflowY = origOverflow;
            if (previewScale < 1) {
                previewWrap.style.transform = origTransform;
                previewWrap.style.transformOrigin = origTransformOrigin;
                previewWrap.style.opacity = '';
            }
            btn.disabled = false;
            btn.innerText = "Copy 📋";
            showSnackbar("Rendering failed.", true);
        });
    };
}

function closeReportModal() {
    document.getElementById('reportModal').style.display = "none";
    if (bulkMode) toggleBulkMode();
}

window.onclick = function(event) {
    const modal = document.getElementById('reportModal');
    const reassignModal = document.getElementById('reassignModal');
    if (event.target == modal) {
        modal.style.display = "none";
    }
    if (event.target == reassignModal) {
        reassignModal.style.display = "none";
    }
}
