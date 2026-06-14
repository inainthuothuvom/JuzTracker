(function() {
    var _pollInterval = null;
    var _lastNotifId = 0;
    var _currentTab = 'active';

    function getCurrentUserId() {
        var u = window.currentUser ? window.currentUser() : null;
        return u ? u.customId : null;
    }

    function isAdmin() {
        var u = window.currentUser ? window.currentUser() : null;
        return u && u.role === 'admin';
    }

    function requestPermission() {
        if (!('Notification' in window)) return;
        if (Notification.permission === 'default') Notification.requestPermission();
    }

    function showBrowserNotification(title, body) {
        if (!('Notification' in window)) return;
        if (Notification.permission === 'granted') {
            try { new Notification(title, { body: body }); } catch(e) {}
        }
    }

    function updateBellBadge(count) {
        var badge = document.getElementById('notifBadge');
        if (!badge) return;
        if (count > 0) { badge.textContent = count > 99 ? '99+' : count; badge.style.display = 'flex'; }
        else { badge.style.display = 'none'; }
    }

    function fetchAndDisplayNotifications() {
        var userId = getCurrentUserId();
        var admin = isAdmin();
        var query = _supabase.from('notifications').select('*').gte('id', _lastNotifId + 1).order('created_at', { ascending: false }).limit(50);
        if (admin) query = query.or('target_role.eq.admin,target_user_id.eq.' + (userId || ''));
        else if (userId) query = query.eq('target_user_id', userId);
        else return;
        query.then(function(r) {
            if (!r.data || r.data.length === 0) return;
            var unread = 0;
            for (var i = 0; i < r.data.length; i++) {
                var n = r.data[i];
                if (n.id > _lastNotifId) _lastNotifId = n.id;
                if (!n.is_read) { unread++; showBrowserNotification(n.title, n.body || ''); }
            }
            if (unread > 0) {
                _supabase.from('notifications').select('id').eq('is_read', false).then(function(cnt) {
                    var totalUnread = cnt.data ? cnt.data.length : unread;
                    updateBellBadge(totalUnread);
                });
            }
        });
    }

    function markAsRead(id) {
        _supabase.from('notifications').update({ is_read: true }).eq('id', id).then(function() {});
    }

    function archiveNotification(id) {
        _supabase.from('notifications').update({ is_read: true, is_archived: true }).eq('id', id).then(function() { renderPanel(); });
    }
    function deleteNotification(id) {
        _supabase.from('notifications').delete().eq('id', id).then(function() { renderPanel(); });
    }

    function markAllAsRead() {
        var userId = getCurrentUserId();
        var admin = isAdmin();
        var query = _supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
        if (admin) query = query.or('target_role.eq.admin,target_user_id.eq.' + (userId || ''));
        else if (userId) query = query.eq('target_user_id', userId);
        else return;
        query.then(function() { updateBellBadge(0); renderPanel(); });
    }

    function getBaseQuery(archived) {
        var userId = getCurrentUserId();
        var admin = isAdmin();
        var q = _supabase.from('notifications').select('*').eq('is_archived', archived ? true : false).order('created_at', { ascending: false }).limit(50);
        if (admin) q = q.or('target_role.eq.admin,target_user_id.eq.' + (userId || ''));
        else if (userId) q = q.eq('target_user_id', userId);
        else return null;
        return q;
    }

    function autoArchiveOld() {
        var userId = getCurrentUserId();
        var admin = isAdmin();
        var cutoff = new Date(Date.now() - 86400000).toISOString();
        var query = _supabase.from('notifications').update({ is_archived: true }).eq('is_read', true).eq('is_archived', false).lt('created_at', cutoff);
        if (admin) query = query.or('target_role.eq.admin,target_user_id.eq.' + (userId || ''));
        else if (userId) query = query.eq('target_user_id', userId);
        if (userId || admin) query.then(function() {});
    }

    function renderPanel() {
        var list = document.getElementById('notifList');
        var empty = document.getElementById('notifEmpty');
        if (!list) return;

        autoArchiveOld();

        var q = getBaseQuery(_currentTab === 'archived');
        if (!q) { if (empty) empty.style.display = 'block'; list.innerHTML = ''; return; }

        q.then(function(r) {
            list.innerHTML = '';
            if (!r.data || r.data.length === 0) { if (empty) empty.style.display = 'block'; return; }
            if (empty) empty.style.display = 'none';

            var unreadCount = 0;
            for (var i = 0; i < r.data.length; i++) {
                var n = r.data[i];
                if (!n.is_read) unreadCount++;
                var d = new Date(n.created_at);
                var timeStr = d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                (function(notifId, notifTitle, notifBody, notifTime) {
                    var div = document.createElement('div');
                    div.className = 'notif-item' + (n.is_read ? '' : ' notif-unread') + (n.is_important ? ' notif-important' : '');
                    div.innerHTML =
                        '<div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
                        '<div style="flex:1;min-width:0;">' +
                        '<div class="notif-title">' + (n.is_important ? '🔥 ' : '') + escapeHtml(n.title) + '</div>' +
                        (n.body ? '<div class="notif-body">' + escapeHtml(n.body) + '</div>' : '') +
                        '<div class="notif-time">' + timeStr + '</div>' +
                        '</div>' +
                        (n.is_archived ? '<button class="notif-mark-read" onclick="window.AppNotifications.deleteNotification(' + n.id + ')" style="flex-shrink:0;">🗑</button>' : '<button class="notif-mark-read" onclick="window.AppNotifications.archiveNotification(' + n.id + ')" style="flex-shrink:0;">✓✓</button>') +
                        '</div>';
                    div.onclick = function(e) {
                        if (e.target.tagName === 'BUTTON') return;
                        openNotifDetail(notifId, notifTitle, notifBody, notifTime);
                    };
                    list.appendChild(div);
                })(n.id, n.title, n.body || '', timeStr);
            }
            if (_currentTab === 'active') updateBellBadge(unreadCount);
        });
    }

    function switchTab(tab) {
        _currentTab = tab;
        document.querySelectorAll('.notif-tab').forEach(function(t) { t.classList.toggle('active', t.dataset.tab === tab); });
        renderPanel();
    }

    function togglePanel() {
        var panel = document.getElementById('notifPanel');
        if (!panel) return;
        if (panel.style.display === 'flex') { panel.style.display = 'none'; document.getElementById('notifPanelBg').style.display = 'none'; return; }
        if (_currentTab !== 'active') switchTab('active');
        panel.style.display = 'flex';
        document.getElementById('notifPanelBg').style.display = 'block';
        renderPanel();
    }

    function closePanel() { var p = document.getElementById('notifPanel'); if (p) p.style.display = 'none'; var bg = document.getElementById('notifPanelBg'); if (bg) bg.style.display = 'none'; }

    function openNotifDetail(id, title, body, timeStr) {
        var overlay = document.getElementById('notifDetailOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'notifDetailOverlay';
            overlay.className = 'notif-detail-overlay';
            overlay.innerHTML =
                '<div class="notif-detail-modal">' +
                '<div class="notif-detail-header">' +
                '<span class="notif-detail-title" id="notifDetailTitle"></span>' +
                '<span class="close-btn" onclick="window.AppNotifications.closeNotifDetail()">&times;</span>' +
                '</div>' +
                '<div class="notif-detail-time" id="notifDetailTime"></div>' +
                '<div class="notif-detail-body" id="notifDetailBody"></div>' +
                '</div>';
            overlay.onclick = function(e) { if (e.target === overlay) closeNotifDetail(); };
            document.body.appendChild(overlay);
        }
        document.getElementById('notifDetailTitle').textContent = title;
        document.getElementById('notifDetailTime').textContent = timeStr;
        document.getElementById('notifDetailBody').textContent = body || '';
        overlay.style.display = 'flex';
    }

    function closeNotifDetail() {
        var overlay = document.getElementById('notifDetailOverlay');
        if (overlay) overlay.style.display = 'none';
    }

    function init() {
        var authBtn = document.getElementById('authBtn');
        if (!authBtn) { setTimeout(init, 500); return; }

        var user = window.currentUser ? window.currentUser() : null;
        if (!user) return;

        var bell = document.createElement('button');
        bell.id = 'notifBellBtn';
        bell.className = 'auth-btn';
        bell.style.position = 'relative';
        bell.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg><span id="notifBadge" class="notif-badge" style="display:none;">0</span>';
        bell.onclick = togglePanel;
        authBtn.parentNode.insertBefore(bell, authBtn);

        var panelBg = document.createElement('div');
        panelBg.id = 'notifPanelBg';
        panelBg.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:9998;';
        panelBg.onclick = closePanel;
        document.body.appendChild(panelBg);

        var panel = document.createElement('div');
        panel.id = 'notifPanel';
        panel.className = 'notif-panel';
        panel.innerHTML =
            '<div style="display:flex;justify-content:flex-end;padding:4px 8px 0;">' +
            '<span class="close-btn" onclick="window.AppNotifications.closePanel()" style="font-size:1.3rem;position:static;">&times;</span>' +
            '</div>' +
            '<hr style="border:none;border-top:1px solid #30363d;margin:0;">' +
            '<div class="notif-panel-header">' +
            '<span style="font-weight:600;font-size:0.9rem;">Notifications</span>' +
            '<button class="notif-action-btn" onclick="window.AppNotifications.markAllAsRead()" style="margin-left:auto;">Mark all read</button>' +
            '</div>' +
            '<div class="notif-tabs">' +
            '<button class="notif-tab active" data-tab="active" onclick="window.AppNotifications.switchTab(\'active\')">Active</button>' +
            '<button class="notif-tab" data-tab="archived" onclick="window.AppNotifications.switchTab(\'archived\')">Archived</button>' +
            '</div>' +
            '<div id="notifList" class="notif-list"></div>' +
            '<div id="notifEmpty" class="notif-empty" style="display:none;">No notifications</div>';
        document.body.appendChild(panel);

        if (isAdmin()) requestPermission();
        fetchAndDisplayNotifications();
        _pollInterval = setInterval(fetchAndDisplayNotifications, 30000);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    function insert(title, body, targetUserId, targetRole, isImportant) {
        if (targetRole === 'admin' && !targetUserId) {
            return _supabase.from('users').select('custom_id').eq('role', 'admin').then(function(admins) {
                if (!admins.data || admins.data.length === 0) return;
                var rows = admins.data.map(function(a) {
                    return { title: title, body: body || '', target_user_id: a.custom_id, target_role: 'admin', is_read: false, is_important: isImportant || false };
                });
                return _supabase.from('notifications').insert(rows).then(function(r) {
                    if (r.error) console.error('Notif error:', r.error);
                    return r;
                });
            });
        }
        return _supabase.from('notifications').insert({
            title: title, body: body || '', target_user_id: targetUserId || '',
            target_role: targetRole || 'admin', is_read: false, is_important: isImportant || false
        }).then(function(r) { if (r.error) console.error('Notif error:', r.error); return r; });
    }

    window.AppNotifications = {
        insert: insert, markAsRead: markAsRead, archiveNotification: archiveNotification,
        deleteNotification: deleteNotification,
        markAllAsRead: markAllAsRead, renderPanel: renderPanel, switchTab: switchTab,
        togglePanel: togglePanel, closePanel: closePanel, requestPermission: requestPermission,
        showBrowserNotification: showBrowserNotification,
        openNotifDetail: openNotifDetail, closeNotifDetail: closeNotifDetail
    };
})();
