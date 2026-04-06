// ==UserScript==
// @name         Sinner’s Insurance
// @namespace    fries91-xanax-insurance
// @version      3.0.0
// @description  Simple faction insurance overlay for Torn
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @connect      xanax-insurance.onrender.com
// @updateURL    https://raw.githubusercontent.com/Fries91/xanax-insurance/main/static/xanax-insurance.user.js
// @downloadURL  https://raw.githubusercontent.com/Fries91/xanax-insurance/main/static/xanax-insurance.user.js
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    if (window.__SINNERS_INSURANCE_V300__ && document.getElementById('xi-fab')) return;
    window.__SINNERS_INSURANCE_V300__ = true;

    var API_BASE = 'https://xanax-insurance.onrender.com';
    var STORAGE = {
        session: 'xi_session_token',
        apiKey: 'xi_api_key',
        member: 'xi_member',
        tab: 'xi_current_tab',
        open: 'xi_overlay_open'
    };

    var state = {
        overlayOpen: !!GM_getValue(STORAGE.open, false),
        currentTab: String(GM_getValue(STORAGE.tab, 'settings') || 'settings'),
        session_token: String(GM_getValue(STORAGE.session, '') || ''),
        api_key: String(GM_getValue(STORAGE.apiKey, '') || ''),
        member: GM_getValue(STORAGE.member, null) || null,
        plans: [],
        meByPlan: {},
        adminClaims: null,
        adminPayouts: null,
        loading: false,
        noticeType: '',
        noticeText: ''
    };

    function saveStateBits() {
        GM_setValue(STORAGE.open, !!state.overlayOpen);
        GM_setValue(STORAGE.tab, String(state.currentTab || 'settings'));
        GM_setValue(STORAGE.session, state.session_token || '');
        GM_setValue(STORAGE.apiKey, state.api_key || '');
        GM_setValue(STORAGE.member, state.member || null);
    }

    function clearAuth() {
        state.session_token = '';
        state.api_key = '';
        state.member = null;
        state.adminClaims = null;
        state.adminPayouts = null;
        state.meByPlan = {};
        GM_deleteValue(STORAGE.session);
        GM_deleteValue(STORAGE.apiKey);
        GM_deleteValue(STORAGE.member);
        saveStateBits();
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function money(value) {
        var n = Number(value || 0);
        if (!isFinite(n)) return '$0';
        return '$' + n.toLocaleString();
    }

    function fmtDate(value) {
        if (!value) return '—';
        try {
            var d = new Date(value);
            if (!isNaN(d.getTime())) return d.toLocaleString();
        } catch (_e) {}
        return String(value);
    }

    function getHeaders(extra) {
        var h = extra ? Object.assign({}, extra) : {};
        if (state.session_token) h['X-Session-Token'] = state.session_token;
        return h;
    }

    function setNotice(type, text) {
        state.noticeType = String(type || '');
        state.noticeText = String(text || '');
        renderNotice();
    }

    function apiGet(path, cb) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: API_BASE + path,
            timeout: 20000,
            headers: getHeaders(),
            onload: function (res) {
                try { cb(null, JSON.parse(res.responseText || '{}')); }
                catch (_e) { cb(new Error('Bad JSON')); }
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
                try { cb(null, JSON.parse(res.responseText || '{}')); }
                catch (_e) { cb(new Error('Bad JSON')); }
            },
            onerror: function () { cb(new Error('Request failed')); },
            ontimeout: function () { cb(new Error('Timed out')); }
        });
    }

    function statusClass(status) {
        status = String(status || '').toLowerCase();
        if (status === 'approved' || status === 'active' || status === 'paid') return 'good';
        if (status === 'pending') return 'warn';
        if (status === 'denied' || status === 'inactive') return 'bad';
        return 'neutral';
    }

    function addStyles() {
        GM_addStyle(`
#xi-fab{
    position:fixed!important;
    z-index:2147483647!important;
    width:36px!important;
    height:36px!important;
    border-radius:10px!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    font-size:18px!important;
    line-height:1!important;
    cursor:pointer!important;
    user-select:none!important;
    -webkit-user-select:none!important;
    -webkit-touch-callout:none!important;
    -webkit-tap-highlight-color:transparent!important;
    touch-action:none!important;
    box-shadow:0 8px 24px rgba(0,0,0,.45)!important;
    border:1px solid rgba(255,255,255,.10)!important;
    background:radial-gradient(circle at 30% 20%, rgba(72,199,217,.98), rgba(16,90,110,.98) 55%, rgba(8,38,46,.98))!important;
    color:#fff!important;
    left:0!important;
    top:0!important;
    right:auto!important;
    bottom:auto!important;
    transform:none!important;
    opacity:1!important;
    visibility:visible!important;
    pointer-events:auto!important;
}
#xi-overlay{
    position:fixed!important;
    z-index:2147483646!important;
    left:8px!important;
    right:8px!important;
    top:8px!important;
    bottom:8px!important;
    width:auto!important;
    max-width:520px!important;
    margin:0 auto!important;
    border-radius:14px!important;
    background:linear-gradient(180deg,#171f23,#0d1418)!important;
    color:#eefbfd!important;
    border:1px solid rgba(255,255,255,.08)!important;
    box-shadow:0 16px 38px rgba(0,0,0,.54)!important;
    display:none!important;
    flex-direction:column!important;
    box-sizing:border-box!important;
    overflow:hidden!important;
    font-family:Arial,Helvetica,sans-serif!important;
}
#xi-overlay.open{display:flex!important}
#xi-overlay *,#xi-overlay *::before,#xi-overlay *::after{box-sizing:border-box!important}
#xi-head{
    flex:0 0 auto!important;
    padding:12px!important;
    border-bottom:1px solid rgba(255,255,255,.08)!important;
    background:rgba(255,255,255,.03)!important;
}
#xi-top{
    display:flex!important;
    align-items:center!important;
    justify-content:space-between!important;
    gap:10px!important;
}
#xi-brand{
    display:flex!important;
    align-items:center!important;
    gap:10px!important;
}
#xi-brand-icon{
    width:34px!important;
    height:34px!important;
    border-radius:10px!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    font-size:18px!important;
    background:radial-gradient(circle at 30% 20%, rgba(72,199,217,.98), rgba(16,90,110,.98) 55%, rgba(8,38,46,.98))!important;
    border:1px solid rgba(255,255,255,.10)!important;
}
#xi-title{font-size:16px!important;font-weight:800!important;color:#fff!important}
#xi-sub{opacity:.75!important;font-size:11px!important;margin-top:2px!important}
#xi-close{
    appearance:none!important;-webkit-appearance:none!important;border:0!important;border-radius:10px!important;
    background:rgba(255,255,255,.08)!important;color:#fff!important;padding:6px 10px!important;
    font-weight:700!important;cursor:pointer!important;font-size:12px!important;min-height:34px!important;min-width:58px!important;
}
#xi-tabs{
    display:flex!important;gap:4px!important;padding:6px 8px!important;overflow-x:auto!important;overflow-y:hidden!important;
    -webkit-overflow-scrolling:touch!important;scrollbar-width:none!important;flex-wrap:nowrap!important;
}
#xi-tabs::-webkit-scrollbar{display:none!important}
.xi-tab{
    appearance:none!important;-webkit-appearance:none!important;border:1px solid rgba(255,255,255,.10)!important;
    background:rgba(255,255,255,.06)!important;color:#fff!important;border-radius:10px!important;padding:7px 9px!important;
    min-height:34px!important;min-width:78px!important;font-size:12px!important;font-weight:700!important;white-space:nowrap!important;flex:0 0 auto!important;cursor:pointer!important;
}
.xi-tab.active{background:linear-gradient(180deg,rgba(72,199,217,.95),rgba(16,90,110,.98))!important}
#xi-body{
    flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;
    -webkit-overflow-scrolling:touch!important;padding:12px!important;
}
.xi-card{
    background:rgba(255,255,255,.04)!important;border:1px solid rgba(255,255,255,.08)!important;border-radius:12px!important;
    padding:10px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.03)!important;margin-bottom:10px!important;
}
.xi-title-row{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;margin-bottom:8px!important}
.xi-btn{
    appearance:none!important;-webkit-appearance:none!important;border:1px solid rgba(255,255,255,.12)!important;
    background:linear-gradient(180deg, rgba(72,199,217,.95), rgba(16,90,110,.98))!important;color:#fff!important;border-radius:10px!important;
    padding:9px 12px!important;min-height:38px!important;font-size:13px!important;font-weight:800!important;cursor:pointer!important;
}
.xi-btn.ghost{background:rgba(255,255,255,.08)!important}
.xi-btn.green{background:linear-gradient(180deg, rgba(42,168,95,.98), rgba(21,120,64,.98))!important}
.xi-btn.red{background:linear-gradient(180deg, rgba(220,90,90,.98), rgba(145,18,18,.98))!important}
.xi-btn.warn{background:linear-gradient(180deg, rgba(226,154,27,.98), rgba(163,102,8,.98))!important}
.xi-btn.disabled{opacity:.45!important;pointer-events:none!important}
.xi-row{display:flex!important;align-items:center!important;gap:8px!important;flex-wrap:wrap!important}
.xi-col{display:flex!important;flex-direction:column!important;gap:8px!important}
.xi-kv{
    display:grid!important;grid-template-columns:1fr auto!important;gap:8px!important;align-items:center!important;
    padding:8px 0!important;border-bottom:1px solid rgba(255,255,255,.05)!important;
}
.xi-kv:last-child{border-bottom:0!important}
.xi-input,.xi-textarea{
    width:100%!important;padding:10px 11px!important;border-radius:10px!important;border:1px solid rgba(255,255,255,.12)!important;
    background:rgba(255,255,255,.07)!important;color:#fff!important;outline:none!important;font-size:16px!important;
}
.xi-textarea{min-height:110px!important;resize:vertical!important}
.xi-pill{
    display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:24px!important;padding:4px 8px!important;
    border-radius:999px!important;font-size:12px!important;font-weight:800!important;border:1px solid rgba(255,255,255,.10)!important;background:rgba(255,255,255,.08)!important;color:#fff!important;
}
.xi-pill.good{background:rgba(36,140,82,.35)!important}
.xi-pill.bad{background:rgba(170,32,32,.35)!important}
.xi-pill.warn{background:rgba(197,142,32,.35)!important}
.xi-pill.neutral{background:rgba(255,255,255,.08)!important}
@media (max-width:520px){
    #xi-fab{width:44px!important;height:44px!important;font-size:22px!important;border-radius:12px!important}
    #xi-overlay{left:6px!important;right:6px!important;top:6px!important;bottom:6px!important;max-width:none!important;border-radius:12px!important}
    #xi-body{padding:10px!important}
}
        `);
    }

    function applyFabPos() {
        var fab = document.getElementById('xi-fab');
        if (!fab) return;
        var vpW = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0, 320);
        var vpH = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0, 320);
        var left = Math.max(8, vpW - 50);
        var top = Math.max(24, Math.round(vpH * 0.45) - 54);
        fab.style.left = left + 'px';
        fab.style.top = top + 'px';
        fab.style.right = 'auto';
        fab.style.bottom = 'auto';
        fab.style.transform = 'none';
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

    function renderNotice() {
        var host = document.getElementById('xi-notice');
        if (!host) return;
        if (!state.noticeText) {
            host.innerHTML = '';
            return;
        }
        var cls = state.noticeType === 'error' ? 'bad' : (state.noticeType === 'success' ? 'good' : 'warn');
        host.innerHTML = '<div class="xi-pill ' + cls + '">' + escapeHtml(state.noticeText) + '</div>';
    }

    function renderSettings() {
        var member = state.member || null;
        return [
            '<div class="xi-card">',
                '<div class="xi-title-row"><strong>Settings</strong><span class="xi-pill neutral">Login</span></div>',
                '<div class="xi-col">',
                    '<label>Torn API Key</label>',
                    '<input id="xi-api-key" class="xi-input" type="password" placeholder="Enter Torn API key" value="' + escapeHtml(state.api_key || '') + '"/>',
                    '<div class="xi-row">',
                        '<button type="button" class="xi-btn" id="xi-login-btn">Login</button>',
                        (member ? '<button type="button" class="xi-btn ghost" id="xi-logout-btn">Logout</button>' : ''),
                        '<button type="button" class="xi-btn ghost" id="xi-refresh-btn">Refresh</button>',
                    '</div>',
                '</div>',
            '</div>',
            (member ? [
                '<div class="xi-card">',
                    '<div class="xi-title-row"><strong>Verified Session</strong><span class="xi-pill good">' + (member.is_admin ? 'Admin' : 'Verified') + '</span></div>',
                    '<div class="xi-kv"><div>Name</div><div>' + escapeHtml(member.name || '') + '</div></div>',
                    '<div class="xi-kv"><div>Torn ID</div><div>' + escapeHtml(member.torn_id || '') + '</div></div>',
                    '<div class="xi-kv"><div>Position</div><div>' + escapeHtml(member.position || 'Member') + '</div></div>',
                '</div>'
            ].join('') : ''),
            '<div class="xi-card">',
                '<div class="xi-title-row"><strong>How it works</strong><span class="xi-pill neutral">Info</span></div>',
                '<div class="xi-col">',
                    '<div>1. Log in with your Torn API key.</div>',
                    '<div>2. Enroll in a plan.</div>',
                    '<div>3. Submit claims from the plan tab.</div>',
                    '<div>4. Admin can approve, deny, and mark payouts paid.</div>',
                '</div>',
            '</div>'
        ].join('');
    }

    function renderPlan(plan, me) {
        var enrollment = me && me.enrollment && !Array.isArray(me.enrollment) ? me.enrollment : null;
        var claims = me && Array.isArray(me.claims) ? me.claims : [];
        var payouts = me && Array.isArray(me.payouts) ? me.payouts : [];
        var rules = me && me.plan_rules ? me.plan_rules : null;
        var latestClaim = claims.length ? claims[0] : null;
        var canSubmit = !rules || !!rules.can_submit_claim;

        return [
            '<div class="xi-card">',
                '<div class="xi-title-row"><strong>' + escapeHtml(plan.title) + '</strong><span class="xi-pill neutral">' + escapeHtml(plan.plan_key) + '</span></div>',
                '<div class="xi-kv"><div>Premium</div><div>' + money(plan.premium_amount) + '</div></div>',
                '<div class="xi-kv"><div>Payout</div><div>' + money(plan.payout_amount) + '</div></div>',
                '<div class="xi-kv"><div>Coverage Count</div><div>' + (plan.min_count === plan.max_count ? plan.max_count : (plan.min_count + ' to ' + plan.max_count)) + '</div></div>',
                '<div style="margin-top:8px;opacity:.8">' + escapeHtml(plan.description || '') + '</div>',
            '</div>',

            '<div class="xi-card">',
                '<div class="xi-title-row"><strong>My Policy</strong><span class="xi-pill ' + (enrollment ? 'good' : 'bad') + '">' + (enrollment ? 'Enrolled' : 'Not Enrolled') + '</span></div>',
                '<div class="xi-kv"><div>Enrollment</div><div>' + (enrollment ? escapeHtml(enrollment.status || 'active') : 'none') + '</div></div>',
                '<div class="xi-kv"><div>Last Claim</div><div>' + (latestClaim ? escapeHtml(latestClaim.status || 'pending') : 'none yet') + '</div></div>',
                '<div class="xi-row" style="margin-top:10px">',
                    '<button type="button" class="xi-btn green" data-action="enroll" data-plan="' + escapeHtml(plan.plan_key) + '">Enroll</button>',
                    '<button type="button" class="xi-btn ghost" data-action="refresh-plan" data-plan="' + escapeHtml(plan.plan_key) + '">Refresh</button>',
                '</div>',
            '</div>',

            (rules ? [
                '<div class="xi-card">',
                    '<div class="xi-title-row"><strong>Plan Rules</strong><span class="xi-pill ' + (canSubmit ? 'good' : 'warn') + '">' + (canSubmit ? 'Ready' : 'Blocked') + '</span></div>',
                    '<div class="xi-kv"><div>Cooldown</div><div>' + escapeHtml(rules.cooldown_hours) + 'h</div></div>',
                    '<div class="xi-kv"><div>Pending Claims</div><div>' + escapeHtml(rules.pending_claims) + ' / ' + escapeHtml(rules.max_pending_claims) + '</div></div>',
                    '<div class="xi-kv"><div>Cooldown Ends</div><div>' + escapeHtml(rules.cooldown_until || 'Ready now') + '</div></div>',
                    (rules.block_reason ? '<div style="margin-top:8px;opacity:.8">' + escapeHtml(rules.block_reason) + '</div>' : ''),
                '</div>'
            ].join('') : ''),

            '<div class="xi-card">',
                '<div class="xi-title-row"><strong>Submit Claim</strong><span class="xi-pill ' + (canSubmit ? 'good' : 'bad') + '">' + (canSubmit ? 'Ready' : 'Blocked') + '</span></div>',
                '<div class="xi-col">',
                    '<label>Jump Count</label>',
                    '<input id="xi-claim-jump" class="xi-input" type="number" min="' + escapeHtml(plan.min_count) + '" max="' + escapeHtml(plan.max_count) + '" value="' + escapeHtml(plan.max_count) + '"/>',
                    '<label>Proof / Note</label>',
                    '<textarea id="xi-claim-proof" class="xi-textarea" placeholder="Add proof, notes, or claim text here..."></textarea>',
                    '<div class="xi-row">',
                        '<button type="button" class="xi-btn ' + (canSubmit ? '' : 'disabled') + '" data-action="submit-claim" data-plan="' + escapeHtml(plan.plan_key) + '">Submit Claim</button>',
                    '</div>',
                '</div>',
            '</div>',

            '<div class="xi-card">',
                '<div class="xi-title-row"><strong>Recent Claims</strong><span class="xi-pill neutral">' + claims.length + '</span></div>',
                (claims.length ? claims.slice(0, 5).map(function (c) {
                    return '<div class="xi-card" style="margin:0 0 8px 0;padding:8px">' +
                        '<div class="xi-title-row"><strong>Claim #' + escapeHtml(c.id) + '</strong><span class="xi-pill ' + statusClass(c.status) + '">' + escapeHtml(c.status) + '</span></div>' +
                        '<div class="xi-kv"><div>Requested</div><div>' + money(c.requested_amount) + '</div></div>' +
                        '<div class="xi-kv"><div>Jump Count</div><div>' + escapeHtml(c.jump_count) + '</div></div>' +
                        '<div class="xi-kv"><div>Submitted</div><div>' + escapeHtml(fmtDate(c.created_at)) + '</div></div>' +
                        '<div style="margin-top:6px;opacity:.8">' + escapeHtml(c.proof_text || 'No note') + '</div>' +
                    '</div>';
                }).join('') : '<div>No claims yet.</div>'),
            '</div>',

            '<div class="xi-card">',
                '<div class="xi-title-row"><strong>Recent Payouts</strong><span class="xi-pill neutral">' + payouts.length + '</span></div>',
                (payouts.length ? payouts.slice(0, 5).map(function (p) {
                    return '<div class="xi-card" style="margin:0 0 8px 0;padding:8px">' +
                        '<div class="xi-title-row"><strong>Payout #' + escapeHtml(p.id) + '</strong><span class="xi-pill good">paid</span></div>' +
                        '<div class="xi-kv"><div>Amount</div><div>' + money(p.amount_paid) + '</div></div>' +
                        '<div class="xi-kv"><div>Claim ID</div><div>' + escapeHtml(p.claim_id) + '</div></div>' +
                        '<div class="xi-kv"><div>Paid By</div><div>' + escapeHtml(p.paid_by_name || p.paid_by) + '</div></div>' +
                        '<div class="xi-kv"><div>Date</div><div>' + escapeHtml(fmtDate(p.created_at)) + '</div></div>' +
                    '</div>';
                }).join('') : '<div>No payouts yet.</div>'),
            '</div>'
        ].join('');
    }

    function renderAdmin() {
        if (!state.member || !state.member.is_admin) return '';
        var claims = Array.isArray(state.adminClaims) ? state.adminClaims : [];
        var payouts = Array.isArray(state.adminPayouts) ? state.adminPayouts : [];

        return [
            '<div class="xi-card">',
                '<div class="xi-title-row"><strong>Admin</strong><span class="xi-pill good">Admin</span></div>',
                '<div class="xi-row"><button type="button" class="xi-btn ghost" id="xi-admin-refresh">Refresh Admin</button></div>',
            '</div>',

            '<div class="xi-card">',
                '<div class="xi-title-row"><strong>Claims Queue</strong><span class="xi-pill neutral">' + claims.length + '</span></div>',
                (claims.length ? claims.slice(0, 20).map(function (c) {
                    var canPay = String(c.status || '').toLowerCase() === 'approved';
                    return '<div class="xi-card" style="margin:0 0 8px 0;padding:8px">' +
                        '<div class="xi-title-row"><strong>#' + escapeHtml(c.id) + ' ' + escapeHtml(c.name) + '</strong><span class="xi-pill ' + statusClass(c.status) + '">' + escapeHtml(c.status) + '</span></div>' +
                        '<div class="xi-kv"><div>Plan</div><div>' + escapeHtml(c.plan_key) + '</div></div>' +
                        '<div class="xi-kv"><div>Requested</div><div>' + money(c.requested_amount) + '</div></div>' +
                        '<div class="xi-kv"><div>Jump Count</div><div>' + escapeHtml(c.jump_count) + '</div></div>' +
                        '<div style="margin-top:6px;opacity:.8">' + escapeHtml(c.proof_text || 'No note') + '</div>' +
                        '<input class="xi-input" id="xi-pay-note-' + escapeHtml(c.id) + '" type="text" placeholder="Optional payout note" style="margin-top:8px"/>' +
                        '<div class="xi-row" style="margin-top:8px">' +
                            '<button type="button" class="xi-btn green ' + (String(c.status || '').toLowerCase() === 'pending' ? '' : 'disabled') + '" data-admin="approve" data-claim="' + escapeHtml(c.id) + '">Approve</button>' +
                            '<button type="button" class="xi-btn red ' + (String(c.status || '').toLowerCase() === 'pending' ? '' : 'disabled') + '" data-admin="deny" data-claim="' + escapeHtml(c.id) + '">Deny</button>' +
                            '<button type="button" class="xi-btn warn ' + (canPay ? '' : 'disabled') + '" data-admin="pay" data-claim="' + escapeHtml(c.id) + '">Mark Paid</button>' +
                        '</div>' +
                    '</div>';
                }).join('') : '<div>No claims yet.</div>'),
            '</div>',

            '<div class="xi-card">',
                '<div class="xi-title-row"><strong>Payout Log</strong><span class="xi-pill neutral">' + payouts.length + '</span></div>',
                (payouts.length ? payouts.slice(0, 10).map(function (p) {
                    return '<div class="xi-card" style="margin:0 0 8px 0;padding:8px">' +
                        '<div class="xi-title-row"><strong>Payout #' + escapeHtml(p.id) + '</strong><span class="xi-pill good">paid</span></div>' +
                        '<div class="xi-kv"><div>Member</div><div>' + escapeHtml(p.member_name) + '</div></div>' +
                        '<div class="xi-kv"><div>Amount</div><div>' + money(p.amount_paid) + '</div></div>' +
                        '<div class="xi-kv"><div>Claim ID</div><div>' + escapeHtml(p.claim_id) + '</div></div>' +
                        '<div class="xi-kv"><div>Date</div><div>' + escapeHtml(fmtDate(p.created_at)) + '</div></div>' +
                    '</div>';
                }).join('') : '<div>No payouts yet.</div>'),
            '</div>'
        ].join('');
    }

    function renderBody() {
        var body = document.getElementById('xi-body');
        if (!body) return;

        renderTabs();

        if (state.currentTab === 'settings') {
            body.innerHTML = '<div id="xi-notice"></div>' + renderSettings();
            renderNotice();
            bindUi();
            return;
        }

        if (!state.session_token || !state.member) {
            body.innerHTML = '<div id="xi-notice"></div><div class="xi-card">Please log in from Settings first.</div>' + renderSettings();
            renderNotice();
            bindUi();
            return;
        }

        var plan = getPlan(state.currentTab);
        if (!plan) {
            body.innerHTML = '<div id="xi-notice"></div><div class="xi-card">Plan not found.</div>';
            renderNotice();
            bindUi();
            return;
        }

        body.innerHTML = '<div id="xi-notice"></div><div class="xi-card">Loading...</div>';
        renderNotice();

        ensureMe(plan.plan_key, function (err, meData) {
            if (err) {
                body.innerHTML = '<div id="xi-notice"></div><div class="xi-card">Session expired or data failed to load. Please log in again.</div>' + renderSettings();
                clearAuth();
                renderNotice();
                bindUi();
                return;
            }

            ensureAdminClaims(function () {
                ensureAdminPayouts(function () {
                    body.innerHTML = '<div id="xi-notice"></div>' + renderPlan(plan, meData) + renderAdmin();
                    renderNotice();
                    bindUi();
                });
            });
        });
    }

    function renderTabs() {
        var host = document.getElementById('xi-tabs');
        if (!host) return;
        var html = [];
        for (var i = 0; i < state.plans.length; i++) {
            var p = state.plans[i];
            html.push('<button type="button" class="xi-tab' + (state.currentTab === p.plan_key ? ' active' : '') + '" data-tab="' + escapeHtml(p.plan_key) + '">' + escapeHtml(p.title) + '</button>');
        }
        html.push('<button type="button" class="xi-tab' + (state.currentTab === 'settings' ? ' active' : '') + '" data-tab="settings">Settings</button>');
        host.innerHTML = html.join('');
        host.querySelectorAll('[data-tab]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                state.currentTab = btn.getAttribute('data-tab') || 'settings';
                saveStateBits();
                renderBody();
            });
        });
    }

    function doLogin() {
        var input = document.getElementById('xi-api-key');
        var key = String((input && input.value) || '').trim();
        if (!key) {
            setNotice('error', 'Enter your Torn API key.');
            return;
        }
        state.api_key = key;
        saveStateBits();
        setNotice('warn', 'Logging in...');
        apiPost('/api/insurance/auth/verify', { api_key: key }, function (err, data) {
            if (err) {
                setNotice('error', 'Login failed.');
                return;
            }
            if (!data || !data.ok || !data.session_token) {
                setNotice('error', (data && data.error) || 'Login failed.');
                return;
            }
            state.session_token = data.session_token || '';
            state.member = data.member || null;
            state.meByPlan = {};
            state.adminClaims = null;
            state.adminPayouts = null;
            saveStateBits();
            setNotice('success', 'Logged in successfully.');
            if (state.plans.length) state.currentTab = state.plans[0].plan_key;
            saveStateBits();
            renderBody();
        });
    }

    function doLogout() {
        apiPost('/api/insurance/auth/logout', {}, function () {
            clearAuth();
            state.currentTab = 'settings';
            saveStateBits();
            setNotice('success', 'Logged out.');
            renderBody();
        });
    }

    function enrollPlan(planKey) {
        setNotice('warn', 'Enrolling...');
        apiPost('/api/insurance/enroll', { plan_key: planKey }, function (err, data) {
            if (err) return setNotice('error', 'Enroll failed.');
            if (!data || !data.ok) return setNotice('error', (data && data.error) || 'Enroll failed.');
            delete state.meByPlan[planKey];
            setNotice('success', 'Enrolled successfully.');
            renderBody();
        });
    }

    function submitClaim(planKey) {
        var jumpEl = document.getElementById('xi-claim-jump');
        var proofEl = document.getElementById('xi-claim-proof');
        var jumpCount = Number((jumpEl && jumpEl.value) || 1);
        var proofText = String((proofEl && proofEl.value) || '').trim();
        setNotice('warn', 'Submitting claim...');
        apiPost('/api/insurance/claim', {
            plan_key: planKey,
            jump_count: jumpCount,
            proof_text: proofText
        }, function (err, data) {
            if (err) return setNotice('error', 'Claim failed.');
            if (!data || !data.ok) return setNotice('error', (data && data.error) || 'Claim failed.');
            delete state.meByPlan[planKey];
            setNotice('success', 'Claim submitted.');
            renderBody();
        });
    }

    function adminAction(action, claimId) {
        if (!claimId) return;
        if (action === 'approve' || action === 'deny') {
            setNotice('warn', action === 'approve' ? 'Approving claim...' : 'Denying claim...');
            apiPost('/api/insurance/admin/claims/' + claimId + '/' + action, {}, function (err, data) {
                if (err) return setNotice('error', 'Admin action failed.');
                if (!data || !data.ok) return setNotice('error', (data && data.error) || 'Admin action failed.');
                state.adminClaims = null;
                state.adminPayouts = null;
                state.meByPlan = {};
                setNotice('success', action === 'approve' ? 'Claim approved.' : 'Claim denied.');
                renderBody();
            });
            return;
        }
        if (action === 'pay') {
            var noteEl = document.getElementById('xi-pay-note-' + claimId);
            var paymentNote = String((noteEl && noteEl.value) || '').trim();
            setNotice('warn', 'Marking claim paid...');
            apiPost('/api/insurance/admin/claims/' + claimId + '/pay', { payment_note: paymentNote }, function (err, data) {
                if (err) return setNotice('error', 'Mark paid failed.');
                if (!data || !data.ok) return setNotice('error', (data && data.error) || 'Mark paid failed.');
                state.adminClaims = null;
                state.adminPayouts = null;
                state.meByPlan = {};
                setNotice('success', 'Claim marked paid.');
                renderBody();
            });
        }
    }

    function bindUi() {
        var loginBtn = document.getElementById('xi-login-btn');
        if (loginBtn) loginBtn.addEventListener('click', doLogin);

        var logoutBtn = document.getElementById('xi-logout-btn');
        if (logoutBtn) logoutBtn.addEventListener('click', doLogout);

        var refreshBtn = document.getElementById('xi-refresh-btn');
        if (refreshBtn) refreshBtn.addEventListener('click', function () {
            state.meByPlan = {};
            state.adminClaims = null;
            state.adminPayouts = null;
            setNotice('warn', 'Refreshing...');
            renderBody();
        });

        var adminRefresh = document.getElementById('xi-admin-refresh');
        if (adminRefresh) adminRefresh.addEventListener('click', function () {
            state.adminClaims = null;
            state.adminPayouts = null;
            setNotice('warn', 'Refreshing admin...');
            renderBody();
        });

        document.querySelectorAll('[data-action]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var action = btn.getAttribute('data-action');
                var planKey = btn.getAttribute('data-plan');
                if (action === 'enroll') return enrollPlan(planKey);
                if (action === 'refresh-plan') {
                    delete state.meByPlan[planKey];
                    setNotice('warn', 'Refreshing plan...');
                    return renderBody();
                }
                if (action === 'submit-claim') return submitClaim(planKey);
            });
        });

        document.querySelectorAll('[data-admin]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                adminAction(btn.getAttribute('data-admin'), btn.getAttribute('data-claim'));
            });
        });
    }

    function createLauncher() {
        var existing = document.getElementById('xi-fab');
        if (existing) {
            applyFabPos();
            return existing;
        }
        var fab = document.createElement('div');
        fab.id = 'xi-fab';
        fab.textContent = '💊';
        fab.setAttribute('title', 'Sinner’s Insurance');
        fab.setAttribute('aria-label', 'Sinner’s Insurance');
        document.body.appendChild(fab);
        applyFabPos();
        fab.addEventListener('click', toggleOverlay);
        return fab;
    }

    function createOverlay() {
        if (document.getElementById('xi-overlay')) return;
        var overlay = document.createElement('div');
        overlay.id = 'xi-overlay';
        overlay.innerHTML = [
            '<div id="xi-head">',
                '<div id="xi-top">',
                    '<div id="xi-brand">',
                        '<div id="xi-brand-icon">💊</div>',
                        '<div><div id="xi-title">Sinner’s Insurance</div><div id="xi-sub">Faction insurance overlay</div></div>',
                    '</div>',
                    '<button id="xi-close" type="button">Close</button>',
                '</div>',
            '</div>',
            '<div id="xi-tabs"></div>',
            '<div id="xi-body"></div>'
        ].join('');
        document.body.appendChild(overlay);
        overlay.querySelector('#xi-close').addEventListener('click', closeOverlay);
    }

    function openOverlay() {
        var overlay = document.getElementById('xi-overlay');
        if (!overlay) return;
        overlay.classList.add('open');
        state.overlayOpen = true;
        saveStateBits();
        renderBody();
    }

    function closeOverlay() {
        var overlay = document.getElementById('xi-overlay');
        if (!overlay) return;
        overlay.classList.remove('open');
        state.overlayOpen = false;
        saveStateBits();
    }

    function toggleOverlay() {
        if (state.overlayOpen) closeOverlay();
        else openOverlay();
    }

    function mount() {
        if (!document.body) return false;
        addStyles();
        if (!document.getElementById('xi-fab')) createLauncher();
        if (!document.getElementById('xi-overlay')) createOverlay();
        applyFabPos();
        if (state.overlayOpen) {
            var overlay = document.getElementById('xi-overlay');
            if (overlay) overlay.classList.add('open');
        }
        return true;
    }

    function ensureMounted() {
        if (!document.body) return;
        var hasFab = !!document.getElementById('xi-fab');
        var hasOverlay = !!document.getElementById('xi-overlay');
        if (!hasFab || !hasOverlay) mount();
        applyFabPos();
    }

    function boot() {
        ensureMounted();
        ensurePlans(function (_err) {
            renderBody();
        });

        setInterval(function () {
            try {
                ensureMounted();
            } catch (_e) {}
        }, 2000);

        var observer = new MutationObserver(function () {
            ensureMounted();
        });
        observer.observe(document.documentElement || document.body, {
            childList: true,
            subtree: true
        });

        window.addEventListener('load', ensureMounted);
        window.addEventListener('hashchange', ensureMounted);
        window.addEventListener('popstate', ensureMounted);
        window.addEventListener('resize', ensureMounted);
        document.addEventListener('readystatechange', ensureMounted);

        setTimeout(ensureMounted, 0);
        setTimeout(ensureMounted, 300);
        setTimeout(ensureMounted, 1200);
        setTimeout(ensureMounted, 2500);
        setTimeout(ensureMounted, 5000);
    }

    boot();
})();
