// ==UserScript==
// @name         Sinner’s Insurance
// @namespace    fries91-xanax-insurance
// @version      2.0.0
// @description  Medical-style faction Xanax insurance overlay
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
// ==/UserScript==

(function () {
    'use strict';

    var API_BASE = 'https://xanax-insurance.onrender.com';
    var currentTab = 'xanax_stack';
    var overlayOpen = false;
    var plansCache = null;
    var adminClaimsCache = null;
    var adminPayoutsCache = null;
    var noticeState = { type: '', text: '' };

    var claimDrafts = {
        xanax_stack: { jump_count: 4, proof_text: '' },
        jump_1_4: { jump_count: 1, proof_text: '' },
        xanax_only: { jump_count: 1, proof_text: '' }
    };

    var auth = {
        session_token: String(GM_getValue('xi_session_token', '') || ''),
        api_key: String(GM_getValue('xi_api_key', '') || ''),
        member: GM_getValue('xi_member', null) || null
    };

    function saveAuth() {
        GM_setValue('xi_session_token', auth.session_token || '');
        GM_setValue('xi_api_key', auth.api_key || '');
        GM_setValue('xi_member', auth.member || null);
    }

    function clearAuth() {
        auth.session_token = '';
        auth.api_key = '';
        auth.member = null;
        adminClaimsCache = null;
        adminPayoutsCache = null;
        GM_deleteValue('xi_session_token');
        GM_deleteValue('xi_api_key');
        GM_deleteValue('xi_member');
    }

    function headers(extra) {
        var h = extra ? Object.assign({}, extra) : {};
        if (auth.session_token) h['X-Session-Token'] = auth.session_token;
        return h;
    }

    function setNotice(type, text) {
        noticeState.type = type || '';
        noticeState.text = text || '';
        renderNotice();
    }

    function renderNotice() {
        var host = document.getElementById('xi-notice-host');
        if (!host) return;

        if (!noticeState.text) {
            host.innerHTML = '';
            return;
        }

        var cls = 'xi-loading';
        if (noticeState.type === 'error') cls = 'xi-error';
        if (noticeState.type === 'success') cls = 'xi-success';

        host.innerHTML = '<div class="' + cls + '">' + escapeHtml(noticeState.text) + '</div>';
    }

    function addStyles() {
        GM_addStyle(`
#xi-fab{
    position:fixed!important;
    top:86px!important;
    right:14px!important;
    width:42px!important;
    height:42px!important;
    border-radius:14px!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    cursor:pointer!important;
    z-index:2147483645!important;
    border:1px solid rgba(120,220,240,.28)!important;
    background:
        radial-gradient(circle at 30% 25%,rgba(255,255,255,.18),transparent 35%),
        linear-gradient(180deg,#102a35 0%,#0a171d 100%)!important;
    box-shadow:
        0 8px 18px rgba(0,0,0,.32),
        0 0 0 1px rgba(72,199,217,.10),
        0 0 14px rgba(72,199,217,.12)!important;
}
#xi-fab .xi-pill-svg{
    width:24px!important;
    height:24px!important;
    display:block!important;
}
#xi-fab:active{
    transform:scale(.98)!important;
}

#xi-overlay{
    position:fixed!important;
    top:136px!important;
    right:14px!important;
    width:400px!important;
    max-width:calc(100vw - 20px)!important;
    max-height:calc(100vh - 154px)!important;
    overflow:hidden!important;
    z-index:2147483646!important;
    border-radius:18px!important;
    background:
        radial-gradient(circle at top right,rgba(72,199,217,.10),transparent 28%),
        linear-gradient(180deg,rgba(16,32,40,.98) 0%,rgba(8,18,24,.98) 100%)!important;
    border:1px solid rgba(72,199,217,.22)!important;
    box-shadow:0 20px 40px rgba(0,0,0,.45)!important;
    color:#e9f7fb!important;
    font-family:Arial,Helvetica,sans-serif!important;
}
#xi-overlay.hidden{display:none!important}
#xi-header{
    padding:14px 14px 12px 14px!important;
    border-bottom:1px solid rgba(72,199,217,.14)!important;
}
#xi-header-top{
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
    width:38px!important;
    height:38px!important;
    border-radius:12px!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    background:linear-gradient(180deg,#14323d 0%,#0b1a22 100%)!important;
    border:1px solid rgba(137,228,242,.24)!important;
}
#xi-brand-icon svg{
    width:22px!important;
    height:22px!important;
    display:block!important;
}
#xi-title{
    font-size:16px!important;
    font-weight:800!important;
    color:#ecfbff!important;
}
#xi-subtitle{
    margin-top:2px!important;
    font-size:11px!important;
    color:#9fc0c7!important;
}
#xi-close{
    width:32px!important;
    height:32px!important;
    border:1px solid rgba(255,255,255,.08)!important;
    border-radius:10px!important;
    background:rgba(255,255,255,.04)!important;
    color:#dff7fb!important;
    cursor:pointer!important;
    font-size:18px!important;
}
#xi-badges{
    display:flex!important;
    gap:8px!important;
    flex-wrap:wrap!important;
    margin-top:10px!important;
}
.xi-badge{
    display:inline-flex!important;
    align-items:center!important;
    padding:5px 9px!important;
    border-radius:999px!important;
    font-size:11px!important;
    font-weight:700!important;
}
.xi-badge.faction{
    color:#dffcff!important;
    background:rgba(72,199,217,.12)!important;
    border:1px solid rgba(72,199,217,.20)!important;
}
.xi-badge.covered{
    color:#eafff4!important;
    background:rgba(80,216,144,.12)!important;
    border:1px solid rgba(80,216,144,.20)!important;
}
.xi-badge.admin{
    color:#fff0f0!important;
    background:rgba(255,107,107,.12)!important;
    border:1px solid rgba(255,107,107,.20)!important;
}
#xi-tabs{
    display:grid!important;
    grid-template-columns:1fr 1fr 1fr 1fr!important;
    gap:8px!important;
    padding:12px 14px 10px 14px!important;
    border-bottom:1px solid rgba(72,199,217,.10)!important;
}
.xi-tab{
    border:1px solid rgba(255,255,255,.07)!important;
    background:rgba(255,255,255,.03)!important;
    color:#cfe9ee!important;
    border-radius:12px!important;
    padding:10px 8px!important;
    cursor:pointer!important;
    font-size:12px!important;
    font-weight:700!important;
    text-align:center!important;
}
.xi-tab.active{
    color:#f3feff!important;
    background:linear-gradient(180deg,rgba(72,199,217,.18),rgba(72,199,217,.07))!important;
    border-color:rgba(72,199,217,.25)!important;
}
#xi-body{
    max-height:calc(100vh - 220px)!important;
    overflow-y:auto!important;
    padding:14px!important;
}
#xi-notice-host{margin-bottom:12px!important}
.xi-card{
    margin-bottom:12px!important;
    border-radius:14px!important;
    border:1px solid rgba(255,255,255,.06)!important;
    background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.015))!important;
    padding:12px!important;
}
.xi-card-title{
    display:flex!important;
    align-items:center!important;
    justify-content:space-between!important;
    gap:10px!important;
    margin-bottom:10px!important;
}
.xi-card-title strong{
    font-size:13px!important;
    color:#ecfbff!important;
}
.xi-mini-badge{
    display:inline-flex!important;
    align-items:center!important;
    padding:4px 8px!important;
    border-radius:999px!important;
    font-size:10px!important;
    font-weight:800!important;
    color:#c9fbff!important;
    background:rgba(72,199,217,.12)!important;
    border:1px solid rgba(72,199,217,.18)!important;
}
.xi-mini-badge.active{
    color:#eafff4!important;
    background:rgba(80,216,144,.14)!important;
    border:1px solid rgba(80,216,144,.20)!important;
}
.xi-mini-badge.inactive{
    color:#ffe6e6!important;
    background:rgba(255,107,107,.14)!important;
    border:1px solid rgba(255,107,107,.20)!important;
}
.xi-mini-badge.pending{
    color:#fff5d8!important;
    background:rgba(242,193,78,.14)!important;
    border:1px solid rgba(242,193,78,.20)!important;
}
.xi-grid{
    display:grid!important;
    grid-template-columns:1fr 1fr!important;
    gap:10px!important;
}
.xi-stat{
    border-radius:12px!important;
    background:rgba(0,0,0,.14)!important;
    border:1px solid rgba(255,255,255,.05)!important;
    padding:10px!important;
}
.xi-stat-label{
    font-size:11px!important;
    color:#9fc0c7!important;
    margin-bottom:5px!important;
}
.xi-stat-value{
    font-size:15px!important;
    font-weight:800!important;
    color:#f1fdff!important;
}
.xi-list{
    display:grid!important;
    gap:8px!important;
}
.xi-list-row{
    display:flex!important;
    align-items:center!important;
    justify-content:space-between!important;
    gap:8px!important;
    padding:8px 10px!important;
    border-radius:10px!important;
    background:rgba(0,0,0,.12)!important;
    border:1px solid rgba(255,255,255,.04)!important;
}
.xi-list-left{
    font-size:12px!important;
    color:#dff4f8!important;
}
.xi-list-right{
    font-size:11px!important;
    color:#8fb5bd!important;
    text-align:right!important;
}
.xi-actions{
    display:flex!important;
    gap:8px!important;
    flex-wrap:wrap!important;
}
.xi-btn{
    appearance:none!important;
    border:1px solid rgba(255,255,255,.08)!important;
    border-radius:12px!important;
    padding:10px 12px!important;
    font-size:12px!important;
    font-weight:800!important;
    cursor:pointer!important;
}
.xi-btn.primary{
    color:#ecfeff!important;
    background:linear-gradient(180deg,#1f94a8 0%,#12697a 100%)!important;
}
.xi-btn.success{
    color:#effff6!important;
    background:linear-gradient(180deg,#39b47d 0%,#268961 100%)!important;
}
.xi-btn.danger{
    color:#fff4f4!important;
    background:linear-gradient(180deg,#c95e5e 0%,#a34141 100%)!important;
}
.xi-btn.ghost{
    color:#d7eef3!important;
    background:rgba(255,255,255,.04)!important;
}
.xi-btn.disabled{
    opacity:.45!important;
    pointer-events:none!important;
    filter:grayscale(.2)!important;
}
.xi-note{
    margin-top:8px!important;
    font-size:11px!important;
    color:#8fb5bd!important;
    line-height:1.45!important;
}
.xi-loading,.xi-error,.xi-success{
    padding:12px 14px!important;
    border-radius:12px!important;
    border:1px solid rgba(255,255,255,.06)!important;
    font-size:12px!important;
}
.xi-error{
    color:#ffd3d3!important;
    border-color:rgba(255,107,107,.18)!important;
    background:linear-gradient(180deg,rgba(255,107,107,.06),rgba(255,107,107,.03))!important;
}
.xi-success{
    color:#eafff4!important;
    border-color:rgba(80,216,144,.18)!important;
    background:linear-gradient(180deg,rgba(80,216,144,.06),rgba(80,216,144,.03))!important;
}
.xi-loading{
    background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.015))!important;
}
.xi-input{
    width:100%!important;
    box-sizing:border-box!important;
    margin:0 0 8px 0!important;
    padding:10px 12px!important;
    border-radius:10px!important;
    border:1px solid rgba(255,255,255,.08)!important;
    background:rgba(0,0,0,.16)!important;
    color:#ecfbff!important;
    font-size:12px!important;
}
.xi-textarea{
    width:100%!important;
    min-height:88px!important;
    resize:vertical!important;
    box-sizing:border-box!important;
    margin:0 0 8px 0!important;
    padding:10px 12px!important;
    border-radius:10px!important;
    border:1px solid rgba(255,255,255,.08)!important;
    background:rgba(0,0,0,.16)!important;
    color:#ecfbff!important;
    font-size:12px!important;
}
.xi-help-list{
    display:grid!important;
    gap:8px!important;
}
.xi-help-item{
    padding:9px 10px!important;
    border-radius:10px!important;
    background:rgba(0,0,0,.12)!important;
    border:1px solid rgba(255,255,255,.04)!important;
    font-size:12px!important;
    color:#d8eff4!important;
    line-height:1.45!important;
}
.xi-label{
    display:block!important;
    font-size:11px!important;
    color:#9fc0c7!important;
    margin:0 0 6px 0!important;
}
.xi-history-empty{
    font-size:12px!important;
    color:#8fb5bd!important;
    padding:8px 2px!important;
}
.xi-history-item{
    padding:10px!important;
    border-radius:12px!important;
    background:rgba(0,0,0,.12)!important;
    border:1px solid rgba(255,255,255,.04)!important;
    margin-bottom:8px!important;
}
.xi-history-top{
    display:flex!important;
    align-items:center!important;
    justify-content:space-between!important;
    gap:8px!important;
    margin-bottom:8px!important;
}
.xi-history-title{
    font-size:12px!important;
    font-weight:800!important;
    color:#eafcff!important;
}
.xi-history-status{
    font-size:10px!important;
    font-weight:800!important;
    padding:4px 8px!important;
    border-radius:999px!important;
}
.xi-history-status.pending{
    color:#fff5d8!important;
    background:rgba(242,193,78,.14)!important;
    border:1px solid rgba(242,193,78,.20)!important;
}
.xi-history-status.approved{
    color:#eafff4!important;
    background:rgba(80,216,144,.14)!important;
    border:1px solid rgba(80,216,144,.20)!important;
}
.xi-history-status.denied{
    color:#ffe6e6!important;
    background:rgba(255,107,107,.14)!important;
    border:1px solid rgba(255,107,107,.20)!important;
}
.xi-history-status.paid{
    color:#e8fff9!important;
    background:rgba(72,199,217,.14)!important;
    border:1px solid rgba(72,199,217,.20)!important;
}
.xi-history-meta{
    display:grid!important;
    gap:6px!important;
}
.xi-history-meta-row{
    display:flex!important;
    align-items:center!important;
    justify-content:space-between!important;
    gap:8px!important;
    font-size:11px!important;
    color:#b7d4da!important;
}
@media (max-width:520px){
    #xi-headerbar{
        top:52px!important;
        height:52px!important;
    }
    #xi-headerbar-inner{
        width:calc(100vw - 12px)!important;
        height:42px!important;
        padding:0 8px!important;
    }
    #xi-headerbar-right{
        display:none!important;
    }
    #xi-overlay{
        top:110px!important;
        right:8px!important;
        left:8px!important;
        width:auto!important;
        max-height:calc(100vh - 128px)!important;
    }
    #xi-tabs{
        grid-template-columns:1fr 1fr!important;
    }
    .xi-grid{
        grid-template-columns:1fr!important;
    }
}
        `);
    }

    function formatDateMaybe(value) {
        if (!value) return '—';
        try {
            var dt = new Date(value);
            if (!isNaN(dt.getTime())) return dt.toLocaleString();
        } catch (e) {}
        return String(value);
    }

    function statusBadgeClass(status) {
        status = String(status || '').toLowerCase();
        if (status === 'active' || status === 'approved' || status === 'paid') return 'active';
        if (status === 'pending') return 'pending';
        return 'inactive';
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function apiGet(path, callback) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: API_BASE + path,
            timeout: 20000,
            headers: headers(),
            onload: function (res) {
                try { callback(null, JSON.parse(res.responseText)); }
                catch (e) { callback(new Error('Bad JSON')); }
            },
            onerror: function () { callback(new Error('Request failed')); },
            ontimeout: function () { callback(new Error('Timed out')); }
        });
    }

    function apiPost(path, payload, callback) {
        GM_xmlhttpRequest({
            method: 'POST',
            url: API_BASE + path,
            timeout: 20000,
            headers: headers({ 'Content-Type': 'application/json' }),
            data: JSON.stringify(payload || {}),
            onload: function (res) {
                try { callback(null, JSON.parse(res.responseText)); }
                catch (e) { callback(new Error('Bad JSON')); }
            },
            onerror: function () { callback(new Error('Request failed')); },
            ontimeout: function () { callback(new Error('Timed out')); }
        });
    }

    function renderMemberCard(me) {
        var member = (me && me.member) || auth.member || {};
        var badges = '<span class="xi-badge faction">Faction Only</span><span class="xi-badge covered">Medical Cover</span>';
        if (member.is_admin) badges += '<span class="xi-badge admin">Admin</span>';
        var badgesHost = document.getElementById('xi-badges');
        if (badgesHost) badgesHost.innerHTML = badges;

        return `
<div class="xi-card">
    <div class="xi-card-title">
        <strong>🪪 Verified Member</strong>
        <span class="xi-mini-badge active">${member.is_admin ? 'Admin' : 'Verified'}</span>
    </div>
    <div class="xi-list">
        <div class="xi-list-row"><div class="xi-list-left">Name</div><div class="xi-list-right">${escapeHtml(member.name || '')}</div></div>
        <div class="xi-list-row"><div class="xi-list-left">Torn ID</div><div class="xi-list-right">${escapeHtml(member.torn_id || '')}</div></div>
        <div class="xi-list-row"><div class="xi-list-left">Position</div><div class="xi-list-right">${escapeHtml(member.position || 'Member')}</div></div>
    </div>
</div>`;
    }

    function renderClaimRules(planRules) {
        if (!planRules) return '';
        return `
<div class="xi-card">
    <div class="xi-card-title">
        <strong>⏱️ Plan Rules</strong>
        <span class="xi-mini-badge ${planRules.can_submit_claim ? 'active' : 'inactive'}">${planRules.can_submit_claim ? 'Ready' : 'Blocked'}</span>
    </div>
    <div class="xi-list">
        <div class="xi-list-row"><div class="xi-list-left">Cooldown</div><div class="xi-list-right">${escapeHtml(planRules.cooldown_hours)}h</div></div>
        <div class="xi-list-row"><div class="xi-list-left">Pending Claims</div><div class="xi-list-right">${escapeHtml(planRules.pending_claims)} / ${escapeHtml(planRules.max_pending_claims)}</div></div>
        <div class="xi-list-row"><div class="xi-list-left">Cooldown Ends</div><div class="xi-list-right">${escapeHtml(planRules.cooldown_until || 'Ready now')}</div></div>
    </div>
    ${planRules.block_reason ? `<div class="xi-note">${escapeHtml(planRules.block_reason)}</div>` : ''}
</div>`;
    }

    function renderClaimForm(plan, planRules) {
        var draft = claimDrafts[plan.plan_key] || { jump_count: plan.max_count || 1, proof_text: '' };
        var showJumpInput = plan.plan_key === 'jump_1_4';
        var canSubmit = !planRules || !!planRules.can_submit_claim;

        return `
<div class="xi-card">
    <div class="xi-card-title">
        <strong>🧾 Claim Form</strong>
        <span class="xi-mini-badge ${canSubmit ? 'active' : 'inactive'}">${canSubmit ? 'Ready' : 'Blocked'}</span>
    </div>

    ${showJumpInput ? `
    <label class="xi-label" for="xi-claim-jump-count">Jump Count</label>
    <input id="xi-claim-jump-count" class="xi-input" type="number" min="${plan.min_count}" max="${plan.max_count}" value="${escapeHtml(draft.jump_count)}">
    ` : `
    <div class="xi-list">
        <div class="xi-list-row"><div class="xi-list-left">Claim Count</div><div class="xi-list-right">${plan.max_count}</div></div>
    </div>`}

    <label class="xi-label" for="xi-claim-proof-text">Proof / Claim Note</label>
    <textarea id="xi-claim-proof-text" class="xi-textarea" placeholder="Add claim details, note, or proof text here...">${escapeHtml(draft.proof_text || '')}</textarea>

    <div class="xi-actions">
        <button class="xi-btn success ${canSubmit ? '' : 'disabled'}" data-action="submit_claim_form" data-plan="${plan.plan_key}" type="button">Submit Claim</button>
        <button class="xi-btn ghost" data-action="save_claim_draft" data-plan="${plan.plan_key}" type="button">Save Draft</button>
    </div>

    <div class="xi-note">${canSubmit ? 'This claim can be submitted now.' : escapeHtml(planRules.block_reason || 'Claim is currently blocked by plan rules.')}</div>
</div>`;
    }

    function renderClaimsHistory(claims) {
        var list = Array.isArray(claims) ? claims.slice(0, 5) : [];
        if (!list.length) {
            return `<div class="xi-card"><div class="xi-card-title"><strong>📚 Claims History</strong><span class="xi-mini-badge">Recent</span></div><div class="xi-history-empty">No claims submitted for this plan yet.</div></div>`;
        }

        var items = list.map(function (claim) {
            var status = String(claim.status || 'pending').toLowerCase();
            return `
<div class="xi-history-item">
    <div class="xi-history-top">
        <div class="xi-history-title">Claim #${escapeHtml(claim.id || '')}</div>
        <div class="xi-history-status ${status}">${escapeHtml(status)}</div>
    </div>
    <div class="xi-history-meta">
        <div class="xi-history-meta-row"><span>Requested</span><span>${money(claim.requested_amount)}</span></div>
        <div class="xi-history-meta-row"><span>Jump Count</span><span>${escapeHtml(claim.jump_count)}</span></div>
        <div class="xi-history-meta-row"><span>Submitted</span><span>${escapeHtml(formatDateMaybe(claim.created_at))}</span></div>
        <div class="xi-history-meta-row"><span>Proof</span><span>${claim.proof_text ? escapeHtml(claim.proof_text) : 'No proof note'}</span></div>
    </div>
</div>`;
        }).join('');

        return `<div class="xi-card"><div class="xi-card-title"><strong>📚 Claims History</strong><span class="xi-mini-badge">Recent 5</span></div>${items}</div>`;
    }

    function renderPayoutHistory(payouts) {
        var list = Array.isArray(payouts) ? payouts.slice(0, 5) : [];
        if (!list.length) {
            return `<div class="xi-card"><div class="xi-card-title"><strong>💰 Payout History</strong><span class="xi-mini-badge">Recent</span></div><div class="xi-history-empty">No payouts logged for this plan yet.</div></div>`;
        }

        var items = list.map(function (payout) {
            return `
<div class="xi-history-item">
    <div class="xi-history-top">
        <div class="xi-history-title">Payout #${escapeHtml(payout.id || '')}</div>
        <div class="xi-history-status paid">paid</div>
    </div>
    <div class="xi-history-meta">
        <div class="xi-history-meta-row"><span>Amount</span><span>${money(payout.amount_paid)}</span></div>
        <div class="xi-history-meta-row"><span>Claim ID</span><span>${escapeHtml(payout.claim_id)}</span></div>
        <div class="xi-history-meta-row"><span>Paid By</span><span>${escapeHtml(payout.paid_by_name || payout.paid_by)}</span></div>
        <div class="xi-history-meta-row"><span>Date</span><span>${escapeHtml(formatDateMaybe(payout.created_at))}</span></div>
        <div class="xi-history-meta-row"><span>Note</span><span>${payout.payment_note ? escapeHtml(payout.payment_note) : '—'}</span></div>
    </div>
</div>`;
        }).join('');

        return `<div class="xi-card"><div class="xi-card-title"><strong>💰 Payout History</strong><span class="xi-mini-badge">Recent 5</span></div>${items}</div>`;
    }

    function renderPlanTab(plan, me) {
        var enrollment = me && me.enrollment && !Array.isArray(me.enrollment) ? me.enrollment : null;
        var claims = me && Array.isArray(me.claims) ? me.claims : [];
        var payouts = me && Array.isArray(me.payouts) ? me.payouts : [];
        var latestClaim = claims.length ? claims[0] : null;
        var planRules = me && me.plan_rules ? me.plan_rules : null;

        return `
${renderMemberCard(me)}

<div class="xi-card">
    <div class="xi-card-title">
        <strong>💊 Coverage</strong>
        <span class="xi-mini-badge">${escapeHtml(plan.title)}</span>
    </div>
    <div class="xi-grid">
        <div class="xi-stat"><div class="xi-stat-label">Premium</div><div class="xi-stat-value">${money(plan.premium_amount)}</div></div>
        <div class="xi-stat"><div class="xi-stat-label">Payout</div><div class="xi-stat-value">${money(plan.payout_amount)}</div></div>
    </div>
    <div class="xi-note">${escapeHtml(plan.description || '')}</div>
</div>

<div class="xi-card">
    <div class="xi-card-title">
        <strong>🩺 My Policy</strong>
        <span class="xi-mini-badge ${enrollment ? 'active' : 'inactive'}">${enrollment ? 'Enrolled' : 'Not Enrolled'}</span>
    </div>
    <div class="xi-list">
        <div class="xi-list-row"><div class="xi-list-left">Enrollment</div><div class="xi-list-right">${enrollment ? escapeHtml(enrollment.status || 'active') : 'none'}</div></div>
        <div class="xi-list-row"><div class="xi-list-left">Covered Count</div><div class="xi-list-right">${plan.min_count === plan.max_count ? plan.max_count : (plan.min_count + ' to ' + plan.max_count)}</div></div>
        <div class="xi-list-row"><div class="xi-list-left">Last Claim</div><div class="xi-list-right">${latestClaim ? escapeHtml(latestClaim.status || 'pending') : 'none yet'}</div></div>
    </div>
</div>

${renderClaimRules(planRules)}

<div class="xi-card">
    <div class="xi-card-title">
        <strong>📋 Actions</strong>
        <span class="xi-mini-badge">Live</span>
    </div>
    <div class="xi-actions">
        <button class="xi-btn primary" data-action="enroll" data-plan="${plan.plan_key}" type="button">Enroll</button>
        <button class="xi-btn ghost" data-action="refresh" data-plan="${plan.plan_key}" type="button">Refresh</button>
    </div>
</div>

${renderClaimForm(plan, planRules)}
${renderClaimsHistory(claims)}
${renderPayoutHistory(payouts)}
`;
    }

    function renderAdminPanel() {
        if (!auth.member || !auth.member.is_admin) return '';

        var claims = adminClaimsCache || [];
        var payouts = adminPayoutsCache || [];

        var claimsRows = claims.length ? claims.map(function (c) {
            var status = String(c.status || '').toLowerCase();
            var canPay = status === 'approved';
            return `
<div class="xi-card">
    <div class="xi-card-title">
        <strong>#${c.id} ${escapeHtml(c.name)} [${escapeHtml(c.plan_key)}]</strong>
        <span class="xi-mini-badge ${statusBadgeClass(c.status)}">${escapeHtml(c.status)}</span>
    </div>
    <div class="xi-list">
        <div class="xi-list-row"><div class="xi-list-left">Requested</div><div class="xi-list-right">${money(c.requested_amount)}</div></div>
        <div class="xi-list-row"><div class="xi-list-left">Jump Count</div><div class="xi-list-right">${escapeHtml(c.jump_count)}</div></div>
        <div class="xi-list-row"><div class="xi-list-left">Proof</div><div class="xi-list-right">${escapeHtml(c.proof_text || '')}</div></div>
    </div>
    ${canPay ? `
        <label class="xi-label" for="xi-pay-note-${c.id}">Payment Note</label>
        <input id="xi-pay-note-${c.id}" class="xi-input" type="text" placeholder="Optional payout note">
    ` : ''}
    <div class="xi-actions" style="margin-top:10px;">
        <button class="xi-btn success ${status === 'pending' ? '' : 'disabled'}" data-admin-action="approve" data-claim-id="${c.id}" type="button">Approve</button>
        <button class="xi-btn danger ${status === 'pending' ? '' : 'disabled'}" data-admin-action="deny" data-claim-id="${c.id}" type="button">Deny</button>
        <button class="xi-btn primary ${canPay ? '' : 'disabled'}" data-admin-action="pay" data-claim-id="${c.id}" type="button">Mark Paid</button>
    </div>
</div>`;
        }).join('') : `<div class="xi-note">No claims yet.</div>`;

        var payoutRows = payouts.length ? payouts.slice(0, 10).map(function (p) {
            return `
<div class="xi-history-item">
    <div class="xi-history-top">
        <div class="xi-history-title">Payout #${escapeHtml(p.id)}</div>
        <div class="xi-history-status paid">paid</div>
    </div>
    <div class="xi-history-meta">
        <div class="xi-history-meta-row"><span>Member</span><span>${escapeHtml(p.member_name)}</span></div>
        <div class="xi-history-meta-row"><span>Amount</span><span>${money(p.amount_paid)}</span></div>
        <div class="xi-history-meta-row"><span>Claim ID</span><span>${escapeHtml(p.claim_id)}</span></div>
        <div class="xi-history-meta-row"><span>Paid By</span><span>${escapeHtml(p.paid_by_name || p.paid_by)}</span></div>
        <div class="xi-history-meta-row"><span>Date</span><span>${escapeHtml(formatDateMaybe(p.created_at))}</span></div>
        <div class="xi-history-meta-row"><span>Note</span><span>${p.payment_note ? escapeHtml(p.payment_note) : '—'}</span></div>
    </div>
</div>`;
        }).join('') : `<div class="xi-note">No payouts logged yet.</div>`;

        return `
<div class="xi-card">
    <div class="xi-card-title">
        <strong>🛡️ Admin Claims Panel</strong>
        <span class="xi-mini-badge active">Admin</span>
    </div>
    <div class="xi-actions">
        <button class="xi-btn ghost" id="xi-refresh-admin" type="button">Refresh Admin</button>
    </div>
</div>
${claimsRows}
<div class="xi-card">
    <div class="xi-card-title">
        <strong>💰 Admin Payout Log</strong>
        <span class="xi-mini-badge">Recent 10</span>
    </div>
    ${payoutRows}
</div>`;
    }

    function renderSettingsTab() {
        var member = auth.member || null;
        var badges = '<span class="xi-badge faction">Faction Only</span><span class="xi-badge covered">Medical Cover</span>';
        if (member && member.is_admin) badges += '<span class="xi-badge admin">Admin</span>';
        var badgesHost = document.getElementById('xi-badges');
        if (badgesHost) badgesHost.innerHTML = badges;

        return `
<div class="xi-card">
    <div class="xi-card-title"><strong>⚙️ How to Start</strong><span class="xi-mini-badge">Settings</span></div>
    <div class="xi-help-list">
        <div class="xi-help-item">Enter your Torn API key below to verify your player and confirm you are in the faction.</div>
        <div class="xi-help-item">No Torn password is needed. This is faction-only access for insurance enrollment, claims, and payout logs.</div>
        <div class="xi-help-item">After verification, the overlay uses a session token for future requests.</div>
    </div>
</div>

<div class="xi-card">
    <div class="xi-card-title"><strong>📜 ToS / API Key Storage & Usage</strong><span class="xi-mini-badge">Important</span></div>
    <div class="xi-help-list">
        <div class="xi-help-item"><strong>Purpose:</strong> Your key is used to verify your Torn identity and faction membership for this insurance tool.</div>
        <div class="xi-help-item"><strong>Stored locally:</strong> Your browser stores a session token for reuse in the overlay.</div>
        <div class="xi-help-item"><strong>Stored on service:</strong> The service currently stores your API key and session token for insurance access, claim handling, and payout logging.</div>
        <div class="xi-help-item"><strong>Visibility:</strong> Insurance data may be visible to the service owner/admin as needed to review and process claims.</div>
    </div>
</div>

<div class="xi-card">
    <div class="xi-card-title"><strong>🔐 Login / Session</strong><span class="xi-mini-badge ${member ? 'active' : 'inactive'}">${member ? 'Active' : 'Required'}</span></div>
    <label class="xi-label" for="xi-api-key-input">Torn API Key</label>
    <input id="xi-api-key-input" class="xi-input" type="password" placeholder="Enter Torn API key" value="${escapeHtml(auth.api_key || '')}">
    <div class="xi-actions">
        <button class="xi-btn primary" id="xi-login-btn" type="button">Login with API Key</button>
        ${member ? `<button class="xi-btn ghost" id="xi-logout-btn" type="button">Logout</button>` : ''}
    </div>
</div>

${member ? `
<div class="xi-card">
    <div class="xi-card-title"><strong>🪪 Verified Session</strong><span class="xi-mini-badge active">${member.is_admin ? 'Admin' : 'Verified'}</span></div>
    <div class="xi-list">
        <div class="xi-list-row"><div class="xi-list-left">Name</div><div class="xi-list-right">${escapeHtml(member.name || '')}</div></div>
        <div class="xi-list-row"><div class="xi-list-left">Torn ID</div><div class="xi-list-right">${escapeHtml(member.torn_id || '')}</div></div>
        <div class="xi-list-row"><div class="xi-list-left">Position</div><div class="xi-list-right">${escapeHtml(member.position || 'Member')}</div></div>
    </div>
</div>` : ''}
`;
    }

    function verifyLoginFromSettings() {
        var input = document.getElementById('xi-api-key-input');
        var key = input ? String(input.value || '').trim() : '';
        if (!key) {
            setNotice('error', 'Please enter your API key.');
            return;
        }

        auth.api_key = key;
        setNotice('loading', 'Verifying faction access...');

        apiPost('/api/insurance/auth/verify', { api_key: auth.api_key }, function (err, data) {
            if (err) return setNotice('error', 'Login failed.');
            if (!data || !data.ok) return setNotice('error', (data && data.error) || 'Login failed.');

            auth.session_token = data.session_token || '';
            auth.member = data.member || null;
            saveAuth();
            setNotice('success', 'Login successful.');
            renderBody();
        });
    }

    function renderBody() {
        var body = document.getElementById('xi-body');
        if (!body) return;

        body.innerHTML = '<div id="xi-notice-host"></div><div class="xi-loading">Loading...</div>';
        renderNotice();

        ensurePlans(function (err) {
            if (err) {
                body.innerHTML = '<div id="xi-notice-host"></div><div class="xi-error">Could not load plans.</div>';
                renderNotice();
                return;
            }

            if (currentTab === 'settings') {
                body.innerHTML = '<div id="xi-notice-host"></div>' + renderSettingsTab();
                renderNotice();
                bindUi(null);
                return;
            }

            if (!auth.session_token || !auth.member) {
                body.innerHTML = '<div id="xi-notice-host"></div><div class="xi-error">Please log in from the Settings tab before using insurance tabs.</div>' + renderSettingsTab();
                renderNotice();
                bindUi(null);
                return;
            }

            var plan = getPlan(currentTab);
            if (!plan) {
                body.innerHTML = '<div id="xi-notice-host"></div><div class="xi-error">Plan not found.</div>';
                renderNotice();
                return;
            }

            apiGet('/api/insurance/me?plan_key=' + encodeURIComponent(plan.plan_key), function (meErr, meData) {
                if (meErr || !meData || !meData.ok) {
                    clearAuth();
                    body.innerHTML = '<div id="xi-notice-host"></div><div class="xi-error">Session expired. Please log in again from the Settings tab.</div>' + renderSettingsTab();
                    renderNotice();
                    bindUi(null);
                    return;
                }

                auth.member = meData.member || auth.member;
                saveAuth();

                loadAdminClaims(function () {
                    loadAdminPayouts(function () {
                        body.innerHTML = '<div id="xi-notice-host"></div>' + renderPlanTab(plan, meData) + renderAdminPanel();
                        renderNotice();
                        bindUi(plan);
                    });
                });
            });
        });
    }

    function saveClaimDraft(planKey, plan) {
        var proofEl = document.getElementById('xi-claim-proof-text');
        var jumpEl = document.getElementById('xi-claim-jump-count');
        claimDrafts[planKey] = {
            jump_count: jumpEl ? Number(jumpEl.value || plan.max_count || 1) : Number(plan.max_count || 1),
            proof_text: proofEl ? String(proofEl.value || '') : ''
        };
    }

    function submitClaimForm(planKey, plan) {
        saveClaimDraft(planKey, plan);
        var jumpCount = Number(claimDrafts[planKey].jump_count || plan.max_count || 1);
        var proofText = String(claimDrafts[planKey].proof_text || '');

        setNotice('loading', 'Submitting claim...');
        apiPost('/api/insurance/claim', {
            plan_key: planKey,
            jump_count: jumpCount,
            proof_text: proofText
        }, function (err, data) {
            if (err) return setNotice('error', 'Claim failed.');
            if (!data || !data.ok) return setNotice('error', (data && data.error) || 'Claim failed.');

            claimDrafts[planKey].proof_text = '';
            setNotice('success', 'Claim submitted.');
            renderBody();
        });
    }

    function bindUi(plan) {
        var loginBtn = document.getElementById('xi-login-btn');
        if (loginBtn) loginBtn.addEventListener('click', verifyLoginFromSettings);

        var apiInput = document.getElementById('xi-api-key-input');
        if (apiInput) apiInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') verifyLoginFromSettings();
        });

        var logoutBtn = document.getElementById('xi-logout-btn');
        if (logoutBtn) logoutBtn.addEventListener('click', function () {
            setNotice('loading', 'Logging out...');
            apiPost('/api/insurance/auth/logout', {}, function () {
                clearAuth();
                setNotice('success', 'Logged out.');
                renderBody();
            });
        });

        var refreshAdmin = document.getElementById('xi-refresh-admin');
        if (refreshAdmin) refreshAdmin.addEventListener('click', function () {
            adminClaimsCache = null;
            adminPayoutsCache = null;
            setNotice('loading', 'Refreshing admin data...');
            renderBody();
        });

        document.querySelectorAll('[data-action]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var action = btn.getAttribute('data-action');
                var planKey = btn.getAttribute('data-plan');

                if (action === 'refresh') {
                    setNotice('loading', 'Refreshing plan data...');
                    renderBody();
                    return;
                }

                if (action === 'enroll') {
                    setNotice('loading', 'Enrolling...');
                    apiPost('/api/insurance/enroll', { plan_key: planKey }, function (err, data) {
                        if (err) return setNotice('error', 'Enroll failed.');
                        if (!data || !data.ok) return setNotice('error', (data && data.error) || 'Enroll failed.');
                        setNotice('success', 'Enrolled successfully.');
                        renderBody();
                    });
                    return;
                }

                if (action === 'save_claim_draft') {
                    saveClaimDraft(planKey, plan);
                    setNotice('success', 'Claim draft saved.');
                    return;
                }

                if (action === 'submit_claim_form') {
                    submitClaimForm(planKey, plan);
                }
            });
        });

        document.querySelectorAll('[data-admin-action]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var action = btn.getAttribute('data-admin-action');
                var claimId = btn.getAttribute('data-claim-id');
                if (!claimId) return;

                if (action === 'approve' || action === 'deny') {
                    var path = action === 'approve'
                        ? '/api/insurance/admin/claims/' + claimId + '/approve'
                        : '/api/insurance/admin/claims/' + claimId + '/deny';

                    setNotice('loading', action === 'approve' ? 'Approving claim...' : 'Denying claim...');
                    apiPost(path, {}, function (err, data) {
                        if (err) return setNotice('error', 'Admin action failed.');
                        if (!data || !data.ok) return setNotice('error', (data && data.error) || 'Admin action failed.');
                        setNotice('success', action === 'approve' ? 'Claim approved.' : 'Claim denied.');
                        renderBody();
                    });
                    return;
                }

                if (action === 'pay') {
                    var noteEl = document.getElementById('xi-pay-note-' + claimId);
                    var paymentNote = noteEl ? String(noteEl.value || '').trim() : '';

                    setNotice('loading', 'Marking claim paid...');
                    apiPost('/api/insurance/admin/claims/' + claimId + '/pay', {
                        payment_note: paymentNote
                    }, function (err, data) {
                        if (err) return setNotice('error', 'Mark paid failed.');
                        if (!data || !data.ok) return setNotice('error', (data && data.error) || 'Mark paid failed.');
                        setNotice('success', 'Claim marked paid.');
                        renderBody();
                    });
                }
            });
        });
    }

    function createLauncher() {
        var oldHeader = document.getElementById('xi-headerbar');
        if (oldHeader) oldHeader.remove();

        var existing = document.getElementById('xi-fab');
        if (existing) return;

        var fab = document.createElement('button');
        fab.id = 'xi-fab';
        fab.type = 'button';
        fab.title = 'Open Sinner’s Insurance';
        fab.setAttribute('aria-label', 'Open Sinner’s Insurance');
        fab.innerHTML = pillSvg();

        document.body.appendChild(fab);
        fab.addEventListener('click', toggleOverlay);
    }

    function createOverlay() {
        if (document.getElementById('xi-overlay')) return;

        var overlay = document.createElement('div');
        overlay.id = 'xi-overlay';
        overlay.className = 'hidden';
        overlay.innerHTML = `
<div id="xi-header">
    <div id="xi-header-top">
        <div id="xi-brand">
            <div id="xi-brand-icon">${pillSvg()}</div>
            <div>
                <div id="xi-title">Sinner’s Insurance</div>
                <div id="xi-subtitle">Insurance panel for faction members</div>
            </div>
        </div>
        <button id="xi-close" type="button">×</button>
    </div>
    <div id="xi-badges">
        <span class="xi-badge faction">Faction Only</span>
        <span class="xi-badge covered">Medical Cover</span>
    </div>
</div>

<div id="xi-tabs">
    <button class="xi-tab active" data-tab="xanax_stack" type="button">Stack</button>
    <button class="xi-tab" data-tab="jump_1_4" type="button">1–4 Jumps</button>
    <button class="xi-tab" data-tab="xanax_only" type="button">Single</button>
    <button class="xi-tab" data-tab="settings" type="button">Settings</button>
</div>

<div id="xi-body"></div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('#xi-close').addEventListener('click', closeOverlay);
        overlay.querySelectorAll('.xi-tab').forEach(function (btn) {
            btn.addEventListener('click', function () {
                currentTab = btn.getAttribute('data-tab') || 'xanax_stack';
                renderTabs();
                renderBody();
            });
        });

        renderBody();
    }

    function renderTabs() {
        var overlay = document.getElementById('xi-overlay');
        if (!overlay) return;
        overlay.querySelectorAll('.xi-tab').forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === currentTab);
        });
    }

    function openOverlay() {
        var overlay = document.getElementById('xi-overlay');
        if (!overlay) return;
        overlay.classList.remove('hidden');
        overlayOpen = true;
        renderBody();
    }

    function closeOverlay() {
        var overlay = document.getElementById('xi-overlay');
        if (!overlay) return;
        overlay.classList.add('hidden');
        overlayOpen = false;
    }

    function toggleOverlay() {
        if (overlayOpen) closeOverlay();
        else openOverlay();
    }

    function mount() {
        if (!document.body) return false;
        addStyles();
        if (!document.getElementById('xi-fab')) createLauncher();
        if (!document.getElementById('xi-overlay')) createOverlay();
        return true;
    }

    function boot() {
        mount();

        var tries = 0;
        var timer = setInterval(function () {
            tries += 1;
            mount();
            if (tries > 60) clearInterval(timer);
        }, 600);

        var remountTimer = null;
        var observer = new MutationObserver(function () {
            if (remountTimer) clearTimeout(remountTimer);
            remountTimer = setTimeout(function () {
                mount();
            }, 120);
        });

        observer.observe(document.documentElement || document.body, {
            childList: true,
            subtree: true
        });

        window.addEventListener('load', mount);
        window.addEventListener('hashchange', mount);
        window.addEventListener('popstate', mount);
        document.addEventListener('readystatechange', mount);

        setTimeout(mount, 300);
        setTimeout(mount, 1200);
        setTimeout(mount, 2500);
    }

    boot();
})();
