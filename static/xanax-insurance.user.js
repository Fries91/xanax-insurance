// ==UserScript==
// @name         Sinner’s Insurance
// @namespace    fries91-xanax-insurance
// @version      4.0.0
// @description  War Bot style insurance overlay for Torn
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @run-at       document-idle
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @connect      xanax-insurance.onrender.com
// @updateURL    https://raw.githubusercontent.com/Fries91/xanax-insurance/main/static/xanax-insurance.user.js
// @downloadURL  https://raw.githubusercontent.com/Fries91/xanax-insurance/main/static/xanax-insurance.user.js
// ==/UserScript==

(function () {
    'use strict';

    if (window.__SINNERS_INSURANCE_V400__ && document.getElementById('warins-shield')) return;
    window.__SINNERS_INSURANCE_V400__ = true;

    var API_BASE = 'https://xanax-insurance.onrender.com';

    var K_SESSION = 'warins_session_v1';
    var K_API_KEY = 'warins_api_key_v1';
    var K_MEMBER = 'warins_member_v1';
    var K_TAB = 'warins_tab_v1';
    var K_OPEN = 'warins_open_v1';
    var K_SHIELD_POS = 'warins_shield_pos_v1';
    var K_OVERLAY_SCROLL = 'warins_overlay_scroll_v1';

    var TAB_ROW_1 = [
        ['xanax_stack', 'Stack'],
        ['jump_1_4', '1-4 Jumps'],
        ['xanax_only', 'Single'],
        ['settings', 'Settings']
    ];

    var overlay = null;
    var shield = null;
    var mounted = false;
    var remountTimer = null;

    var state = {
        session_token: String(GM_getValue(K_SESSION, '') || ''),
        api_key: String(GM_getValue(K_API_KEY, '') || ''),
        member: GM_getValue(K_MEMBER, null) || null,
        plans: [],
        meByPlan: {},
        adminClaims: null,
        adminPayouts: null,
        currentTab: String(GM_getValue(K_TAB, 'settings') || 'settings'),
        isOpen: !!GM_getValue(K_OPEN, false),
        noticeText: '',
        noticeType: ''
    };

    function saveStateBits() {
        GM_setValue(K_SESSION, state.session_token || '');
        GM_setValue(K_API_KEY, state.api_key || '');
        GM_setValue(K_MEMBER, state.member || null);
        GM_setValue(K_TAB, state.currentTab || 'settings');
        GM_setValue(K_OPEN, !!state.isOpen);
    }

    function clearAuth() {
        state.session_token = '';
        state.api_key = '';
        state.member = null;
        state.meByPlan = {};
        state.adminClaims = null;
        state.adminPayouts = null;
        GM_deleteValue(K_SESSION);
        GM_deleteValue(K_API_KEY);
        GM_deleteValue(K_MEMBER);
        saveStateBits();
    }

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function money(v) {
        var n = Number(v || 0);
        return isFinite(n) ? ('$' + n.toLocaleString()) : '$0';
    }

    function fmtDate(v) {
        if (!v) return '—';
        try {
            var d = new Date(v);
            if (!isNaN(d.getTime())) return d.toLocaleString();
        } catch (_e) {}
        return String(v);
    }

    function statusPillClass(status) {
        status = String(status || '').toLowerCase();
        if (status === 'approved' || status === 'active' || status === 'paid') return 'good';
        if (status === 'pending') return 'warn';
        if (status === 'denied' || status === 'inactive') return 'bad';
        return 'neutral';
    }

    function getHeaders(extra) {
        var h = Object.assign({}, extra || {});
        if (state.session_token) h['X-Session-Token'] = state.session_token;
        return h;
    }

    function apiGet(path, cb) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: API_BASE + path,
            timeout: 20000,
            headers: getHeaders(),
            onload: function (res) {
                try {
                    cb(null, JSON.parse(res.responseText || '{}'));
                } catch (_e) {
                    cb(new Error('Bad JSON'));
                }
            },
            onerror: function () { cb(new Error('Request failed')); },
            ontimeout: function () { cb(new Error('Timed out')); }
        });
    }

    function apiPost(path, payload, cb) {
        GM_xmlhttpRequest({
            method: 'POST',
            url: API_BASE + path,
            timeout: 20000,
            headers: getHeaders({ 'Content-Type': 'application/json' }),
            data: JSON.stringify(payload || {}),
            onload: function (res) {
                try {
                    cb(null, JSON.parse(res.responseText || '{}'));
                } catch (_e) {
                    cb(new Error('Bad JSON'));
                }
            },
            onerror: function () { cb(new Error('Request failed')); },
            ontimeout: function () { cb(new Error('Timed out')); }
        });
    }

    function setNotice(text, type) {
        state.noticeText = String(text || '');
        state.noticeType = String(type || '');
        renderNotice();
    }

    function renderNotice() {
        if (!overlay) return;
        var host = overlay.querySelector('#warins-status');
        if (!host) return;
        if (!state.noticeText) {
            host.style.display = 'none';
            host.innerHTML = '';
            return;
        }
        var cls = state.noticeType === 'error' ? 'bad' : (state.noticeType === 'success' ? 'good' : 'warn');
        host.style.display = 'block';
        host.innerHTML = '<div class="warins-pill ' + cls + '">' + esc(state.noticeText) + '</div>';
    }

    function addStyles() {
        if (document.getElementById('warins-style')) return;
        var css = "\
#warins-shield {\
  position: fixed !important;\
  z-index: 2147483647 !important;\
  width: 36px !important;\
  height: 36px !important;\
  border-radius: 10px !important;\
  display: flex !important;\
  align-items: center !important;\
  justify-content: center !important;\
  font-size: 18px !important;\
  line-height: 1 !important;\
  cursor: pointer !important;\
  user-select: none !important;\
  -webkit-user-select: none !important;\
  -webkit-touch-callout: none !important;\
  -webkit-tap-highlight-color: transparent !important;\
  touch-action: none !important;\
  box-shadow: 0 8px 24px rgba(0,0,0,.45) !important;\
  border: 1px solid rgba(255,255,255,.10) !important;\
  background: radial-gradient(circle at 30% 20%, rgba(72,199,217,.98), rgba(16,90,110,.98) 55%, rgba(8,38,46,.98)) !important;\
  color: #fff !important;\
  left: auto !important;\
  right: 14px !important;\
  top: 50% !important;\
  bottom: auto !important;\
  transform: translateY(-50%) !important;\
  opacity: 1 !important;\
  visibility: visible !important;\
  pointer-events: auto !important;\
}\
#warins-overlay {\
  position: fixed !important;\
  z-index: 2147483646 !important;\
  left: 8px !important;\
  right: 8px !important;\
  top: 8px !important;\
  bottom: 8px !important;\
  width: auto !important;\
  max-width: 520px !important;\
  margin: 0 auto !important;\
  border-radius: 14px !important;\
  background: linear-gradient(180deg, #171717, #0c0c0c) !important;\
  color: #f2f2f2 !important;\
  border: 1px solid rgba(255,255,255,.08) !important;\
  box-shadow: 0 16px 38px rgba(0,0,0,.54) !important;\
  display: none !important;\
  flex-direction: column !important;\
  box-sizing: border-box !important;\
  overflow: hidden !important;\
}\
#warins-overlay.open { display: flex !important; }\
#warins-overlay *, #warins-overlay *::before, #warins-overlay *::after { box-sizing: border-box !important; }\
.warins-head {\
  flex: 0 0 auto !important;\
  padding: 12px 12px 10px !important;\
  border-bottom: 1px solid rgba(255,255,255,.08) !important;\
  background: rgba(255,255,255,.03) !important;\
}\
.warins-toprow {\
  display: flex !important;\
  align-items: center !important;\
  justify-content: space-between !important;\
  gap: 10px !important;\
  width: 100% !important;\
}\
.warins-title {\
  font-weight: 800 !important;\
  font-size: 16px !important;\
  letter-spacing: .2px !important;\
  color: #fff !important;\
}\
.warins-sub {\
  opacity: .72 !important;\
  font-size: 11px !important;\
  margin-top: 2px !important;\
  color: #fff !important;\
}\
.warins-close {\
  appearance: none !important;\
  -webkit-appearance: none !important;\
  border: 0 !important;\
  border-radius: 10px !important;\
  background: rgba(255,255,255,.08) !important;\
  color: #fff !important;\
  padding: 6px 10px !important;\
  font-weight: 700 !important;\
  cursor: pointer !important;\
  font-size: 12px !important;\
  min-height: 34px !important;\
  min-width: 58px !important;\
}\
.warins-tabs {\
  display: flex !important;\
  gap: 4px !important;\
  padding: 6px 8px !important;\
  overflow-x: auto !important;\
  overflow-y: hidden !important;\
  -webkit-overflow-scrolling: touch !important;\
  scrollbar-width: none !important;\
  flex-wrap: nowrap !important;\
}\
.warins-tabs::-webkit-scrollbar { display:none !important; }\
.warins-tab {\
  appearance: none !important;\
  -webkit-appearance: none !important;\
  border: 1px solid rgba(255,255,255,.10) !important;\
  background: rgba(255,255,255,.06) !important;\
  color: #fff !important;\
  border-radius: 10px !important;\
  padding: 7px 9px !important;\
  min-height: 34px !important;\
  min-width: 78px !important;\
  font-size: 12px !important;\
  font-weight: 700 !important;\
  line-height: 1.1 !important;\
  white-space: nowrap !important;\
  flex: 0 0 auto !important;\
  cursor: pointer !important;\
}\
.warins-tab.active {\
  background: linear-gradient(180deg, rgba(72,199,217,.95), rgba(16,90,110,.98)) !important;\
  border-color: rgba(255,255,255,.16) !important;\
}\
.warins-body {\
  flex: 1 1 auto !important;\
  min-height: 0 !important;\
  overflow-y: auto !important;\
  overflow-x: hidden !important;\
  -webkit-overflow-scrolling: touch !important;\
  padding: 12px !important;\
}\
.warins-card {\
  background: rgba(255,255,255,.04) !important;\
  border: 1px solid rgba(255,255,255,.08) !important;\
  border-radius: 12px !important;\
  padding: 10px !important;\
  box-shadow: inset 0 1px 0 rgba(255,255,255,.03) !important;\
  margin-bottom: 10px !important;\
}\
.warins-grid { display: grid !important; gap: 10px !important; }\
.warins-col { display:flex !important; flex-direction:column !important; gap:8px !important; }\
.warins-row { display:flex !important; align-items:center !important; gap:8px !important; flex-wrap:wrap !important; }\
.warins-kv {\
  display:grid !important;\
  grid-template-columns:1fr auto !important;\
  gap:8px !important;\
  align-items:center !important;\
  padding:8px 0 !important;\
  border-bottom:1px solid rgba(255,255,255,.05) !important;\
}\
.warins-kv:last-child { border-bottom:0 !important; }\
.warins-input, .warins-textarea {\
  width: 100% !important;\
  padding: 10px 11px !important;\
  border-radius: 10px !important;\
  border: 1px solid rgba(255,255,255,.12) !important;\
  background: rgba(255,255,255,.07) !important;\
  color: #fff !important;\
  outline: none !important;\
  font-size: 16px !important;\
}\
.warins-textarea { min-height:110px !important; resize:vertical !important; }\
.warins-btn {\
  appearance: none !important;\
  -webkit-appearance: none !important;\
  border: 1px solid rgba(255,255,255,.12) !important;\
  background: linear-gradient(180deg, rgba(72,199,217,.95), rgba(16,90,110,.98)) !important;\
  color: #fff !important;\
  border-radius: 10px !important;\
  padding: 9px 12px !important;\
  min-height: 38px !important;\
  font-size: 13px !important;\
  font-weight: 800 !important;\
  cursor: pointer !important;\
}\
.warins-btn.ghost { background: rgba(255,255,255,.08) !important; }\
.warins-btn.green { background: linear-gradient(180deg, rgba(42,168,95,.98), rgba(21,120,64,.98)) !important; }\
.warins-btn.red { background: linear-gradient(180deg, rgba(220,90,90,.98), rgba(145,18,18,.98)) !important; }\
.warins-btn.warn { background: linear-gradient(180deg, rgba(226,154,27,.98), rgba(163,102,8,.98)) !important; }\
.warins-btn.disabled { opacity:.45 !important; pointer-events:none !important; }\
.warins-pill {\
  display:inline-flex !important;\
  align-items:center !important;\
  justify-content:center !important;\
  min-height:24px !important;\
  padding:4px 8px !important;\
  border-radius:999px !important;\
  font-size:12px !important;\
  font-weight:800 !important;\
  line-height:1 !important;\
  border:1px solid rgba(255,255,255,.10) !important;\
  background:rgba(255,255,255,.08) !important;\
  color:#fff !important;\
}\
.warins-pill.good { background: rgba(36,140,82,.35) !important; }\
.warins-pill.bad { background: rgba(170,32,32,.35) !important; }\
.warins-pill.warn { background: rgba(197,142,32,.35) !important; }\
.warins-pill.neutral { background: rgba(255,255,255,.08) !important; }\
.warins-title-row {\
  display:flex !important;\
  align-items:center !important;\
  justify-content:space-between !important;\
  gap:8px !important;\
  margin-bottom:8px !important;\
}\
@media (max-width: 520px) {\
  #warins-shield {\
    width: 44px !important;\
    height: 44px !important;\
    font-size: 22px !important;\
    border-radius: 12px !important;\
  }\
  #warins-overlay {\
    left: 6px !important;\
    right: 6px !important;\
    top: 6px !important;\
    bottom: 6px !important;\
    max-width: none !important;\
    border-radius: 12px !important;\
  }\
  .warins-body { padding:10px !important; }\
}\
";
        var style = document.createElement('style');
        style.id = 'warins-style';
        style.textContent = css;
        document.head.appendChild(style);
    }

    function getViewport() {
        var de = document.documentElement || {};
        return {
            w: Math.max(de.clientWidth || 0, window.innerWidth || 0, 320),
            h: Math.max(de.clientHeight || 0, window.innerHeight || 0, 320)
        };
    }

    function loadPos(key, fallback) {
        var raw = GM_getValue(key, null);
        if (!raw) return { left: fallback.left, top: fallback.top };
        if (typeof raw === 'string') {
            try { raw = JSON.parse(raw); } catch (_e) { return { left: fallback.left, top: fallback.top }; }
        }
        if (!raw || typeof raw !== 'object') return { left: fallback.left, top: fallback.top };
        return {
            left: isFinite(Number(raw.left)) ? Number(raw.left) : fallback.left,
            top: isFinite(Number(raw.top)) ? Number(raw.top) : fallback.top
        };
    }

    function savePos(key, pos) {
        GM_setValue(key, { left: Math.round(Number(pos.left || 0)), top: Math.round(Number(pos.top || 0)) });
    }

    function applyShieldPos() {
        if (!shield) return;
        if (document.body && shield.parentNode !== document.body) document.body.appendChild(shield);
        shield.style.left = 'auto';
        shield.style.right = '14px';
        shield.style.top = 'auto';
        shield.style.bottom = '84px';
        shield.style.transform = 'none';
    }

    function makeShieldDraggable() {
        if (!shield || shield.__warinsDragBound) return;
        shield.__warinsDragBound = true;
        shield.addEventListener('click', function () {
            toggleOverlay();
        });
    }

    function isLoggedIn() {
        return !!state.session_token;
    }

    function getPlan(planKey) {
        for (var i = 0; i < state.plans.length; i++) {
            if (String(state.plans[i].plan_key) === String(planKey)) return state.plans[i];
        }
        return null;
    }

    function ensurePlans(cb) {
        if (state.plans && state.plans.length) return cb(null, state.plans);
        apiGet('/api/insurance/plans', function (err, data) {
            if (err) return cb(err);
            if (!data || !data.ok) return cb(new Error((data && data.error) || 'Could not load plans'));
            state.plans = Array.isArray(data.plans) ? data.plans : [];
            if (state.currentTab !== 'settings' && !getPlan(state.currentTab) && state.plans.length) {
                state.currentTab = state.plans[0].plan_key;
                saveStateBits();
            }
            cb(null, state.plans);
        });
    }

    function ensureMe(planKey, cb) {
        if (state.meByPlan[planKey]) return cb(null, state.meByPlan[planKey]);
        apiGet('/api/insurance/me?plan_key=' + encodeURIComponent(planKey), function (err, data) {
            if (err) return cb(err);
            if (!data || !data.ok) return cb(new Error((data && data.error) || 'Could not load member data'));
            state.meByPlan[planKey] = data;
            state.member = data.member || state.member;
            saveStateBits();
            cb(null, data);
        });
    }

    function ensureAdminClaims(cb) {
        if (!state.member || !state.member.is_admin) return cb(null, []);
        if (state.adminClaims) return cb(null, state.adminClaims);
        apiGet('/api/insurance/admin/claims', function (err, data) {
            if (err) return cb(err);
            if (!data || !data.ok) return cb(new Error((data && data.error) || 'Could not load admin claims'));
            state.adminClaims = Array.isArray(data.claims) ? data.claims : [];
            cb(null, state.adminClaims);
        });
    }

    function ensureAdminPayouts(cb) {
        if (!state.member || !state.member.is_admin) return cb(null, []);
        if (state.adminPayouts) return cb(null, state.adminPayouts);
        apiGet('/api/insurance/admin/payouts', function (err, data) {
            if (err) return cb(err);
            if (!data || !data.ok) return cb(new Error((data && data.error) || 'Could not load admin payouts'));
            state.adminPayouts = Array.isArray(data.payouts) ? data.payouts : [];
            cb(null, state.adminPayouts);
        });
    }

    function renderTabsRow(rowId, rows) {
        var host = overlay && overlay.querySelector('#' + rowId);
        if (!host) return;
        host.innerHTML = rows.map(function (pair) {
            var key = pair[0];
            var label = pair[1];
            var active = key === state.currentTab ? ' active' : '';
            return '<button type="button" class="warins-tab' + active + '" data-tab="' + esc(key) + '">' + esc(label) + '</button>';
        }).join('');
        host.querySelectorAll('[data-tab]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                state.currentTab = btn.getAttribute('data-tab') || 'settings';
                saveStateBits();
                renderBody();
            });
        });
    }

    function renderSettingsTab() {
        var member = state.member || null;
        return [
            '<div class="warins-grid">',
                '<div class="warins-card warins-col">',
                    '<div class="warins-title">Settings</div>',
                    '<div class="warins-sub">Log in, manage session, and read how insurance works</div>',
                '</div>',

                '<div class="warins-card warins-col">',
                    '<h3>How to start</h3>',
                    '<div>1. Enter your Torn API key below and log in.</div>',
                    '<div>2. Once logged in, open one of the three insurance tabs.</div>',
                    '<div>3. Enroll in a plan and then submit claims from that tab.</div>',
                    '<div>4. Admin can review claims and mark payouts paid.</div>',
                '</div>',

                '<div class="warins-card warins-col">',
                    '<h3>API key and session</h3>',
                    '<div>Your API key is used to verify your Torn identity and faction membership.</div>',
                    '<div>A session token is then stored locally so the overlay can keep working.</div>',
                    '<div>Insurance data may be visible to admins for claim review and payout logging.</div>',
                '</div>',

                '<div class="warins-card warins-col">',
                    '<h3>Login</h3>',
                    '<input id="warins-api-key" class="warins-input" type="password" placeholder="Enter Torn API key" value="' + esc(state.api_key || '') + '"/>',
                    '<div class="warins-row">',
                        '<button type="button" class="warins-btn" id="warins-login-btn">Login</button>',
                        (member ? '<button type="button" class="warins-btn ghost" id="warins-logout-btn">Logout</button>' : ''),
                        '<button type="button" class="warins-btn ghost" id="warins-refresh-btn">Refresh</button>',
                    '</div>',
                '</div>',

                (member ? [
                    '<div class="warins-card">',
                        '<h3>Verified session</h3>',
                        '<div class="warins-kv"><div>Name</div><div>' + esc(member.name || '') + '</div></div>',
                        '<div class="warins-kv"><div>Torn ID</div><div>' + esc(member.torn_id || '') + '</div></div>',
                        '<div class="warins-kv"><div>Position</div><div>' + esc(member.position || 'Member') + '</div></div>',
                        '<div class="warins-kv"><div>Status</div><div><span class="warins-pill good">' + (member.is_admin ? 'Admin' : 'Verified') + '</span></div></div>',
                    '</div>'
                ].join('') : '')
            ].join('')
        ].join('');
    }

    function renderPlanTab(plan, meData) {
        var enrollment = meData && meData.enrollment && !Array.isArray(meData.enrollment) ? meData.enrollment : null;
        var claims = meData && Array.isArray(meData.claims) ? meData.claims : [];
        var payouts = meData && Array.isArray(meData.payouts) ? meData.payouts : [];
        var rules = meData && meData.plan_rules ? meData.plan_rules : null;
        var latestClaim = claims.length ? claims[0] : null;
        var canSubmit = !rules || !!rules.can_submit_claim;

        return [
            '<div class="warins-card">',
                '<div class="warins-title-row"><strong>' + esc(plan.title) + '</strong><span class="warins-pill neutral">' + esc(plan.plan_key) + '</span></div>',
                '<div class="warins-kv"><div>Premium</div><div>' + money(plan.premium_amount) + '</div></div>',
                '<div class="warins-kv"><div>Payout</div><div>' + money(plan.payout_amount) + '</div></div>',
                '<div class="warins-kv"><div>Coverage Count</div><div>' + (plan.min_count === plan.max_count ? plan.max_count : (plan.min_count + ' to ' + plan.max_count)) + '</div></div>',
                '<div class="warins-sub">' + esc(plan.description || '') + '</div>',
            '</div>',

            '<div class="warins-card">',
                '<div class="warins-title-row"><strong>My policy</strong><span class="warins-pill ' + (enrollment ? 'good' : 'bad') + '">' + (enrollment ? 'Enrolled' : 'Not enrolled') + '</span></div>',
                '<div class="warins-kv"><div>Enrollment</div><div>' + (enrollment ? esc(enrollment.status || 'active') : 'none') + '</div></div>',
                '<div class="warins-kv"><div>Last Claim</div><div>' + (latestClaim ? esc(latestClaim.status || 'pending') : 'none yet') + '</div></div>',
                '<div class="warins-row" style="margin-top:10px">',
                    '<button type="button" class="warins-btn green" data-action="enroll" data-plan="' + esc(plan.plan_key) + '">Enroll</button>',
                    '<button type="button" class="warins-btn ghost" data-action="refresh-plan" data-plan="' + esc(plan.plan_key) + '">Refresh</button>',
                '</div>',
            '</div>',

            (rules ? [
                '<div class="warins-card">',
                    '<div class="warins-title-row"><strong>Plan rules</strong><span class="warins-pill ' + (canSubmit ? 'good' : 'warn') + '">' + (canSubmit ? 'Ready' : 'Blocked') + '</span></div>',
                    '<div class="warins-kv"><div>Cooldown</div><div>' + esc(rules.cooldown_hours) + 'h</div></div>',
                    '<div class="warins-kv"><div>Pending Claims</div><div>' + esc(rules.pending_claims) + ' / ' + esc(rules.max_pending_claims) + '</div></div>',
                    '<div class="warins-kv"><div>Cooldown Ends</div><div>' + esc(rules.cooldown_until || 'Ready now') + '</div></div>',
                    (rules.block_reason ? '<div class="warins-sub">' + esc(rules.block_reason) + '</div>' : ''),
                '</div>'
            ].join('') : ''),

            '<div class="warins-card">',
                '<div class="warins-title-row"><strong>Submit claim</strong><span class="warins-pill ' + (canSubmit ? 'good' : 'bad') + '">' + (canSubmit ? 'Ready' : 'Blocked') + '</span></div>',
                '<div class="warins-col">',
                    '<div>Jump count</div>',
                    '<input id="warins-claim-jump" class="warins-input" type="number" min="' + esc(plan.min_count) + '" max="' + esc(plan.max_count) + '" value="' + esc(plan.max_count) + '"/>',
                    '<div>Proof / note</div>',
                    '<textarea id="warins-claim-proof" class="warins-textarea" placeholder="Add proof, note, or claim text here..."></textarea>',
                    '<div class="warins-row">',
                        '<button type="button" class="warins-btn ' + (canSubmit ? '' : 'disabled') + '" data-action="submit-claim" data-plan="' + esc(plan.plan_key) + '">Submit Claim</button>',
                    '</div>',
                '</div>',
            '</div>',

            '<div class="warins-card">',
                '<div class="warins-title-row"><strong>Recent claims</strong><span class="warins-pill neutral">' + claims.length + '</span></div>',
                (claims.length ? claims.slice(0, 5).map(function (c) {
                    return '<div class="warins-card" style="margin:0 0 8px 0;padding:8px">' +
                        '<div class="warins-title-row"><strong>Claim #' + esc(c.id) + '</strong><span class="warins-pill ' + statusPillClass(c.status) + '">' + esc(c.status) + '</span></div>' +
                        '<div class="warins-kv"><div>Requested</div><div>' + money(c.requested_amount) + '</div></div>' +
                        '<div class="warins-kv"><div>Jump Count</div><div>' + esc(c.jump_count) + '</div></div>' +
                        '<div class="warins-kv"><div>Submitted</div><div>' + esc(fmtDate(c.created_at)) + '</div></div>' +
                        '<div class="warins-sub">' + esc(c.proof_text || 'No note') + '</div>' +
                    '</div>';
                }).join('') : '<div>No claims yet.</div>'),
            '</div>',

            '<div class="warins-card">',
                '<div class="warins-title-row"><strong>Recent payouts</strong><span class="warins-pill neutral">' + payouts.length + '</span></div>',
                (payouts.length ? payouts.slice(0, 5).map(function (p) {
                    return '<div class="warins-card" style="margin:0 0 8px 0;padding:8px">' +
                        '<div class="warins-title-row"><strong>Payout #' + esc(p.id) + '</strong><span class="warins-pill good">paid</span></div>' +
                        '<div class="warins-kv"><div>Amount</div><div>' + money(p.amount_paid) + '</div></div>' +
                        '<div class="warins-kv"><div>Claim ID</div><div>' + esc(p.claim_id) + '</div></div>' +
                        '<div class="warins-kv"><div>Paid By</div><div>' + esc(p.paid_by_name || p.paid_by) + '</div></div>' +
                        '<div class="warins-kv"><div>Date</div><div>' + esc(fmtDate(p.created_at)) + '</div></div>' +
                    '</div>';
                }).join('') : '<div>No payouts yet.</div>'),
            '</div>'
        ].join('');
    }

    function renderAdminArea() {
        if (!state.member || !state.member.is_admin) return '';
        var claims = Array.isArray(state.adminClaims) ? state.adminClaims : [];
        var payouts = Array.isArray(state.adminPayouts) ? state.adminPayouts : [];

        return [
            '<div class="warins-card">',
                '<div class="warins-title-row"><strong>Admin</strong><span class="warins-pill good">Admin</span></div>',
                '<div class="warins-row"><button type="button" class="warins-btn ghost" id="warins-admin-refresh">Refresh Admin</button></div>',
            '</div>',

            '<div class="warins-card">',
                '<div class="warins-title-row"><strong>Claims Queue</strong><span class="warins-pill neutral">' + claims.length + '</span></div>',
                (claims.length ? claims.slice(0, 20).map(function (c) {
                    var status = String(c.status || '').toLowerCase();
                    var canPay = status === 'approved';
                    return '<div class="warins-card" style="margin:0 0 8px 0;padding:8px">' +
                        '<div class="warins-title-row"><strong>#' + esc(c.id) + ' ' + esc(c.name) + '</strong><span class="warins-pill ' + statusPillClass(c.status) + '">' + esc(c.status) + '</span></div>' +
                        '<div class="warins-kv"><div>Plan</div><div>' + esc(c.plan_key) + '</div></div>' +
                        '<div class="warins-kv"><div>Requested</div><div>' + money(c.requested_amount) + '</div></div>' +
                        '<div class="warins-kv"><div>Jump Count</div><div>' + esc(c.jump_count) + '</div></div>' +
                        '<div class="warins-sub">' + esc(c.proof_text || 'No note') + '</div>' +
                        '<input class="warins-input" id="warins-pay-note-' + esc(c.id) + '" type="text" placeholder="Optional payout note" style="margin-top:8px"/>' +
                        '<div class="warins-row" style="margin-top:8px">' +
                            '<button type="button" class="warins-btn green ' + (status === 'pending' ? '' : 'disabled') + '" data-admin="approve" data-claim="' + esc(c.id) + '">Approve</button>' +
                            '<button type="button" class="warins-btn red ' + (status === 'pending' ? '' : 'disabled') + '" data-admin="deny" data-claim="' + esc(c.id) + '">Deny</button>' +
                            '<button type="button" class="warins-btn warn ' + (canPay ? '' : 'disabled') + '" data-admin="pay" data-claim="' + esc(c.id) + '">Mark Paid</button>' +
                        '</div>' +
                    '</div>';
                }).join('') : '<div>No claims yet.</div>'),
            '</div>',

            '<div class="warins-card">',
                '<div class="warins-title-row"><strong>Payout Log</strong><span class="warins-pill neutral">' + payouts.length + '</span></div>',
                (payouts.length ? payouts.slice(0, 10).map(function (p) {
                    return '<div class="warins-card" style="margin:0 0 8px 0;padding:8px">' +
                        '<div class="warins-title-row"><strong>Payout #' + esc(p.id) + '</strong><span class="warins-pill good">paid</span></div>' +
                        '<div class="warins-kv"><div>Member</div><div>' + esc(p.member_name) + '</div></div>' +
                        '<div class="warins-kv"><div>Amount</div><div>' + money(p.amount_paid) + '</div></div>' +
                        '<div class="warins-kv"><div>Claim ID</div><div>' + esc(p.claim_id) + '</div></div>' +
                        '<div class="warins-kv"><div>Date</div><div>' + esc(fmtDate(p.created_at)) + '</div></div>' +
                    '</div>';
                }).join('') : '<div>No payouts yet.</div>'),
            '</div>'
        ].join('');
    }

    function renderBody() {
        if (!overlay) return;

        renderTabsRow('warins-tabs-row-1', TAB_ROW_1);

        var content = overlay.querySelector('#warins-content');
        if (!content) return;

        if (state.currentTab === 'settings') {
            content.innerHTML = renderSettingsTab();
            renderNotice();
            bindDynamicInputs();
            return;
        }

        if (!isLoggedIn()) {
            content.innerHTML = '<div class="warins-card">Please log in from Settings first.</div>' + renderSettingsTab();
            renderNotice();
            bindDynamicInputs();
            return;
        }

        var plan = getPlan(state.currentTab);
        if (!plan) {
            content.innerHTML = '<div class="warins-card">Plan not found.</div>';
            renderNotice();
            bindDynamicInputs();
            return;
        }

        content.innerHTML = '<div class="warins-card">Loading...</div>';
        renderNotice();

        ensureMe(plan.plan_key, function (err, meData) {
            if (err) {
                clearAuth();
                content.innerHTML = '<div class="warins-card">Session expired or data failed to load. Please log in again.</div>' + renderSettingsTab();
                renderNotice();
                bindDynamicInputs();
                return;
            }

            ensureAdminClaims(function () {
                ensureAdminPayouts(function () {
                    content.innerHTML = renderPlanTab(plan, meData) + renderAdminArea();
                    renderNotice();
                    bindDynamicInputs();
                });
            });
        });

        var body = overlay.querySelector('#warins-body');
        if (body) {
            var scrollTop = Number(GM_getValue(K_OVERLAY_SCROLL, 0) || 0);
            if (isFinite(scrollTop) && scrollTop > 0) body.scrollTop = scrollTop;
            if (!body.__warinsScrollBound) {
                body.__warinsScrollBound = true;
                body.addEventListener('scroll', function () {
                    GM_setValue(K_OVERLAY_SCROLL, body.scrollTop || 0);
                }, { passive: true });
            }
        }
    }

    function bindDynamicInputs() {
        if (!overlay) return;

        var loginBtn = overlay.querySelector('#warins-login-btn');
        if (loginBtn && !loginBtn.__warinsBound) {
            loginBtn.__warinsBound = true;
            loginBtn.addEventListener('click', function () {
                var input = overlay.querySelector('#warins-api-key');
                var key = String((input && input.value) || '').trim();
                if (!key) {
                    setNotice('Enter your Torn API key.', 'error');
                    return;
                }
                state.api_key = key;
                saveStateBits();
                setNotice('Logging in...', 'warn');
                apiPost('/api/insurance/auth/verify', { api_key: key }, function (err, data) {
                    if (err) return setNotice('Login failed.', 'error');
                    if (!data || !data.ok || !data.session_token) return setNotice((data && data.error) || 'Login failed.', 'error');
                    state.session_token = data.session_token || '';
                    state.member = data.member || null;
                    state.meByPlan = {};
                    state.adminClaims = null;
                    state.adminPayouts = null;
                    if (state.plans.length) state.currentTab = state.plans[0].plan_key;
                    saveStateBits();
                    setNotice('Logged in successfully.', 'success');
                    renderBody();
                });
            });
        }

        var logoutBtn = overlay.querySelector('#warins-logout-btn');
        if (logoutBtn && !logoutBtn.__warinsBound) {
            logoutBtn.__warinsBound = true;
            logoutBtn.addEventListener('click', function () {
                apiPost('/api/insurance/auth/logout', {}, function () {
                    clearAuth();
                    state.currentTab = 'settings';
                    saveStateBits();
                    setNotice('Logged out.', 'success');
                    renderBody();
                });
            });
        }

        var refreshBtn = overlay.querySelector('#warins-refresh-btn');
        if (refreshBtn && !refreshBtn.__warinsBound) {
            refreshBtn.__warinsBound = true;
            refreshBtn.addEventListener('click', function () {
                state.meByPlan = {};
                state.adminClaims = null;
                state.adminPayouts = null;
                setNotice('Refreshing...', 'warn');
                renderBody();
            });
        }

        var adminRefresh = overlay.querySelector('#warins-admin-refresh');
        if (adminRefresh && !adminRefresh.__warinsBound) {
            adminRefresh.__warinsBound = true;
            adminRefresh.addEventListener('click', function () {
                state.adminClaims = null;
                state.adminPayouts = null;
                setNotice('Refreshing admin...', 'warn');
                renderBody();
            });
        }

        overlay.querySelectorAll('[data-action]').forEach(function (btn) {
            if (btn.__warinsBound) return;
            btn.__warinsBound = true;
            btn.addEventListener('click', function () {
                var action = btn.getAttribute('data-action');
                var planKey = btn.getAttribute('data-plan');
                if (action === 'enroll') {
                    setNotice('Enrolling...', 'warn');
                    apiPost('/api/insurance/enroll', { plan_key: planKey }, function (err, data) {
                        if (err) return setNotice('Enroll failed.', 'error');
                        if (!data || !data.ok) return setNotice((data && data.error) || 'Enroll failed.', 'error');
                        delete state.meByPlan[planKey];
                        setNotice('Enrolled successfully.', 'success');
                        renderBody();
                    });
                    return;
                }
                if (action === 'refresh-plan') {
                    delete state.meByPlan[planKey];
                    setNotice('Refreshing plan...', 'warn');
                    renderBody();
                    return;
                }
                if (action === 'submit-claim') {
                    var jumpEl = overlay.querySelector('#warins-claim-jump');
                    var proofEl = overlay.querySelector('#warins-claim-proof');
                    var jumpCount = Number((jumpEl && jumpEl.value) || 1);
                    var proofText = String((proofEl && proofEl.value) || '').trim();
                    setNotice('Submitting claim...', 'warn');
                    apiPost('/api/insurance/claim', {
                        plan_key: planKey,
                        jump_count: jumpCount,
                        proof_text: proofText
                    }, function (err, data) {
                        if (err) return setNotice('Claim failed.', 'error');
                        if (!data || !data.ok) return setNotice((data && data.error) || 'Claim failed.', 'error');
                        delete state.meByPlan[planKey];
                        setNotice('Claim submitted.', 'success');
                        renderBody();
                    });
                }
            });
        });

        overlay.querySelectorAll('[data-admin]').forEach(function (btn) {
            if (btn.__warinsBound) return;
            btn.__warinsBound = true;
            btn.addEventListener('click', function () {
                var action = btn.getAttribute('data-admin');
                var claimId = btn.getAttribute('data-claim');
                if (!claimId) return;

                if (action === 'approve' || action === 'deny') {
                    setNotice(action === 'approve' ? 'Approving claim...' : 'Denying claim...', 'warn');
                    apiPost('/api/insurance/admin/claims/' + claimId + '/' + action, {}, function (err, data) {
                        if (err) return setNotice('Admin action failed.', 'error');
                        if (!data || !data.ok) return setNotice((data && data.error) || 'Admin action failed.', 'error');
                        state.adminClaims = null;
                        state.adminPayouts = null;
                        state.meByPlan = {};
                        setNotice(action === 'approve' ? 'Claim approved.' : 'Claim denied.', 'success');
                        renderBody();
                    });
                    return;
                }

                if (action === 'pay') {
                    var noteEl = overlay.querySelector('#warins-pay-note-' + claimId);
                    var paymentNote = String((noteEl && noteEl.value) || '').trim();
                    setNotice('Marking claim paid...', 'warn');
                    apiPost('/api/insurance/admin/claims/' + claimId + '/pay', { payment_note: paymentNote }, function (err, data) {
                        if (err) return setNotice('Mark paid failed.', 'error');
                        if (!data || !data.ok) return setNotice((data && data.error) || 'Mark paid failed.', 'error');
                        state.adminClaims = null;
                        state.adminPayouts = null;
                        state.meByPlan = {};
                        setNotice('Claim marked paid.', 'success');
                        renderBody();
                    });
                }
            });
        });
    }

    function setOverlayOpen(v) {
        state.isOpen = !!v;
        saveStateBits();
        if (!overlay) return;
        overlay.classList.toggle('open', state.isOpen);
        if (state.isOpen) renderBody();
    }

    function createShield() {
        if (shield) return shield;
        shield = document.createElement('div');
        shield.id = 'warins-shield';
        shield.textContent = '💊';
        shield.title = 'Sinner’s Insurance';
        document.body.appendChild(shield);
        makeShieldDraggable();
        return shield;
    }

    function createOverlay() {
        if (overlay) return overlay;
        overlay = document.createElement('div');
        overlay.id = 'warins-overlay';
        overlay.innerHTML = [
            '<div class="warins-head">',
                '<div class="warins-toprow">',
                    '<div>',
                        '<div class="warins-title">Sinner’s Insurance</div>',
                        '<div class="warins-sub">War Bot style faction insurance overlay</div>',
                    '</div>',
                    '<button type="button" class="warins-close" id="warins-close-btn">Close</button>',
                '</div>',
                '<div id="warins-status" style="display:none;margin-top:8px;"></div>',
                '<div class="warins-tabs" id="warins-tabs-row-1"></div>',
            '</div>',
            '<div class="warins-body" id="warins-body">',
                '<div id="warins-content"></div>',
            '</div>'
        ].join('');
        document.body.appendChild(overlay);

        var closeBtn = overlay.querySelector('#warins-close-btn');
        if (closeBtn) closeBtn.addEventListener('click', function () {
            setOverlayOpen(false);
        });

        return overlay;
    }

    function mount() {
        if (mounted) {
            applyShieldPos();
            setOverlayOpen(state.isOpen);
            return;
        }
        addStyles();
        createShield();
        createOverlay();
        applyShieldPos();
        setOverlayOpen(state.isOpen);
        mounted = true;
    }

    function ensureMounted() {
        if (!document.body) return;
        var hasShield = !!document.getElementById('warins-shield');
        var hasOverlay = !!document.getElementById('warins-overlay');
        if (!hasShield || !hasOverlay || !shield || !overlay) {
            mounted = false;
            shield = null;
            overlay = null;
            mount();
        } else {
            applyShieldPos();
        }
    }

    function startRemountWatch() {
        if (remountTimer) {
            clearInterval(remountTimer);
            remountTimer = null;
        }
        remountTimer = setInterval(function () {
            try {
                if (!document.body) return;
                if (!document.getElementById('warins-shield') || !document.getElementById('warins-overlay')) {
                    mounted = false;
                    shield = null;
                    overlay = null;
                    ensureMounted();
                    renderBody();
                } else {
                    applyShieldPos();
                }
            } catch (_err) {}
        }, 2000);
    }

    function boot() {
        ensureMounted();
        startRemountWatch();
        ensurePlans(function () {
            renderBody();
        });

        window.addEventListener('resize', function () {
            applyShieldPos();
        });


    }

    boot();
})();
