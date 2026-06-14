(function() {
    var currentUser = null;
    // Run this SQL in Supabase SQL Editor:
    // ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_otp TEXT;
    // ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_otp_expiry TIMESTAMPTZ;
    // ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_otp_count INTEGER DEFAULT 0;
    // ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_otp_date TEXT;
    // ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_important BOOLEAN DEFAULT FALSE;

    function loadSession() {
        try {
            var stored = localStorage.getItem('juz_auth_user');
            if (stored) currentUser = JSON.parse(stored);
        } catch(e) { currentUser = null; }
        updateAuthUI();
        if (currentUser) verifySessionRole();
    }

    function verifySessionRole() {
        _supabase.from('users').select('id, custom_id, name, email, phone, role, first_login').eq('id', currentUser.id).single().then(function(r) {
            if (r.data) {
                var changed = false;
                ['role','name','email','phone','first_login'].forEach(function(k) {
                    if (r.data[k] !== undefined && r.data[k] !== currentUser[k]) {
                        currentUser[k] = r.data[k];
                        changed = true;
                    }
                });
                if (changed) {
                    localStorage.setItem('juz_auth_user', JSON.stringify(currentUser));
                    updateAuthUI();
                }
            }
        });
    }

    function saveSession(user) {
        currentUser = user;
        localStorage.setItem('juz_auth_user', JSON.stringify(user));
        updateAuthUI();
    }

    function clearSession() {
        currentUser = null;
        localStorage.removeItem('juz_auth_user');
        updateAuthUI();
    }

    function isSignedIn() {
        return currentUser !== null;
    }

    function isAdmin() {
        return currentUser && currentUser.role === 'admin';
    }

    function getInitials(name) {
        if (!name) return '?';
        var parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
        return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }

    function updateAuthUI() {
        var btn = document.getElementById('authBtn');
        if (!btn) return;
        if (currentUser) {
            btn.innerHTML = '<span class="auth-avatar" id="authAvatar">' + getInitials(currentUser.name) + '</span>';
        } else {
            btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-7 8-7s8 3 8 7"/></svg><span id="authBtnText">Sign In</span>';
        }
        var isAdmin = currentUser && currentUser.role === 'admin';
        window._isAdmin = isAdmin;
        var membersItem = document.getElementById('manageMembersMenuItem');
        if (membersItem) membersItem.style.display = isAdmin ? '' : 'none';
        var menuBtn = document.getElementById('hadiyaMenuBtn');
        if (menuBtn) menuBtn.style.display = isAdmin ? '' : 'none';
        var shareBtn = document.getElementById('shareBtn');
        if (shareBtn) shareBtn.style.display = isAdmin ? '' : 'none';
        var bulkToggle = document.getElementById('bulkToggleBtn');
        if (bulkToggle) bulkToggle.style.display = isAdmin ? '' : 'none';
        var excBtn = document.getElementById('exceptionActionBtn');
        if (excBtn) excBtn.style.display = isAdmin ? '' : 'none';

    }

    function isValidEmail(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    }

    function isValidPhone(v) {
        return /^\+?[\d\s\-\(\)]{7,20}$/.test(v);
    }

    function clearAuthError() {
        var el = document.getElementById('authError');
        if (el) el.textContent = '';
    }

    // ---------- SIGN IN ----------
    function openSignInModal() {
        document.getElementById('signInModal').style.display = 'flex';
        document.getElementById('authLoginInput').value = '';
        document.getElementById('authPassword').value = '';
        document.getElementById('authError').textContent = '';
        setTimeout(function() { document.getElementById('authLoginInput').focus(); }, 100);
    }

    function closeSignInModal() {
        document.getElementById('signInModal').style.display = 'none';
    }

    function handleSignIn() {
        var input = document.getElementById('authLoginInput').value.trim();
        var password = document.getElementById('authPassword').value;
        var errorEl = document.getElementById('authError');
        var submitBtn = document.getElementById('authSubmitBtn');
        errorEl.textContent = '';

        if (!input) { errorEl.textContent = 'Enter email or phone number / மின்னஞல் அல்லது தொலைபேசி எண்ணை உள்ளிடவும்'; return; }
        if (!password) { errorEl.textContent = 'Enter password / கடவுச்சொல்லை உள்ளிடவும்'; return; }
        if (password.length < 4) { errorEl.textContent = 'Invalid password / தவறான கடவுச்சொல்'; return; }

        var isEmail = input.indexOf('@') > -1;
        if (isEmail && !isValidEmail(input)) { errorEl.textContent = 'Invalid email format / தவறான மின்னஞல்'; return; }
        if (!isEmail && !isValidPhone(input)) { errorEl.textContent = 'Invalid phone number / தவறான தொலைபேசி எண்'; return; }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing in...';

        var field = isEmail ? 'email' : 'phone';

        _supabase.from('users').select('*').eq(field, input).single().then(function(r) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign In';

            if (r.error) {
                if (r.error.code === 'PGRST116') {
                    errorEl.textContent = 'User not found / பயனர் கிடைக்கவில்லை';
                } else {
                    errorEl.textContent = 'Error signing in. Try again.';
                }
                return;
            }
            if (!r.data) {
                errorEl.textContent = 'User not found / பயனர் கிடைக்கவில்லை';
                return;
            }
            if (r.data.password !== password) {
                errorEl.textContent = 'Wrong password / தவறான கடவுச்சொல்';
                return;
            }

            var user = {
                id: r.data.id,
                customId: r.data.custom_id,
                name: r.data.name,
                email: r.data.email,
                phone: r.data.phone,
                role: r.data.role,
                firstLogin: r.data.first_login
            };
            saveSession(user);
            closeSignInModal();

            if (user.firstLogin) {
                setTimeout(function() { openResetPasswordModal(); }, 400);
            } else {
                location.reload();
            }
        });
    }

    // ---------- PASSWORD RESET ----------
    function openResetPasswordModal() {
        document.getElementById('resetPasswordModal').style.display = 'flex';
        document.getElementById('resetNewPassword').value = '';
        document.getElementById('resetConfirmPassword').value = '';
        document.getElementById('resetError').textContent = '';
    }

    function closeResetPasswordModal() {
        document.getElementById('resetPasswordModal').style.display = 'none';
    }

    function handleResetPassword() {
        var newPass = document.getElementById('resetNewPassword').value;
        var confirmPass = document.getElementById('resetConfirmPassword').value;
        var errorEl = document.getElementById('resetError');

        if (!newPass || newPass.length < 6) { errorEl.textContent = 'Password must be at least 6 characters / குறைந்தது 6 எழுத்துகள்'; return; }
        if (newPass !== confirmPass) { errorEl.textContent = 'Passwords do not match / கடவுச்சொற்கள் பொருந்தவில்லை'; return; }

        _supabase.from('users').update({ password: newPass, first_login: false }).eq('id', currentUser.id).then(function(r) {
            if (r.error) { errorEl.textContent = 'Failed to reset password. Try again.'; return; }
            currentUser.firstLogin = false;
            saveSession(currentUser);
            closeResetPasswordModal();
            location.reload();
        });
    }

    // ---------- FORGOT PASSWORD ----------
    var _forgotEmail = null;
    var _forgotOtpValue = null;
    var _forgotOtpExpiry = null;
    var _forgotOtpFails = 0;
    var _resendCooldownTimer = null;

    function openForgotPasswordModal() {
        closeSignInModal();
        _forgotEmail = null;
        _forgotOtpValue = null;
        _forgotOtpExpiry = null;
        _forgotOtpFails = 0;
        if (_resendCooldownTimer) { clearInterval(_resendCooldownTimer); _resendCooldownTimer = null; }
        document.getElementById('forgotStep1').style.display = 'block';
        document.getElementById('forgotStep2').style.display = 'none';
        document.getElementById('forgotStep3').style.display = 'none';
        document.getElementById('forgotEmail').value = '';
        document.getElementById('forgotOtpInput').value = '';
        document.getElementById('forgotNewPassword').value = '';
        document.getElementById('forgotConfirmPassword').value = '';
        document.getElementById('forgotError').textContent = '';
        document.getElementById('forgotOtpError').textContent = '';
        document.getElementById('forgotResetError').textContent = '';
        document.getElementById('forgotOtpExpiry').textContent = '';
        document.getElementById('forgotSendOtpBtn').disabled = false;
        document.getElementById('forgotSendOtpBtn').innerHTML = 'Send OTP<br>OTP அனுப்பு';
        document.getElementById('forgotPasswordModal').style.display = 'flex';
    }

    function closeForgotPasswordModal() {
        document.getElementById('forgotPasswordModal').style.display = 'none';
        if (_resendCooldownTimer) { clearInterval(_resendCooldownTimer); _resendCooldownTimer = null; _resendCooldownTimer = null; }
    }

    function clearForgotError() {
        document.getElementById('forgotError').textContent = '';
        document.getElementById('forgotOtpError').textContent = '';
        document.getElementById('forgotResetError').textContent = '';
    }

    function handleForgotSendOtp() {
        var email = document.getElementById('forgotEmail').value.trim() || _forgotEmail;
        var isResend = !!(document.getElementById('forgotStep2').style.display === 'block');
        var errorEl = isResend ? document.getElementById('forgotOtpError') : document.getElementById('forgotError');
        var btn = isResend ? document.getElementById('forgotVerifyOtpBtn') : document.getElementById('forgotSendOtpBtn');

        if (!email) { errorEl.textContent = 'Please enter your email / மின்னஞலை உள்ளிடவும்'; return; }
        if (email.indexOf('@') === -1) { errorEl.textContent = 'Phone login not supported for password reset. Only email is allowed. / கடவுச்சொல் மீட்டமைப்பிற்கு தொலைபேசி எண் அனுமதிக்கப்படவில்லை. மின்னஞல் மட்டுமே அனுமதிக்கப்படும்.'; return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errorEl.textContent = 'Invalid email format / தவறான மின்னஞல்'; return; }

        btn.disabled = true;
        btn.textContent = 'Sending...';

        _supabase.from('users').select('id, name, reset_otp_count, reset_otp_date').eq('email', email).maybeSingle().then(function(r) {
            if (r.error || !r.data) {
                errorEl.textContent = 'Email not found / மின்னஞல் கிடைக்கவில்லை';
                btn.disabled = false;
                btn.innerHTML = isResend ? 'Verify OTP<br>OTP ஐ சரிபார்க்க' : 'Send OTP<br>OTP அனுப்பு';
                return;
            }

            var today = new Date().toISOString().slice(0, 10);
            var otpCount = (r.data.reset_otp_date === today) ? (r.data.reset_otp_count || 0) : 0;

            if (otpCount >= 3) {
                showForgotLockModal();
                btn.disabled = false;
                btn.innerHTML = isResend ? 'Verify OTP<br>OTP ஐ சரிபார்க்க' : 'Send OTP<br>OTP அனுப்பு';
                return;
            }

            _forgotEmail = email;
            _forgotOtpFails = 0;

            var otp = String(Math.floor(100000 + Math.random() * 900000));
            _forgotOtpValue = otp;
            _forgotOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);

            _supabase.from('users').update({
                reset_otp_count: otpCount + 1,
                reset_otp_date: today
            }).eq('email', email).then(function(u) {
                if (u.error) {
                    errorEl.textContent = 'Failed to generate OTP. Try again.';
                    btn.disabled = false;
                    btn.innerHTML = isResend ? 'Verify OTP<br>OTP ஐ சரிபார்க்க' : 'Send OTP<br>OTP அனுப்பு';
                    return;
                }

                function showStep2() {
                    document.getElementById('forgotStep1').style.display = 'none';
                    document.getElementById('forgotStep2').style.display = 'block';
                    document.getElementById('forgotOtpError').textContent = '';
                    startResendCooldown();
                }

                function onEmailSent() {
                    if (isResend) document.getElementById('forgotOtpInput').value = '';
                    showStep2();
                    btn.disabled = false;
                    btn.innerHTML = 'Verify OTP<br>OTP ஐ சரிபார்க்க';
                    showSnackbar('OTP sent to ' + email + ' / OTP அனுப்பப்பட்டது', false);
                }

                function onEmailFailed() {
                    errorEl.textContent = 'Failed to send email. Try again. / மின்னஞல் அனுப்ப முடியவில்லை';
                    btn.disabled = false;
                    btn.innerHTML = isResend ? 'Verify OTP<br>OTP ஐ சரிபார்க்க' : 'Send OTP<br>OTP அனுப்பு';
                }

                if (window.EmailService && window.EmailService.sendOtpEmail) {
                    window.EmailService.sendOtpEmail(email, r.data.name || 'User', otp).then(onEmailSent).catch(onEmailFailed);
                } else {
                    onEmailSent();
                }
            });
        });
    }

    function startResendCooldown() {
        var link = document.getElementById('forgotResendLink');
        var el = document.getElementById('forgotOtpExpiry');
        if (!link || !el) return;
        if (_resendCooldownTimer) { clearInterval(_resendCooldownTimer); _resendCooldownTimer = null; }
        var cooldown = 60;
        link.style.pointerEvents = 'none';
        link.style.opacity = '0.5';
        function tick() {
            el.textContent = 'Resend in / மீண்டும் அனுப்ப: ' + cooldown + 's';
            if (cooldown <= 0) {
                el.textContent = '';
                link.style.pointerEvents = 'auto';
                link.style.opacity = '1';
                if (_resendCooldownTimer) { clearInterval(_resendCooldownTimer); _resendCooldownTimer = null; }
                return;
            }
            cooldown--;
        }
        tick();
        _resendCooldownTimer = setInterval(tick, 1000);
    }

    function handleForgotVerifyOtp() {
        var otp = document.getElementById('forgotOtpInput').value.trim();
        var errorEl = document.getElementById('forgotOtpError');

        if (!otp) { errorEl.textContent = 'Enter OTP / OTP ஐ உள்ளிடவும்'; return; }

        var btn = document.getElementById('forgotVerifyOtpBtn');
        btn.disabled = true;
        btn.textContent = 'Verifying...';

        if (!_forgotOtpValue) {
            errorEl.textContent = 'No OTP found. Request a new one. / OTP இல்லை. புதிய OTP கோருங்கள்.';
            btn.disabled = false;
            btn.innerHTML = 'Verify OTP<br>OTP ஐ சரிபார்க்க';
            return;
        }
        if (new Date() > _forgotOtpExpiry) {
            errorEl.textContent = 'OTP expired. Request a new one. / OTP காலாவதியானது';
            btn.disabled = false;
            btn.innerHTML = 'Verify OTP<br>OTP ஐ சரிபார்க்க';
            return;
        }
        if (_forgotOtpValue !== otp) {
            _forgotOtpFails++;
            _supabase.from('users').select('name').eq('email', _forgotEmail).single().then(function(rr) {
                var uname = (rr.data && rr.data.name) || _forgotEmail;
                if (_forgotOtpFails >= 3) {
                    _supabase.from('users').update({ reset_otp_count: 3, reset_otp_date: new Date().toISOString().slice(0, 10) }).eq('email', _forgotEmail).then(function() {
                        showForgotLockModal();
                    });
                    if (window.AppNotifications) {
                        window.AppNotifications.insert(
                            'Multiple failed OTP attempts - ' + _forgotEmail,
                            'User ' + uname + ' failed OTP 3 times during password reset. Account locked.\nபயனர் ' + uname + ' கடவுச்சொல் மீட்டமைப்பில் OTP ஐ 3 முறை தவறாக உள்ளிட்டார். கணக்கு பூட்டப்பட்டது.',
                            '',
                            'admin',
                            true
                        );
                    }
                }
            });
            var remaining = 3 - _forgotOtpFails;
            errorEl.textContent = 'Wrong OTP / தவறான OTP (Attempts remaining / மீதமுள்ள முயற்சிகள்: ' + remaining + ')';
            btn.disabled = false;
            btn.innerHTML = 'Verify OTP<br>OTP ஐ சரிபார்க்க';
            if (_forgotOtpFails >= 3) {
                errorEl.textContent = '';
            }
            return;
        }
        _forgotOtpFails = 0;
        if (_resendCooldownTimer) { clearInterval(_resendCooldownTimer); _resendCooldownTimer = null; _resendCooldownTimer = null; }
        document.getElementById('forgotStep2').style.display = 'none';
        document.getElementById('forgotStep3').style.display = 'block';
        btn.disabled = false;
        btn.innerHTML = 'Verify OTP<br>OTP ஐ சரிபார்க்க';
    }


    function handleForgotResetPassword() {
        var newPass = document.getElementById('forgotNewPassword').value;
        var confirmPass = document.getElementById('forgotConfirmPassword').value;
        var errorEl = document.getElementById('forgotResetError');
        var btn = document.getElementById('forgotResetBtn');

        if (!newPass || newPass.length < 6) { errorEl.textContent = 'Password must be at least 6 characters / குறைந்தது 6 எழுத்துகள்'; return; }
        if (newPass !== confirmPass) { errorEl.textContent = 'Passwords do not match / கடவுச்சொற்கள் பொருந்தவில்லை'; return; }

        btn.disabled = true;
        btn.textContent = 'Resetting...';

        _supabase.from('users').update({ password: newPass }).eq('email', _forgotEmail).then(function(r) {
            if (r.error) { errorEl.textContent = 'Failed to reset. Try again.'; btn.disabled = false; btn.innerHTML = 'Reset Password<br>கடவுச்சொல்லை மாற்று'; return; }
            showSnackbar('Password reset successfully! Sign in with your new password. / கடவுச்சொல் மாற்றப்பட்டது!', false);
            closeForgotPasswordModal();
            openSignInModal();
        });
    }

    function showForgotLockModal() {
        closeForgotPasswordModal();
        var el = document.getElementById('lockModalAdminList');
        if (el) el.innerHTML = 'Loading...';
        document.getElementById('lockModal').style.display = 'flex';
        _supabase.from('users').select('name').eq('role', 'admin').then(function(r) {
            if (!r.error && r.data && r.data.length) {
                var names = r.data.map(function(u) { return u.name; }).join(', ');
                if (el) el.textContent = names;
            } else {
                if (el) el.textContent = 'Admin (admin@example.com)';
            }
        });
    }

    function closeLockModal() {
        document.getElementById('lockModal').style.display = 'none';
    }

    // ---------- SIGN OUT MODAL ----------
    function openSignOutModal() {
        document.getElementById('signOutModal').style.display = 'flex';
    }
    function closeSignOutModal() {
        document.getElementById('signOutModal').style.display = 'none';
    }
    function handleSignOutConfirm() {
        closeSignOutModal();
        clearSession();
        location.reload();
    }

    // ---------- AUTH CLICK ----------
    function handleAuthClick() {
        if (currentUser) {
            openSignOutModal();
        } else {
            openSignInModal();
        }
    }

    // ---------- SIGN OUT ----------
    function signOut() {
        openSignOutModal();
    }

    // ---------- PASSWORD TOGGLE ----------
    function togglePassword(inputId, btn) {
        var input = document.getElementById(inputId);
        if (!input) return;
        if (input.type === 'password') {
            input.type = 'text';
            btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
        } else {
            input.type = 'password';
            btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
        }
    }

    // ---------- INIT ----------
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadSession);
    } else {
        loadSession();
    }

    window.clearAuthError = clearAuthError;
    window.handleAuthClick = handleAuthClick;
    window.openSignInModal = openSignInModal;
    window.closeSignInModal = closeSignInModal;
    window.handleSignIn = handleSignIn;
    window.openResetPasswordModal = openResetPasswordModal;
    window.closeResetPasswordModal = closeResetPasswordModal;
    window.handleResetPassword = handleResetPassword;
    window.openForgotPasswordModal = openForgotPasswordModal;
    window.closeForgotPasswordModal = closeForgotPasswordModal;
    window.handleForgotSendOtp = handleForgotSendOtp;
    window.handleForgotVerifyOtp = handleForgotVerifyOtp;
    window.handleForgotResetPassword = handleForgotResetPassword;
    window.clearForgotError = clearForgotError;
    window.closeLockModal = closeLockModal;
    window.signOut = signOut;
    window.openSignOutModal = openSignOutModal;
    window.closeSignOutModal = closeSignOutModal;
    window.handleSignOutConfirm = handleSignOutConfirm;
    window.togglePassword = togglePassword;
    window.isSignedIn = isSignedIn;
    window.isAdmin = isAdmin;
    window.currentUser = function() { return currentUser; };
})();
