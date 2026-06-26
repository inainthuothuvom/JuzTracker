    (function() {
        function resolveMemberCustomId(userId) {
            if (!userId) return Promise.resolve(null);
            return _supabase.from('members').select('id,custom_id').eq('id', userId).maybeSingle().then(function(r) {
                if (r.data) return r.data.custom_id;
                return _supabase.from('members').select('id,custom_id').eq('custom_id', String(userId)).maybeSingle().then(function(r2) {
                    return r2.data ? r2.data.custom_id : null;
                });
            });
        }

        var _ok = null, _err = null;
        function run() { return this; }
        var api = {
            withSuccessHandler: function(fn) { _ok = fn; return this; },
            withFailureHandler: function(fn) { _err = fn; return this; },
            // ----------------------------------------------------------------
            // getUserList
            // ----------------------------------------------------------------
            getUserList: function(selectedDate) {
                var self = this;
                var ok = _ok, err = _err;
                _supabase.from('members').select('id,custom_id,name_en,name_ta,effective_date').order('custom_id', { ascending: true }).then(function(r) {
                    if (r.error) { if (err) err(r.error); else console.error(r.error); return; }
                    var active = selectedDate ? filterActiveMembers(r.data, selectedDate) : r.data;
                    var out = active.map(function(u) { return { id: u.id, custom_id: u.custom_id, arabic: '', english: u.name_en||'', tamil: u.name_ta||'', effective_date: u.effective_date||null }; });
                    if (ok) ok(out);
                });
                return this;
            },
            // ----------------------------------------------------------------
            // lookupTamilName
            // ----------------------------------------------------------------
            lookupTamilName: function(userId) {
                var self = this;
                var ok = _ok;
                _supabase.from('members').select('name_ta').eq('id', userId).single().then(function(r) {
                    if (ok) ok((r.data && r.data.name_ta) || '');
                });
                return this;
            },
            // ----------------------------------------------------------------
            // lookupJuzFromSchedule
            // ----------------------------------------------------------------
            lookupJuzFromSchedule: function(customId, targetDate) {
                var self = this;
                var ok = _ok;
                var d = new Date(targetDate); d.setHours(0,0,0,0,0);
                _supabase.from('weekly_status').select('juz_number').eq('member_id', customId).lte('week_start', formatLocalDate(d)).order('week_start', { ascending: false }).limit(1).then(function(r) {
                    if (ok) ok((r.data && r.data[0]) ? String(r.data[0].juz_number) : '');
                });
                return this;
            },
            // ----------------------------------------------------------------
            // getAvailableSupportUsers
            // ----------------------------------------------------------------
            getAvailableSupportUsers: function(selectedDate, excludeCustomId) {
                var self = this;
                var ok = _ok;
                var norm = normalizeToWeekStart(selectedDate);
                // Get all users who have an exception this week
                _supabase.from('weekly_status').select('member_id').eq('week_start', norm).eq('status', 'Exception Raised').then(function(rExc) {
                    var excIds = {};
                    if (rExc.data) rExc.data.forEach(function(x) { excIds[x.member_id] = true; });
                    // Get all non-exception users from members
                    _supabase.from('members').select('id,custom_id,name_en,name_ta,effective_date').order('custom_id', { ascending: true }).then(function(rCfg) {
                        if (!rCfg.data) { if (ok) ok([]); return; }
                        var active = filterActiveMembers(rCfg.data, selectedDate);
                        var out = [];
                        active.forEach(function(u) {
                            if (u.custom_id !== excludeCustomId && !excIds[u.custom_id]) out.push({ id: u.id, custom_id: u.custom_id, english: u.name_en||'', tamil: u.name_ta||'' });
                        });
                        if (ok) ok(out);
                    });
                });
                return this;
            },
            // ----------------------------------------------------------------
            // findJuzAssignment
            // ----------------------------------------------------------------
            findJuzAssignment: function(userId, customId, selectedDate) {
                var self = this;
                var ok = _ok;
                function run(cid) {
                // Extract date-only portion from datetime-local value
                var dateOnly = dateFromDateLocal(selectedDate);
                var inputDate = new Date(dateOnly); inputDate.setHours(0,0,0,0,0);

                // Parse selected datetime for cutoff comparison
                var selParts = selectedDate.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
                var selectedDT = selParts ? new Date(+selParts[1], +selParts[2]-1, +selParts[3], +selParts[4], +selParts[5]) : null;

                function fridayOf(dateStr) {
                    var m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
                    var d = m ? new Date(+m[1], +m[2]-1, +m[3]) : new Date(dateStr);
                    d.setHours(0,0,0,0,0);
                    if (isNaN(d.getTime())) return null;
                    var day = d.getDay();
                    var diff = (day >= 5) ? (day - 5) : (day + 2);
                    var f = new Date(d); f.setDate(d.getDate() - diff);
                    return formatLocalDate(f);
                }

                var selectedFriday = fridayOf(dateOnly);
                var prevFridayDate = new Date(selectedFriday + 'T00:00:00');
                prevFridayDate.setDate(prevFridayDate.getDate() - 7);
                var prevFriday = formatLocalDate(prevFridayDate);

                // Query the previous week's next_hadiya_start_moment for cutoff
                _supabase.from('hadiya_details').select('next_hadiya_start_moment').eq('start_date', prevFriday).limit(1).then(function(rH) {
                    var cutoffTime = null;
                    if (rH.data && rH.data.length > 0 && rH.data[0].next_hadiya_start_moment) {
                        var raw = rH.data[0].next_hadiya_start_moment;
                        var s = String(raw).trim().replace(' ', 'T');
                        var hasTimezone = s.endsWith('Z') || /[\+\-]\d{2}:\d{2}$/.test(s) || /[\+\-]\d{4}$/.test(s);
                        var d;
                        if (hasTimezone) {
                            d = new Date(s);
                        } else {
                            var p = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
                            if (p) {
                                d = new Date(+p[1], +p[2]-1, +p[3], +p[4], +p[5], +(p[6]||0));
                            } else {
                                d = new Date(s);
                            }
                        }
                        if (!isNaN(d.getTime())) cutoffTime = d;
                    }

                    var isBeforeNextStart = cutoffTime && selectedDT && selectedDT.getTime() < cutoffTime.getTime();

                    // Adjust inputDate if selected datetime is before cutoff
                    var adjustedInputDate = inputDate;
                    if (isBeforeNextStart && selectedFriday) {
                        adjustedInputDate = new Date(inputDate);
                        adjustedInputDate.setDate(adjustedInputDate.getDate() - 7);
                    }
                    
                    // Find latest weekly_status row before/on adjustedInputDate
                     _supabase.from('weekly_status').select('week_start,juz_number,member_name,status,completed_date_time,exception_raised_time,supported_by_name,supported_by_id,support_status').eq('member_id', cid).lte('week_start', formatLocalDate(adjustedInputDate)).order('week_start', { ascending: false }).limit(1).then(function(rStat) {
                    if (!rStat.data || rStat.data.length === 0) {
                        // No weekly_status row found — calculate Juz dynamically
                        var seq = parseInt(cid.replace(/[^0-9]/g, ''), 10);
                        // Find earliest week_start for this user to determine base week
                        _supabase.from('weekly_status').select('week_start').eq('member_id', cid).order('week_start', { ascending: true }).limit(1).then(function(rFirst) {
                                var baseDate;
                                if (rFirst.data && rFirst.data.length > 0) {
                                    baseDate = new Date(rFirst.data[0].week_start);
                                } else {
                                    // No rows at all — use a default base (first Friday of 2026)
                                    baseDate = new Date('2026-01-02');
                                }
                                baseDate.setHours(0, 0, 0, 0);
                                var weekDiff = Math.round((inputDate - baseDate) / (7 * 86400000));
                                if (weekDiff < 0) weekDiff = 0;
                                var dynamicJuz = ((seq - 1 + weekDiff) % 30) + 1;
                                var juzStr = String(dynamicJuz);
                                // Look up Juz details
                                _supabase.from('sequences').select('juz_ar,juz_en,juz_ta').eq('sequence', parseInt(juzStr)).single().then(function(rJuz) {
                                    var jDetail = rJuz.data || {};
                                    var monday = normalizeToWeekStart(formatLocalDate(inputDate));
                                    var result = {
                                        number: juzStr,
                                        dateFound: formatDateDDMMMYYYY(monday),
                                        rawDate: new Date(monday).toISOString(),
                                        arabic: jDetail.juz_ar || '',
                                        english: jDetail.juz_en || '',
                                        tamil: jDetail.juz_ta || '',
                                        savedStatus: 'Not Started',
                                        savedLastModified: '',
                                        statusTimestamp: '',
                                        supportedByName: '',
                                        supportedById: '',
                                        supportStatus: ''
                                    };
                                    if (ok) ok(result);
                                });
                            });
                        return;
                    }
                    var st = rStat.data[0]; var assignedJuz = String(st.juz_number);
                    // Look up Juz details from members by sequence
                    _supabase.from('sequences').select('juz_ar,juz_en,juz_ta').eq('sequence', parseInt(assignedJuz)).single().then(function(rJuz) {
                        var jDetail = rJuz.data || {};
                        var currentTrackerStatus = st.status || 'Reciting';
                        var statusTimestamp = '';
                        var supportedByName = st.supported_by_name || '';
                        var supportedById = st.supported_by_id || '';
                        var supportStatus = st.support_status || '';
                        var trackerLastModified = '';
                        var compTime = st.completed_date_time || '';
                        var excTime = st.exception_raised_time || '';
                        statusTimestamp = compTime || excTime || '';
                        if (currentTrackerStatus === 'Completed' && compTime) trackerLastModified = 'Completed on: ' + formatDisplayDate(compTime);
                        else if (currentTrackerStatus === 'Exception Raised' && excTime) trackerLastModified = 'Exception raised on: ' + formatDisplayDate(excTime);
                        var result = {
                            number: assignedJuz,
                            dateFound: formatDateDDMMMYYYY(st.week_start),
                            rawDate: new Date(st.week_start).toISOString(),
                            arabic: jDetail.juz_ar || '',
                            english: jDetail.juz_en || '',
                            tamil: jDetail.juz_ta || '',
                            savedStatus: currentTrackerStatus,
                            savedLastModified: trackerLastModified,
                            statusTimestamp: statusTimestamp,
                            supportedByName: supportedByName,
                            supportedById: supportedById,
                            supportStatus: supportStatus,
                            supportingName: '',
                            supportingNameTa: '',
                            supportingUserId: '',
                            supportingJuz: '',
                            supportingJuzAr: '',
                            supportingJuzEn: '',
                            supportingJuzTa: '',
                            supportAssignmentStatus: ''
                        };
                        // Find what this user is supporting (if they are a backup reader)
                        _supabase.from('weekly_status').select('member_id,member_name,juz_number,support_status,week_start').eq('supported_by_id', userId).eq('week_start', st.week_start).limit(1).then(function(rSup) {
                            if (rSup.data && rSup.data.length > 0) {
                                var sup = rSup.data[0];
                                result.supportingName = sup.member_name || '';
                                result.supportingUserId = sup.member_id || '';
                                result.supportingJuz = String(sup.juz_number || '');
                                result.supportAssignmentStatus = sup.support_status || 'Reciting';
                                // Look up Tamil name from members table
                                _supabase.from('members').select('name_ta').eq('custom_id', sup.member_id).limit(1).then(function(rNameTa) {
                                    result.supportingNameTa = rNameTa.data ? rNameTa.data.name_ta : '';
                                    // Look up supporting Juz details
                                    _supabase.from('sequences').select('juz_ar,juz_en,juz_ta').eq('sequence', parseInt(result.supportingJuz || '0')).single().then(function(rSupJuz) {
                                        if (rSupJuz.data) {
                                            result.supportingJuzAr = rSupJuz.data.juz_ar || '';
                                            result.supportingJuzEn = rSupJuz.data.juz_en || '';
                                            result.supportingJuzTa = rSupJuz.data.juz_ta || '';
                                        }
                                        if (ok) ok(result);
                                    });
                                });
                            } else {
                                if (ok) ok(result);
                            }
                        });
                    });
                });
            });
            }
            if (!customId) {
                _supabase.from('members').select('custom_id').eq('id', userId).single().then(function(rCid) {
                    if (!rCid.data) { if (ok) ok({ error: "Member not found." }); return; }
                    run(rCid.data.custom_id);
                });
            } else {
                run(customId);
            }
                return this;
            },
            // ----------------------------------------------------------------
            // getHadiyaDetails
            // ----------------------------------------------------------------
            getHadiyaDetails: function(selectedDate) {
                var self = this;
                var ok = _ok;
                function ld(s) {
                    var m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
                    return m ? new Date(+m[1], +m[2]-1, +m[3]) : new Date(s);
                }
                var inputDate = ld(selectedDate); inputDate.setHours(0,0,0,0,0);
                // Fetch ALL hadiya rows + status rows (for completed/reciting lists)
                _supabase.from('hadiya_details').select('*').order('start_date', { ascending: true }).then(function(rH) {
                    if (!rH.data || rH.data.length === 0) { if (ok) ok(null); return; }
                    var hadData = rH.data;
                    // Find currentIndex (latest <= inputDate)
                    var currentIdx = -1; var latestDate = null;
                    for (var i = 0; i < hadData.length; i++) {
                        var rd = ld(hadData[i].start_date); rd.setHours(0,0,0,0,0);
                        if (rd <= inputDate && (!latestDate || rd > latestDate)) { latestDate = rd; currentIdx = i; }
                    }
                    if (currentIdx === -1) { if (ok) ok(null); return; }
// Find todayIndex - use IST time for consistency
                     var now = new Date();
                     var IST_MS = 5.5 * 3600000;
                     var nowIST = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + IST_MS);
var today = new Date(nowIST); today.setHours(0,0,0,0,0);
                      var todayIdx = -1; var todayDate = null;
                      for (var i = 0; i < hadData.length; i++) {
                          var rd = ld(hadData[i].start_date); rd.setHours(0,0,0,0,0);
                          if (rd <= today && (!todayDate || rd > todayDate)) { todayDate = rd; todayIdx = i; }
                      }
                     var getRowData = function(idx) {
                        if (idx < 0 || idx >= hadData.length || !hadData[idx].nominated_to) return null;
                        var row = hadData[idx];
                        var startDate = ld(row.start_date);
                        var endDate = new Date(startDate); endDate.setDate(endDate.getDate() + 6);
                        var rangeStr = formatDateDDMMM(startDate) + ' - ' + formatDateDDMMM(endDate);
                        var nominatedTo = row.nominated_to || '';
                        var nominatedToTa = row.nominated_to_ta || '';
                        var dedicatedTo = row.dedicated_to || '';
                        var dedicatedToTa = row.dedicated_to_ta || '';
                        var hadiyaStatus = row.status || 'Pending';
                        var rawDeadline = row.countdown_end_moment || '';
                        var rawNextStart = row.next_hadiya_start_moment || '';
                        var rawDedPurposeEn = row.dedicated_purpose_english || '';
                        var rawDedPurposeTa = row.dedicated_purpose_tamil || '';
                        var deadlineISO = '', deadlineDisplay = '', nextStartISO = '', nextStartDisplay = '', purposeEn = '', purposeTa = '';
                        if (rawDeadline) { var pd = parseDT(rawDeadline); if (!isNaN(pd.getTime())) { deadlineISO = pd.toISOString(); deadlineDisplay = fmtDL(pd); } }
                        if (rawNextStart) { var pn = parseDT(rawNextStart); if (!isNaN(pn.getTime())) { nextStartISO = pn.toISOString(); nextStartDisplay = fmtDL(pn); } }
                        if (rawDedPurposeEn) { purposeEn = rawDedPurposeEn; }
                        if (rawDedPurposeTa) { purposeTa = rawDedPurposeTa; }
                        return {
                            en: nominatedTo, ta: nominatedToTa, range: rangeStr,
                            dedicatedTo: dedicatedTo, dedicatedToTa: dedicatedToTa,
                            dedicatedToEn: dedicatedTo,
                            dedicatedPurposeEn: purposeEn,
                            dedicatedPurposeTa: purposeTa,
                            status: hadiyaStatus,
                            weekEndDate: endDate.toISOString(),
                            deadlineISO: deadlineISO,
                            nextStartISO: nextStartISO,
                            deadlineDisplay: deadlineDisplay,
                            nextStartDisplay: nextStartDisplay,
                            rawIdx: idx,
                            startDate: row.start_date
                        };
                    };
                     function parseDT(str) {
                        var s = String(str).replace(' ', 'T');
                        var hasTZ = s.endsWith('Z') || /[\+-]\d{2}:\d{2}$/.test(s) || /[\+-]\d{4}$/.test(s);
                        if (hasTZ) {
                            var d = new Date(s);
                            return isNaN(d.getTime()) ? new Date() : d;
                        }
                        var p = s.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
                        if (p) return new Date(+p[1],+p[2]-1,+p[3],+p[4],+p[5],+(p[6]||0));
                        var d = new Date(s);
                        return isNaN(d.getTime()) ? new Date() : d;
                    }
                     function fmtDL(d) {
                        return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
                    }
                    // Helper: apply same advance logic used for the selected date,
                    // but parameterised by a reference Date so it works for "today" too.
                    // This ensures todayIdx reflects the *active* hadiya for now,
                    // not just the latest row with start_date <= today.
                    function applyAdvanceLogic(idx, refTime) {
                        if (idx < 0) return idx;
                        // 1. If we're before the previous row's nextStartISO, step back
                        if (idx > 0) {
                            var prevRowRaw = getRowData(idx - 1);
                            if (prevRowRaw && prevRowRaw.nextStartISO) {
                                var prevStartDT = parseDT(prevRowRaw.nextStartISO);
                                if (!isNaN(prevStartDT.getTime()) && refTime.getTime() < prevStartDT.getTime()) {
                                    idx--;
                                }
                            }
                        }
                        // 2. If we're at/after the current row's nextStartISO, step forward
                        var r = getRowData(idx);
                        if (r && r.nextStartISO && idx + 1 < hadData.length) {
                            var nextStartDT = parseDT(r.nextStartISO);
                            if (!isNaN(nextStartDT.getTime()) && refTime.getTime() >= nextStartDT.getTime()) {
                                idx++;
                            }
                        }
                        return idx;
                    }
                    // Read nextStart for cutoff
                    var curRow = getRowData(currentIdx);
                    if (!curRow) { if (ok) ok(null); return; }
                    // Selected datetime comparison: determine which hadiya to show
                    var selParts = selectedDate.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
                    if (selParts) {
                        var selIST = new Date(+selParts[1], +selParts[2]-1, +selParts[3], +selParts[4], +selParts[5]);
                        currentIdx = applyAdvanceLogic(currentIdx, selIST);
                        curRow = getRowData(currentIdx);
                        if (!curRow) { if (ok) ok(null); return; }
                    }
                    // Apply the same logic to todayIdx so isCurrentWeek stays true
                    // when the user is viewing the hadiya that's actually active right now
                    // (e.g. on the current hadiya's start Friday before next_hadiya_start_moment).
                    todayIdx = applyAdvanceLogic(todayIdx, nowIST);
                    // Collect completed / reciting lists from weekly_status (use Friday week)
                    var targetRef = latestDate || new Date(0);
                    targetRef.setHours(0,0,0,0,0);
                    var tDay = targetRef.getDay();
                    var tDiff = (tDay >= 5) ? (tDay - 5) : (tDay + 2);
                    var fridayBase = new Date(targetRef); fridayBase.setDate(targetRef.getDate() - tDiff);
                    var mondayStr = formatLocalDate(fridayBase);
                    _supabase.from('weekly_status').select('*').eq('week_start', mondayStr).then(function(rStat) {
                        var completedList = []; var recitingList = []; var supportersList = [];
                        if (rStat.data) {
                            rStat.data.forEach(function(s) {
                                var name = s.member_name || '';
                                if (!name) return;
                                var status = s.status || 'Not Started';
                                var supportStatus = s.support_status || '';
                                var enName = name.indexOf('|') > -1 ? name.split('|')[0].trim() : name;
                                var taName = name.indexOf('|') > -1 ? name.split('|')[1].trim() : name;
                                var isDone = (status === 'Completed') || (status === 'Exception Raised' && supportStatus === 'Completed');
                                var person = { en: enName, ta: taName };
                                if (isDone) completedList.push(person);
                                else if (status === 'Reciting' || status === 'Not Started' || status === 'Exception Raised') recitingList.push(person);
                                var supporterName = s.supported_by_name || '';
                                if (supporterName) {
                                    var sEn = supporterName.indexOf('|') > -1 ? supporterName.split('|')[0].trim() : supporterName;
                                    var sTa = supporterName.indexOf('|') > -1 ? supporterName.split('|')[1].trim() : supporterName;
                                    supportersList.push({ en: sEn, ta: sTa });
                                }
                            });
                        }
var result = {
                             current: getRowData(currentIdx),
                             previous: getRowData(currentIdx - 1),
                             next: getRowData(currentIdx + 1),
                             currentIndex: currentIdx,
                             todayIndex: todayIdx,
                             weekStart: mondayStr,
                             completedList: completedList,
                             recitingList: recitingList,
                             supportersList: supportersList
                         };
                         if (ok) ok(result);
                    });
                });
                return this;
            },
            // ----------------------------------------------------------------
            // getWeeklyReport
            // ----------------------------------------------------------------
            getWeeklyReport: function(selectedDate) {
                var self = this;
                var ok = _ok;
                var dateOnly = dateFromDateLocal(selectedDate);
                function fridayOf(dateStr) {
                    var m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
                    var d = m ? new Date(+m[1], +m[2]-1, +m[3]) : new Date(dateStr);
                    d.setHours(0,0,0,0,0);
                    if (isNaN(d.getTime())) return null;
                    var day = d.getDay();
                    var diff = (day >= 5) ? (day - 5) : (day + 2);
                    var f = new Date(d); f.setDate(d.getDate() - diff);
                    return formatLocalDate(f);
                }
                // Parse selected datetime for cutoff comparison
                var selParts = selectedDate.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
                var selectedDT = selParts ? new Date(+selParts[1], +selParts[2]-1, +selParts[3], +selParts[4], +selParts[5]) : null;

                var selectedFriday = fridayOf(dateOnly);
                var prevFridayDate = new Date(selectedFriday + 'T00:00:00');
                prevFridayDate.setDate(prevFridayDate.getDate() - 7);
                var prevFriday = formatLocalDate(prevFridayDate);
                _supabase.from('hadiya_details').select('next_hadiya_start_moment').eq('start_date', prevFriday).limit(1).then(function(rH) {
                    var cutoffTime = null;
                    if (rH.data && rH.data.length > 0 && rH.data[0].next_hadiya_start_moment) {
                        var raw = rH.data[0].next_hadiya_start_moment;
                        var s = String(raw).trim().replace(' ', 'T');
                        var hasTimezone = s.endsWith('Z') || /[\+\-]\d{2}:\d{2}$/.test(s) || /[\+\-]\d{4}$/.test(s);
                        var d;
                        if (hasTimezone) {
                            d = new Date(s);
                        } else {
                            var p = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
                            if (p) {
                                d = new Date(+p[1], +p[2]-1, +p[3], +p[4], +p[5], +(p[6]||0));
                            } else {
                                d = new Date(s);
                            }
                        }
                        if (!isNaN(d.getTime())) cutoffTime = d;
                    }
                    var isBeforeNextStart = cutoffTime && selectedDT && selectedDT.getTime() < cutoffTime.getTime();
                    var correctMonday;
                    if (isBeforeNextStart) {
                        var tmp = new Date(dateOnly + 'T00:00:00');
                        tmp.setDate(tmp.getDate() - 7);
                        correctMonday = fridayOf(formatLocalDate(tmp));
                    } else {
                        correctMonday = fridayOf(dateOnly);
                    }
                    var adjDate = dateOnly;
                    if (isBeforeNextStart) {
                        var sd = new Date(dateOnly + 'T00:00:00');
                        sd.setDate(sd.getDate() - 7);
                        adjDate = formatLocalDate(sd);
                    }
                    var monday = fridayOf(adjDate);
                    if (!monday) { if (ok) ok({ error: "Invalid date." }); return; }
                    var editable = monday === correctMonday;
                    // Fetch report data
                    _supabase.from('weekly_status').select('member_id,juz_number,member_name,status,completed_date_time,exception_raised_time,supported_by_name,support_status').eq('week_start', monday).then(function(rStat) {
                        if (!rStat.data || rStat.data.length === 0) {
                            _supabase.from('members').select('id,custom_id,name_en,name_ta,effective_date').order('custom_id', { ascending: true }).then(function(rMem) {
                                if (!rMem.data || rMem.data.length === 0) { if (ok) ok({ error: "No members found." }); return; }
                                var activeMem = filterActiveMembers(rMem.data, monday);
                                _supabase.from('weekly_status').select('week_start').order('week_start', { ascending: true }).limit(1).then(function(rFirst) {
                                    var baseDate = (rFirst.data && rFirst.data.length > 0) ? new Date(rFirst.data[0].week_start) : new Date('2026-01-02');
                                    baseDate.setHours(0, 0, 0, 0);
                                    var weekDiff = Math.round((new Date(monday + 'T00:00:00') - baseDate) / (7 * 86400000));
                                    if (weekDiff < 0) weekDiff = 0;
                                    _supabase.from('sequences').select('sequence,juz_ar,juz_en,juz_ta').order('sequence', { ascending: true }).then(function(rJuz) {
                                        var juzMap = {};
                                        if (rJuz.data) rJuz.data.forEach(function(j) { juzMap[j.sequence] = { arabic: j.juz_ar||'', english: j.juz_en||'', tamil: j.juz_ta||'' }; });
                                        var reportList = activeMem.map(function(m) {
                                            var n = ((parseInt(m.custom_id.replace(/[^0-9]/g, ''), 10) - 1 + weekDiff) % 30) + 1;
                                            var jd = juzMap[n] || {};
                                            return { userId: m.id, name: (m.name_en||'')+' | '+(m.name_ta||''), juzNum: String(n), juzAr: jd.arabic||'', juzEn: jd.english||'', juzTa: jd.tamil||'', status: 'Not Started', dateLogged: '', supportedBy: '', supportStatus: '', isEditable: editable };
                                        });
                                        if (ok) ok({ week: monday, data: reportList, isEditable: editable });
                                    });
                                });
                            });
                            return;
                        }
                        Promise.all([
                            _supabase.from('members').select('id,custom_id,name_en,name_ta,effective_date').order('custom_id', { ascending: true }),
                            _supabase.from('sequences').select('sequence,juz_ar,juz_en,juz_ta').order('sequence', { ascending: true })
                        ]).then(function(results) {
                            var rMem = results[0], rSeq = results[1];
                            var juzMap = {}, nameMap = {};
                            var activeMem = rMem.data ? filterActiveMembers(rMem.data, monday) : [];
                            activeMem.forEach(function(j) { nameMap[j.custom_id] = { id: j.id, en: j.name_en||'', ta: j.name_ta||'' }; });
                            if (rSeq.data) rSeq.data.forEach(function(j) { juzMap[j.sequence] = { arabic: j.juz_ar||'', english: j.juz_en||'', tamil: j.juz_ta||'' }; });
                            var reportList = rStat.data.map(function(s) {
                                var mi = nameMap[s.member_id] || {};
                                var jd = juzMap[s.juz_number] || {};
                                var dn = (mi.en||s.member_name||'') + ' | ' + (mi.ta||'');
                                var dl = s.status === 'Completed' ? (s.completed_date_time || '') : (s.status === 'Exception Raised' ? (s.completed_date_time || s.exception_raised_time || '') : '');
                                return { userId: mi.id || s.member_id, name: dn, juzNum: String(s.juz_number), juzAr: jd.arabic||'', juzEn: jd.english||'', juzTa: jd.tamil||'', status: s.status||'Not Started', dateLogged: dl, supportedBy: s.supported_by_name||'', supportStatus: s.support_status||'', isEditable: editable };
                            });
                            if (ok) ok({ week: monday, data: reportList, isEditable: editable });
                        });
                    });
                });
                return this;
            },
            // ----------------------------------------------------------------
            // updateWeeklyStatus
            // ----------------------------------------------------------------
            updateWeeklyStatus: function(userId, inputDateStr, statusUpdate, customTimestamp) {
                var self = this;
                var ok = _ok;
                try {
                    var monday = normalizeToWeekStart(inputDateStr);
                    if (!monday) { if (ok) ok({ success: false, error: 'Invalid date' }); return this; }
                    // Look up custom_id for weekly_status queries
                    var customId = null;
                    resolveMemberCustomId(userId).then(function(resolvedCustomId) {
                        if (!resolvedCustomId) { if (ok) ok({ success: false, error: 'Member not found' }); return; }
                        customId = resolvedCustomId;
                        // Get existing status
                        _supabase.from('weekly_status').select('*').eq('week_start', monday).eq('member_id', customId).single().then(function(rGet) {
                        var existing = rGet.data;
                        var nameEn = customId;
                        if (existing) nameEn = existing.member_name || customId;
                        var timestamp = (customTimestamp && customTimestamp.trim()) ? customTimestamp.trim() : formatCurrentTimestamp();
                    var cu = window.currentUser ? window.currentUser() : null;
                    var updaterEmail = cu ? (cu.name || 'Unknown') + ' (' + (cu.email || 'no-email') + ')' : 'Web User (Supabase)';
                    var oldStatus = existing ? existing.status : 'Not Started';
                        if (existing && existing.status === statusUpdate && !(customTimestamp && customTimestamp.trim())) {
                            if (ok) ok({ success: true, noChange: true }); return;
                        }
                        // Authorization check for non-admin users
                        function doUpsert(juzNum) {
                            var upsertData = {
                                week_start: monday, member_id: customId, member_name: nameEn, juz_number: juzNum,
                                status: statusUpdate, completed_date_time: null, exception_raised_time: null,
                                supported_by_name: '', supported_by_id: '', support_status: 'Reciting',
                                audit_log: existing ? (existing.audit_log || '') : ''
                            };
                            if (statusUpdate === 'Exception Raised') {
                                upsertData.exception_raised_time = timestamp;
                                upsertData.completed_date_time = existing ? existing.completed_date_time : null;
                                upsertData.supported_by_name = existing ? existing.supported_by_name : '';
                                upsertData.supported_by_id = existing ? existing.supported_by_id : '';
                                upsertData.support_status = existing ? (existing.support_status || 'Reciting') : 'Reciting';
                            } else if (statusUpdate === 'Completed') {
                                upsertData.completed_date_time = timestamp;
                                upsertData.exception_raised_time = null;
                                upsertData.supported_by_name = '';
                                upsertData.supported_by_id = '';
                                upsertData.support_status = '';
                            } else {
                                upsertData.completed_date_time = null;
                                upsertData.exception_raised_time = null;
                                upsertData.supported_by_name = '';
                                upsertData.supported_by_id = '';
                                upsertData.support_status = '';
                            }
                            var newLog = '[' + timestamp + ' - ' + updaterEmail + '] Modified Status from \'' + oldStatus + '\' to \'' + statusUpdate + '\'';
                            upsertData.audit_log = existing ? (existing.audit_log || '') + '\n' + newLog : newLog;
                            _supabase.from('weekly_status').upsert(upsertData, { onConflict: 'week_start,member_id' }).then(function(rUp) {
                                if (rUp.error) { if (ok) ok({ success: false, error: rUp.error.message }); return; }
                                
                                // Notify admins and self of any status change
                                var enName = (nameEn || '').split('|')[0].trim() || 'Unknown';
                                _supabase.from('members').select('name_ta').eq('id', userId).single().then(function(rTa) {
                                    var taName = rTa.data ? rTa.data.name_ta : enName;
                                    if (window.AppNotifications) {
                                        var nTitle = statusUpdate + ' - ' + enName + ' | ' + taName;
                                        var nBody = 'Juz ' + juzNum + ' | Week ' + formatDateDDMMMYYYY(monday) + ' | ' + oldStatus + ' → ' + statusUpdate;
                                        var nBodyTa = 'ஜுஸ் ' + juzNum + ' | வாரம் ' + formatDateDDMMMYYYY(monday) + ' | ' + oldStatus + ' → ' + statusUpdate;
                                        var updaterDisplay = cu ? (cu.name || 'Unknown') : 'Web User';
                                        var adminBody = nBody + '\n' + nBodyTa + '\nBy: ' + updaterDisplay;
                                        var notificationPromise = window.AppNotifications.insertToAllAdmins ? window.AppNotifications.insertToAllAdmins(nTitle, adminBody, true) : Promise.resolve();
                                        if (cu && cu.customId && cu.role !== 'admin') notificationPromise = notificationPromise.then(function() { return window.AppNotifications.insert(nTitle, nBody + '\n' + nBodyTa, cu.customId, 'user'); });
                                        if (customId && (!cu || cu.customId !== customId)) notificationPromise = notificationPromise.then(function() { return window.AppNotifications.notifyTargetUser ? window.AppNotifications.notifyTargetUser(nTitle, nBody + '\n' + nBodyTa, customId) : Promise.resolve(); });
                                        notificationPromise.then(function() { if (ok) ok({ success: true }); });
                                    } else if (ok) ok({ success: true });
                                });
                            });
                            }
                        // Non-admins can only update the current week
                        if (cu && cu.role !== 'admin') {
                            var currentWeek = normalizeToWeekStart(new Date());
                            if (monday !== currentWeek) { if (ok) ok({ success: false, error: 'You can only update the current week.' }); return; }
                        }
                        // Authorize: non-admin can only update own record or supported record
                        if (cu && cu.role !== 'admin' && cu.customId !== customId) {
                            var _isSup = existing && String(existing.supported_by_id).length > 0;
                            if (_isSup) {
                                _supabase.from('members').select('id').eq('custom_id', cu.customId).maybeSingle().then(function(rMid) {
                                    if (!rMid.data || String(existing.supported_by_id) !== String(rMid.data.id)) {
                                        if (ok) ok({ success: false, error: 'Unauthorized' }); return;
                                    }
                                    if (existing && existing.juz_number) { doUpsert(existing.juz_number); } else { computeAndUpsert(); }
                                });
                                return;
                            } else {
                                if (ok) ok({ success: false, error: 'Unauthorized' }); return;
                            }
                        }
                        if (existing && existing.juz_number) {
                            doUpsert(existing.juz_number);
                        } else {
                            computeAndUpsert();
                        }
                        function computeAndUpsert() {
                            var seq = parseInt(customId.replace(/[^0-9]/g, ''), 10);
                            _supabase.from('weekly_status').select('week_start').order('week_start', { ascending: true }).limit(1).then(function(rFirst) {
                                var baseDate;
                                if (rFirst.data && rFirst.data.length > 0) {
                                    baseDate = new Date(rFirst.data[0].week_start);
                                } else {
                                    baseDate = new Date('2026-01-02');
                                }
                                baseDate.setHours(0, 0, 0, 0);
                                var targetDate = new Date(monday + 'T00:00:00');
                                var weekDiff = Math.round((targetDate - baseDate) / (7 * 86400000));
                                if (weekDiff < 0) weekDiff = 0;
                                var dynJuz = ((seq - 1 + weekDiff) % 30) + 1;
                                doUpsert(dynJuz);
                            });
                        }
                    });
                    return this;
                });
                } catch(err) { if (ok) ok({ success: false, error: err.toString() }); }
                return this;
            },
            // ----------------------------------------------------------------
            // updateSupportStatus
            // ----------------------------------------------------------------
            updateSupportStatus: function(userId, inputDateStr, newSupportStatus, customTimestamp) {
                var self = this;
                var ok = _ok;
                try {
                    var monday = normalizeToWeekStart(inputDateStr);
                    if (!monday) { if (ok) ok({ success: false, error: 'Invalid date' }); return this; }
                    var customId = null;
                    resolveMemberCustomId(userId).then(function(resolvedCustomId) {
                        if (!resolvedCustomId) { if (ok) ok({ success: false, error: 'Member not found' }); return; }
                        customId = resolvedCustomId;
                        _supabase.from('weekly_status').select('*').eq('week_start', monday).eq('member_id', customId).single().then(function(rGet) {
                        var existing = rGet.data;
                        if (!existing) { if (ok) ok({ success: false, error: 'Record not found' }); return; }
                        var timestamp = (customTimestamp && customTimestamp.trim()) ? customTimestamp.trim() : formatCurrentTimestamp();
                        var cu = window.currentUser ? window.currentUser() : null;
                        var updaterEmail = cu ? (cu.name || 'Unknown') + ' (' + (cu.email || 'no-email') + ')' : 'Web User (Supabase)';
                        var oldSupStatus = existing.support_status || 'None';
                        // Non-admins can only update the current week
                        if (cu && cu.role !== 'admin') {
                            var currentWeek = normalizeToWeekStart(new Date());
                            if (monday !== currentWeek) { if (ok) ok({ success: false, error: 'You can only update the current week.' }); return; }
                            // Non-admins must be the support reader on this record
                            _supabase.from('members').select('id').eq('custom_id', cu.customId).maybeSingle().then(function(rMid) {
                                if (!rMid.data || String(existing.supported_by_id) !== String(rMid.data.id)) {
                                    if (ok) ok({ success: false, error: 'Unauthorized' }); return;
                                }
                                doSupportUpdate();
                            });
                            return;
                        }
                        doSupportUpdate();
                        function doSupportUpdate() {
                        // Update support_status and completed_date_time
                        var updateData = { support_status: newSupportStatus };
                        if (newSupportStatus === 'Completed') updateData.completed_date_time = timestamp;
                        else updateData.completed_date_time = null;
                        var newLog = '[' + timestamp + ' - ' + updaterEmail + '] Updated Support Status from \'' + oldSupStatus + '\' to \'' + newSupportStatus + '\'';
                        updateData.audit_log = (existing.audit_log || '') + '\n' + newLog;
                            _supabase.from('weekly_status').update(updateData).eq('week_start', monday).eq('member_id', customId).then(function(rUp) {
                                if (rUp.error) { if (ok) ok({ success: false, error: rUp.error.message }); return; }
                                
                                // Notify admins and self of support status change
                                var memberName = existing.member_name || '';
                                var enName = memberName.split('|')[0].trim() || memberName.trim();
                                var supportName = existing.supported_by_name || 'Support Reader';
                                var supEnName = supportName.split('|')[0].trim() || 'Support';
                                var juzNum = existing.juz_number ? String(existing.juz_number) : '-';
                                var readerId = existing.member_id;
                                var supId = existing.supported_by_id || '';
                                Promise.all([
                                    _supabase.from('members').select('name_ta').eq('custom_id', readerId).limit(1).then(function(r) { return { data: r.data && r.data.length > 0 ? r.data[0] : null }; }),
                                    supId ? _supabase.from('members').select('name_ta').eq('id', supId).single() : Promise.resolve({ data: null })
                                ]).then(function(results) {
                                    var readerTaName = results[0].data ? results[0].data.name_ta : enName;
                                    var supTaName = results[1].data ? results[1].data.name_ta : supEnName;
                                    if (window.AppNotifications) {
                                        var nTitle = (existing.status === 'Exception Raised' ? 'Support ' + newSupportStatus : 'Status Update') + ' - ' + enName + ' | ' + (typeof readerTaName !== 'undefined' ? readerTaName : '');
                                        var nBody = 'Juz ' + juzNum + ' | Week ' + formatDateDDMMMYYYY(monday) + (existing.status === 'Exception Raised' ? ' | Support: ' + supEnName : '');
                                        var nBodyTa = 'ஜுஸ் ' + juzNum + ' | வாரம் ' + formatDateDDMMMYYYY(monday) + (existing.status === 'Exception Raised' ? ' | உதவி: ' + (typeof supTaName !== 'undefined' ? supTaName : supEnName) : '');
                                        var notificationPromise = window.AppNotifications.insertToAllAdmins ? window.AppNotifications.insertToAllAdmins(nTitle, nBody + '\n' + nBodyTa, true) : Promise.resolve();
                                        if (cu && cu.customId && cu.role !== 'admin') notificationPromise = notificationPromise.then(function() { return window.AppNotifications.insert(nTitle, nBody + '\n' + nBodyTa, cu.customId, 'user'); });
                                        if (customId && (!cu || cu.customId !== customId)) notificationPromise = notificationPromise.then(function() { return window.AppNotifications.notifyTargetUser ? window.AppNotifications.notifyTargetUser(nTitle, nBody + '\n' + nBodyTa, customId) : Promise.resolve(); });
                                        notificationPromise.then(function() { if (ok) ok({ success: true }); });
                                    } else if (ok) ok({ success: true });
                                });
                                if (false) { // Email disabled until live
                                try {
                                    var memberName = existing.member_name || '';
                                    var enName = memberName.split('|')[0].trim() || memberName.trim();
                                    var supportName = existing.supported_by_name || 'Support Reader';
                                    var supEnName = supportName.split('|')[0].trim() || 'Support';
                                    
                                    // Juz number comes from the existing record directly
                                    var juzNum = existing.juz_number ? String(existing.juz_number) : '-';
                                    
                                    // Look up Tamil names from members table
                                    var readerId = existing.member_id;
                                    var supId = existing.supported_by_id || '';
                                    
                                    Promise.all([
                                        _supabase.from('members').select('name_ta').eq('custom_id', readerId).limit(1).then(function(r) { return { data: r.data && r.data.length > 0 ? r.data[0] : null }; }),
                                        supId ? _supabase.from('members').select('name_ta').eq('id', supId).single() : Promise.resolve({ data: null })
                                    ]).then(function(results) {
                                        var readerTaName = results[0].data ? results[0].data.name_ta : enName;
                                        var supTaName = results[1].data ? results[1].data.name_ta : supEnName;
                                        
                                        var emailData = {
                                            userName: enName,
                                            userTamilName: readerTaName,
                                            juz: juzNum,
                                            week: formatDateDDMMMYYYY(monday),
                                            status: existing.status || 'Exception Raised',
                                            oldStatus: existing.status || 'Exception Raised',
                                            actionType: (existing.status === 'Exception Raised')
                                                ? (newSupportStatus === 'Completed' ? 'support_completed' : 'support_assigned')
                                                : 'status_changed',
                                            supportReader: supEnName,
                                            supportReaderTamil: supTaName,
                                            timestamp: timestamp
                                        };
                                        if (window.AppNotifications) {
                                            var nTitle = (existing.status === 'Exception Raised' ? 'Support ' + newSupportStatus : 'Status Update') + ' - ' + enName + ' | ' + (typeof readerTaName !== 'undefined' ? readerTaName : '');
                                            var nBody = 'Juz ' + juzNum + ' | Week ' + formatDateDDMMMYYYY(monday) + (existing.status === 'Exception Raised' ? ' | Support: ' + supEnName : '');
                                            var nBodyTa = 'ஜுஸ் ' + juzNum + ' | வாரம் ' + formatDateDDMMMYYYY(monday) + (existing.status === 'Exception Raised' ? ' | உதவி: ' + (typeof supTaName !== 'undefined' ? supTaName : supEnName) : '');
                                            var updaterDisplay = cu ? (cu.name || 'Unknown') : 'Web User';
                                            var adminBody = nBody + '\n' + nBodyTa + '\nBy: ' + updaterDisplay;
                                            window.AppNotifications.insertToAllAdmins(nTitle, adminBody, true);
                                        }
                                    });
                                } catch(emailErr) {
                                    console.error('Email notification failed:', emailErr);
                                }
                            }
                            
                            if (ok) ok({ success: true });
                        });
                    }
                    });
                    return this;
                });
                } catch(err) { if (ok) ok({ success: false, error: err.toString() }); }
                return this;
            },
            // ----------------------------------------------------------------
            // reassignJuz
            // ----------------------------------------------------------------
            reassignJuz: function(userId, inputDateStr, supportUserId) {
                var self = this;
                var ok = _ok;
                try {
                    var monday = normalizeToWeekStart(inputDateStr);
                    if (!monday) { if (ok) ok({ success: false, error: 'Invalid date' }); return this; }
                    // Get custom_id for weekly_status queries
                    var customId = null;
                    resolveMemberCustomId(userId).then(function(resolvedCustomId) {
                        if (!resolvedCustomId) { if (ok) ok({ success: false, error: 'Member not found' }); return; }
                        customId = resolvedCustomId;
                        // Get support user name
                        _supabase.from('members').select('name_en,name_ta').eq('id', supportUserId).single().then(function(rSup) {
                        var supName = rSup.data ? (rSup.data.name_en || 'Support') + ' | ' + (rSup.data.name_ta || '') : 'Support Reader';
                        // Get existing record
                        _supabase.from('weekly_status').select('*').eq('week_start', monday).eq('member_id', customId).single().then(function(rGet) {
                            var existing = rGet.data;
                            if (!existing) { if (ok) ok({ success: false, error: 'Record not found' }); return; }
                            var timestamp = formatCurrentTimestamp();
                            var cu = window.currentUser ? window.currentUser() : null;
                            var updaterEmail = cu ? (cu.name || 'Unknown') + ' (' + (cu.email || 'no-email') + ')' : 'Web User (Supabase)';
                            var updateData = {
                                supported_by_name: supName,
                                supported_by_id: supportUserId,
                                support_status: 'Reciting'
                            };
                            var newLog = '[' + timestamp + ' - ' + updaterEmail + '] Reassigned Juz Reciting to: ' + supName + ' (Status: Reciting)';
                            updateData.audit_log = (existing.audit_log || '') + '\n' + newLog;
                            _supabase.from('weekly_status').update(updateData).eq('week_start', monday).eq('member_id', customId).then(function(rUp) {
                                if (rUp.error) { if (ok) ok({ success: false, error: rUp.error.message }); return; }
                                
                                // Send email notification for support assignment
                                try {
                                    var memberName = existing.member_name || '';
                                    var enName = memberName.split('|')[0].trim() || 'Unknown';
                                    var supNames = (supName || '').split('|');
                                    var supEnName = (supNames[0] || 'Support').trim();
                                    var supTaName = (supNames[1] || supNames[0] || 'Support').trim();
                                    
                                    // Look up reader's Tamil name from members table
                                    _supabase.from('members').select('name_ta').eq('id', userId).single().then(function(rTa) {
                                        var taName = rTa.data ? rTa.data.name_ta : enName;
                                        var emailData = {
                                            userName: enName,
                                            userTamilName: taName,
                                            juz: String(existing.juz_number || '-'),
                                            week: formatDateDDMMMYYYY(monday),
                                            status: existing.status || 'Exception Raised',
                                            oldStatus: existing.status || '',
                                            actionType: 'support_assigned',
                                            supportReader: supEnName,
                                            supportReaderTamil: supTaName,
                                            timestamp: timestamp
                                        };
                                        if (window.AppNotifications) {
                                            var nTitle = 'Support Assigned - ' + enName + ' | ' + taName;
                                            var nBody = 'Juz ' + (existing.juz_number || '-') + ' | Week ' + formatDateDDMMMYYYY(monday) + ' | Support: ' + supEnName;
                                            var nBodyTa = 'ஜுஸ் ' + (existing.juz_number || '-') + ' | வாரம் ' + formatDateDDMMMYYYY(monday) + ' | உதவி: ' + supTaName;
                                            var updaterDisplay = cu ? (cu.name || 'Unknown') : 'Web User';
                                            var adminBody = nBody + '\n' + nBodyTa + '\nBy: ' + updaterDisplay;
                                            var notificationPromise = window.AppNotifications.insertToAllAdmins ? window.AppNotifications.insertToAllAdmins(nTitle, adminBody, true) : Promise.resolve();
                                            if (cu && cu.customId && cu.role !== 'admin') notificationPromise = notificationPromise.then(function() { return window.AppNotifications.insert(nTitle, nBody + '\n' + nBodyTa, cu.customId, 'user'); });
                                        if (customId && (!cu || cu.customId !== customId)) notificationPromise = notificationPromise.then(function() { return window.AppNotifications.notifyTargetUser ? window.AppNotifications.notifyTargetUser(nTitle, nBody + '\n' + nBodyTa, customId) : Promise.resolve(); });
                                            notificationPromise.then(function() { if (ok) ok({ success: true, assignedName: supName }); });
                                        } else if (ok) ok({ success: true, assignedName: supName });
                                    });
                                } catch(emailErr) {
                                    console.error('Email notification failed:', emailErr);
                                }
                                
                                if (ok) ok({ success: true, assignedName: supName });
                            });
                        });
                    });
                    return this;
                });
                } catch(err) { if (ok) ok({ success: false, error: err.toString() }); }
                return this;
            },
            // ----------------------------------------------------------------
            // updateHadiyaStatus
            // ----------------------------------------------------------------
            updateHadiyaStatus: function(selectedDate, newStatus) {
                var self = this;
                var ok = _ok;
                try {
                    var friday = normalizeToFriday(selectedDate);
                    if (!friday) { if (ok) ok({ success: false, error: 'Invalid date' }); return this; }
                    // Find the hadiya row for this week (PK is start_date)
                    _supabase.from('hadiya_details').select('start_date').lte('start_date', friday).order('start_date', { ascending: false }).limit(1).single().then(function(rGet) {
                        if (!rGet.data) { if (ok) ok({ success: false, error: 'Hadiya row not found' }); return; }
                        _supabase.from('hadiya_details').update({ status: newStatus }).eq('start_date', rGet.data.start_date).then(function(rUp) {
                            if (rUp.error) { if (ok) ok({ success: false, error: rUp.error.message }); return; }
                            var cu = window.currentUser ? window.currentUser() : null;
                            var updater = cu ? ((cu.name || 'Unknown') + (cu.email ? ' (' + cu.email + ')' : '')) : 'Web User';
                            var title = 'Hadiya status updated';
                            var body = 'Week ' + rGet.data.start_date + ' | Status: ' + newStatus + ' | Updated by ' + updater;
                            if (window.AppNotifications && window.AppNotifications.insertToAllAdmins) {
                                window.AppNotifications.insertToAllAdmins(title, body, true).then(function() { if (ok) ok({ success: true }); });
                            } else if (ok) ok({ success: true });
                        });
                    });
                } catch(err) { if (ok) ok({ success: false, error: err.toString() }); }
                return this;
            },
            // ----------------------------------------------------------------
            // updateHadiyaDedication
            // ----------------------------------------------------------------
            updateHadiyaDedication: function(selectedDate, dedicationEn, dedicationTa, purposeEn, purposeTa) {
                var self = this;
                var ok = _ok;
                try {
                    var friday = normalizeToFriday(selectedDate);
                    if (!friday) { if (ok) ok({ success: false, error: 'Invalid date' }); return this; }
                    _supabase.from('hadiya_details').select('start_date').lte('start_date', friday).order('start_date', { ascending: false }).limit(1).single().then(function(rGet) {
                        if (!rGet.data) { if (ok) ok({ success: false, error: 'Hadiya row not found' }); return; }
                        _supabase.from('hadiya_details').update({ 
                            dedicated_to: dedicationEn, 
                            dedicated_to_ta: dedicationTa,
                            dedicated_purpose_english: purposeEn,
                            dedicated_purpose_tamil: purposeTa
                        }).eq('start_date', rGet.data.start_date).then(function(rUp) {
                            if (rUp.error) { if (ok) ok({ success: false, error: rUp.error.message }); return; }
                            if (ok) ok({ success: true });
                        });
                    });
                } catch(err) { if (ok) ok({ success: false, error: err.toString() }); }
                return this;
            },
            // ----------------------------------------------------------------
            // fixAllHadiyaScheduleTimes - updates all rows to correct IST times
            // ----------------------------------------------------------------
            fixAllHadiyaScheduleTimes: function() {
                var self = this;
                var ok = _ok;
                _supabase.from('hadiya_details').select('start_date').order('start_date', { ascending: true }).then(function(rAll) {
                    if (!rAll.data || rAll.data.length === 0) {
                        if (ok) ok({ success: false, error: 'No hadiya rows found' });
                        return;
                    }
                    var total = rAll.data.length;
                    var done = 0;
                    rAll.data.forEach(function(row) {
                        var sd = new Date(row.start_date + 'T00:00:00');
                        var nextFri = new Date(sd);
                        nextFri.setDate(nextFri.getDate() + 7);
                        // Build UTC timestamps directly (3PM IST = 09:30 UTC, 8PM IST = 14:30 UTC)
                        var dlUTC = new Date(Date.UTC(nextFri.getFullYear(), nextFri.getMonth(), nextFri.getDate(), 9, 30, 0));
                        var nsUTC = new Date(Date.UTC(nextFri.getFullYear(), nextFri.getMonth(), nextFri.getDate(), 14, 30, 0));
                        _supabase.from('hadiya_details').update({
                            countdown_end_moment: dlUTC.toISOString(),
                            next_hadiya_start_moment: nsUTC.toISOString()
                        }).eq('start_date', row.start_date).then(function(rUp) {
                            done++;
                            if (done === total) {
                                if (ok) ok({ success: true, updated: total });
                            }
                        });
                    });
                });
                return this;
            },
            // ----------------------------------------------------------------
            // updateHadiyaScheduleTimes
            // ----------------------------------------------------------------
            updateHadiyaScheduleTimes: function(startDate, deadlineISO, nextStartISO) {
                var self = this;
                var ok = _ok;
                try {
                    if (!startDate) { if (ok) ok({ success: false, error: 'No start date provided' }); return this; }
                    _supabase.from('hadiya_details').update({ countdown_end_moment: deadlineISO, next_hadiya_start_moment: nextStartISO }).eq('start_date', startDate).then(function(rUp) {
                        if (rUp.error) { if (ok) ok({ success: false, error: rUp.error.message }); return; }
                        if (ok) ok({ success: true, deadline: deadlineISO, nextStart: nextStartISO });
                    }).catch(function(err) {
                        if (ok) ok({ success: false, error: 'Update failed: ' + (err.message || err) });
                    });
                } catch(err) { if (ok) ok({ success: false, error: err.toString() }); }
                return this;
            },
            // ----------------------------------------------------------------
            // getAllMembers - for member management (no effective_date filter)
            // ----------------------------------------------------------------
            getAllMembers: function() {
                var ok = _ok;
                _supabase.from('members').select('id,custom_id,name_en,name_ta,effective_date').order('custom_id', { ascending: true }).then(function(r) {
                    if (r.error) { if (ok) ok([]); return; }
                    if (ok) ok(r.data || []);
                });
                return this;
            },
            // ----------------------------------------------------------------
            // addMember
            // ----------------------------------------------------------------
            addMember: function(nameEn, nameTa, customId, effectiveDate) {
                var ok = _ok, err = _err;
                _supabase.from('members').insert({
                    name_en: nameEn, name_ta: nameTa, custom_id: customId,
                    effective_date: effectiveDate || null
                }).select('id').single().then(function(r) {
                    if (r.error) { console.error('addMember members err', r.error); if (err) err(r.error); else if (ok) ok({ success: false, error: r.error.message }); return; }
                    if (ok) ok({ success: true, id: r.data.id });
                });
                return this;
            },
            // ----------------------------------------------------------------
            // updateMember
            // ----------------------------------------------------------------
            updateMember: function(id, nameEn, nameTa, customId, effectiveDate) {
                var ok = _ok, err = _err;
                var cutDate = effectiveDate ? effectiveDate.slice(0,10) : new Date().toISOString().slice(0,10);
                _supabase.from('members').update({
                    name_en: nameEn, name_ta: nameTa, custom_id: customId,
                    effective_date: effectiveDate || null
                }).eq('id', id).then(function(r) {
                    if (r.error) { console.error('updateMember members err', r.error); if (err) err(r.error); else if (ok) ok({ success: false, error: r.error.message }); return; }
                    // Update weekly_status for all rows with this custom_id where week_start >= cutDate
                    _supabase.from('weekly_status').update({ member_name: nameEn }).eq('member_id', customId).gte('week_start', cutDate).then(function(r2) {
                        if (r2.error) console.error('updateMember weekly_status err', r2.error);
                        if (ok) ok({ success: true });
                    });
                });
                return this;
            },
            // ----------------------------------------------------------------
            // deleteMember
            // ----------------------------------------------------------------
            deleteMember: function(id) {
                var ok = _ok;
                _supabase.from('members').delete().eq('id', id).then(function(r) {
                    if (r.error) { if (ok) ok({ success: false, error: r.error.message }); return; }
                    if (ok) ok({ success: true });
                });
                return this;
            }
        };
        window.appApi = api;
    })();
