// ==UserScript==
// @name         Faction Xanax Insurance
// @namespace    fries91-xanax-insurance
// @version      1.2.0
// @description  Medical-style faction Xanax insurance overlay
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      xanax-insurance.onrender.com
// ==/UserScript==

(function () {
    'use strict';

    var API_BASE = 'https://xanax-insurance.onrender.com';
    var currentTab = 'xanax_stack';
    var overlayOpen = false;
    var plansCache = null;
    var memberData = {
        torn_id: Number(GM_getValue('xi_torn_id', 0)) || 0,
        name: String(GM_getValue('xi_name', '') || ''),
        faction_id: Number(GM_getValue('xi_faction_id', 0)) || 0
    };

    function saveMemberData() {
        GM_setValue('xi_torn_id', String(memberData.torn_id || 0));
        GM_setValue('xi_name', String(memberData.name || ''));
        GM_setValue('xi_faction_id', String(memberData.faction_id || 0));
    }

    function addStyles() {
        GM_addStyle(`
#xi-pill-launcher{position:fixed!important;top:52%!important;right:14px!important;transform:translateY(-50%)!important;width:52px!important;height:52px!important;border-radius:16px!important;z-index:2147483647!important;display:flex!important;align-items:center!important;justify-content:center!important;cursor:pointer!important;border:1px solid rgba(120,220,240,.35)!important;background:radial-gradient(circle at 30% 25%,rgba(255,255,255,.22),transparent 35%),linear-gradient(180deg,#102a35 0%,#0a171d 100%)!important;box-shadow:0 8px 24px rgba(0,0,0,.45),0 0 0 1px rgba(72,199,217,.12),0 0 18px rgba(72,199,217,.16)!important}
#xi-pill-launcher .xi-pill-svg{width:30px!important;height:30px!important;display:block!important}
#xi-pill-launcher .xi-plus-badge{position:absolute!important;right:-4px!important;bottom:-4px!important;width:19px!important;height:19px!important;border-radius:999px!important;display:flex!important;align-items:center!important;justify-content:center!important;font-size:12px!important;font-weight:900!important;color:#eaffff!important;background:linear-gradient(180deg,#57d6a6 0%,#299b74 100%)!important;border:2px solid #091116!important}
#xi-overlay{position:fixed!important;top:70px!important;right:78px!important;width:385px!important;max-width:calc(100vw - 24px)!important;max-height:calc(100vh - 90px)!important;overflow:hidden!important;z-index:2147483646!important;border-radius:18px!important;background:radial-gradient(circle at top right,rgba(72,199,217,.10),transparent 28%),linear-gradient(180deg,rgba(16,32,40,.98) 0%,rgba(8,18,24,.98) 100%)!important;border:1px solid rgba(72,199,217,.22)!important;box-shadow:0 20px 40px rgba(0,0,0,.45)!important;color:#e9f7fb!important;font-family:Arial,Helvetica,sans-serif!important}
#xi-overlay.hidden{display:none!important}
#xi-header{padding:14px 14px 12px 14px!important;border-bottom:1px solid rgba(72,199,217,.14)!important}
#xi-header-top{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important}
#xi-brand{display:flex!important;align-items:center!important;gap:10px!important}
#xi-brand-icon{width:38px!important;height:38px!important;border-radius:12px!important;display:flex!important;align-items:center!important;justify-content:center!important;background:linear-gradient(180deg,#14323d 0%,#0b1a22 100%)!important;border:1px solid rgba(137,228,242,.24)!important}
#xi-brand-icon svg{width:22px!important;height:22px!important;display:block!important}
#xi-title{font-size:16px!important;font-weight:800!important;color:#ecfbff!important}
#xi-subtitle{margin-top:2px!important;font-size:11px!important;color:#9fc0c7!important}
#xi-close{width:32px!important;height:32px!important;border:1px solid rgba(255,255,255,.08)!important;border-radius:10px!important;background:rgba(255,255,255,.04)!important;color:#dff7fb!important;cursor:pointer!important;font-size:18px!important}
#xi-badges{display:flex!important;gap:8px!important;flex-wrap:wrap!important;margin-top:10px!important}
.xi-badge{display:inline-flex!important;align-items:center!important;padding:5px 9px!important;border-radius:999px!important;font-size:11px!important;font-weight:700!important}
.xi-badge.faction{color:#dffcff!important;background:rgba(72,199,217,.12)!important;border:1px solid rgba(72,199,217,.20)!important}
.xi-badge.covered{color:#eafff4!important;background:rgba(80,216,144,.12)!important;border:1px solid rgba(80,216,144,.20)!important}
#xi-tabs{display:grid!important;grid-template-columns:1fr 1fr 1fr!important;gap:8px!important;padding:12px 14px 10px 14px!important;border-bottom:1px solid rgba(72,199,217,.10)!important}
.xi-tab{border:1px solid rgba(255,255,255,.07)!important;background:rgba(255,255,255,.03)!important;color:#cfe9ee!important;border-radius:12px!important;padding:10px 8px!important;cursor:pointer!important;font-size:12px!important;font-weight:700!important;text-align:center!important}
.xi-tab.active{color:#f3feff!important;background:linear-gradient(180deg,rgba(72,199,217,.18),rgba(72,199,217,.07))!important;border-color:rgba(72,199,217,.25)!important}
#xi-body{max-height:calc(100vh - 220px)!important;overflow-y:auto!important;padding:14px!important}
.xi-card{margin-bottom:12px!important;border-radius:14px!important;border:1px solid rgba(255,255,255,.06)!important;background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.015))!important;padding:12px!important}
.xi-card-title{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;margin-bottom:10px!important}
.xi-card-title strong{font-size:13px!important;color:#ecfbff!important}
.xi-mini-badge{display:inline-flex!important;align-items:center!important;padding:4px 8px!important;border-radius:999px!important;font-size:10px!important;font-weight:800!important;color:#c9fbff!important;background:rgba(72,199,217,.12)!important;border:1px solid rgba(72,199,217,.18)!important}
.xi-grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:10px!important}
.xi-stat{border-radius:12px!important;background:rgba(0,0,0,.14)!important;border:1px solid rgba(255,255,255,.05)!important;padding:10px!important}
.xi-stat-label{font-size:11px!important;color:#9fc0c7!important;margin-bottom:5px!important}
.xi-stat-value{font-size:15px!important;font-weight:800!important;color:#f1fdff!important}
.xi-list{display:grid!important;gap:8px!important}
.xi-list-row{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;padding:8px 10px!important;border-radius:10px!important;background:rgba(0,0,0,.12)!important;border:1px solid rgba(255,255,255,.04)!important}
.xi-list-left{font-size:12px!important;color:#dff4f8!important}
.xi-list-right{font-size:11px!important;color:#8fb5bd!important;text-align:right!important}
.xi-actions{display:flex!important;gap:8px!important;flex-wrap:wrap!important}
.xi-btn{appearance:none!important;border:1px solid rgba(255,255,255,.08)!important;border-radius:12px!important;padding:10px 12px!important;font-size:12px!important;font-weight:800!important;cursor:pointer!important}
.xi-btn.primary{color:#ecfeff!important;background:linear-gradient(180deg,#1f94a8 0%,#12697a 100%)!important}
.xi-btn.success{color:#effff6!important;background:linear-gradient(180deg,#39b47d 0%,#268961 100%)!important}
.xi-btn.ghost{color:#d7eef3!important;background:rgba(255,255,255,.04)!important}
.xi-note{margin-top:8px!important;font-size:11px!important;color:#8fb5bd!important;line-height:1.45!important}
.xi-loading,.xi-error{padding:18px!important;border-radius:14px!important;border:1px solid rgba(255,255,255,.06)!important;background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.015))!important;font-size:13px!important}
.xi-error{color:#ffd3d3!important;border-color:rgba(255,107,107,.18)!important;background:linear-gradient(180deg,rgba(255,107,107,.06),rgba(255,107,107,.03))!important}
.xi-input{width:100%!important;box-sizing:border-box!important;margin:0 0 8px 0!important;padding:10px 12px!important;border-radius:10px!important;border:1px solid rgba(255,255,255,.08)!important;background:rgba(0,0,0,.16)!important;color:#ecfbff!important;font-size:12px!important}
.xi-textarea{width:100%!important;min-height:80px!important;resize:vertical!important;box-sizing:border-box!important;margin:0 0 8px 0!important;padding:10px 12px!important;border-radius:10px!important;border:1px solid rgba(255,255,255,.08)!important;background:rgba(0,0,0,.16)!important;color:#ecfbff!important;font-size:12px!important}
@media (max-width:520px){#xi-overlay{top:60px!important;right:8px!important;left:8px!important;width:auto!important;max-height:calc(100vh - 72px)!important}#xi-tabs{grid-template-columns:1fr!important}.xi-grid{grid-template-columns:1fr!important}}
        `);
    }

    function pillSvg() {
        return `
<svg class="xi-pill-svg" viewBox="0 0 64 64" aria-hidden="true">
    <defs>
        <linearGradient id="xiPillGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#f6feff"></stop>
            <stop offset="48%" stop-color="#d8fbff"></stop>
            <stop offset="49%" stop-color="#7ed9e8"></stop>
            <stop offset="100%" stop-color="#45b7ca"></stop>
        </linearGradient>
    </defs>
    <g transform="rotate(-35 32 32)">
        <rect x="10" y="20" rx="12" ry="12" width="44" height="24" fill="url(#xiPillGrad)"></rect>
        <line x1="32" y1="20" x2="32" y2="44" stroke="#0b3038" stroke-width="2.6" opacity="0.35"></line>
    </g>
</svg>`;
    }

    function money(n) {
        return '$' + Number(n || 0).toLocaleString();
    }

    function apiGet(path, callback) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: API_BASE + path,
            timeout: 20000,
            onload: function (res) {
                try {
                    callback(null, JSON.parse(res.responseText));
                } catch (e) {
                    callback(new Error('Bad JSON'));
                }
            },
            onerror: function () {
                callback(new Error('Request failed'));
            },
            ontimeout: function () {
                callback(new Error('Timed out'));
            }
        });
    }

    function apiPost(path, payload, callback) {
        GM_xmlhttpRequest({
            method: 'POST',
            url: API_BASE + path,
            timeout: 20000,
            headers: {
                'Content-Type': 'application/json'
            },
            data: JSON.stringify(payload || {}),
            onload: function (res) {
                try {
                    callback(null, JSON.parse(res.responseText));
                } catch (e) {
                    callback(new Error('Bad JSON'));
                }
            },
            onerror: function () {
                callback(new Error('Request failed'));
            },
            ontimeout: function () {
                callback(new Error('Timed out'));
            }
        });
    }

    function ensurePlans(callback) {
        if (plansCache) {
            callback(null, plansCache);
            return;
        }
        apiGet('/api/insurance/plans', function (err, data) {
            if (err) return callback(err);
            if (!data || !data.ok || !Array.isArray(data.plans)) {
                return callback(new Error('Invalid plans response'));
            }
            plansCache = data.plans;
            callback(null, plansCache);
        });
    }

    function getPlan(planKey) {
        if (!plansCache) return null;
        return plansCache.find(function (p) { return p.plan_key === planKey; }) || null;
    }

    function ensureMemberBasics() {
        if (memberData.torn_id && memberData.name && memberData.faction_id) return true;

        var tornId = prompt('Enter your Torn ID');
        if (!tornId) return false;

        var name = prompt('Enter your Torn name');
        if (!name) return false;

        var factionId = prompt('Enter your faction ID');
        if (!factionId) return false;

        memberData.torn_id = Number(tornId) || 0;
        memberData.name = String(name || '').trim();
        memberData.faction_id = Number(factionId) || 0;

        saveMemberData();
        return !!(memberData.torn_id && memberData.name && memberData.faction_id);
    }

    function createLauncher() {
        if (document.getElementById('xi-pill-launcher')) return;
        var launcher = document.createElement('div');
        launcher.id = 'xi-pill-launcher';
        launcher.innerHTML = pillSvg() + '<div class="xi-plus-badge">+</div>';
        launcher.addEventListener('click', toggleOverlay);
        document.body.appendChild(launcher);
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
                <div id="xi-title">Faction Xanax Insurance</div>
                <div id="xi-subtitle">Medical coverage panel for faction members</div>
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
    <button class="xi-tab active" data-tab="xanax_stack" type="button">Xanax Stack</button>
    <button class="xi-tab" data-tab="jump_1_4" type="button">1–4 Jumps</button>
    <button class="xi-tab" data-tab="xanax_only" type="button">Single Xanax</button>
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

    function renderIdentityCard() {
        return `
<div class="xi-card">
    <div class="xi-card-title">
        <strong>🪪 Member Identity</strong>
        <span class="xi-mini-badge">Required</span>
    </div>
    <input id="xi-member-torn-id" class="xi-input" type="number" placeholder="Torn ID" value="${memberData.torn_id || ''}">
    <input id="xi-member-name" class="xi-input" type="text" placeholder="Name" value="${escapeHtml(memberData.name || '')}">
    <input id="xi-member-faction-id" class="xi-input" type="number" placeholder="Faction ID" value="${memberData.faction_id || ''}">
    <div class="xi-actions">
        <button class="xi-btn primary" id="xi-save-identity" type="button">Save Identity</button>
    </div>
    <div class="xi-note">
        This is a temporary setup. Backend trust is still based on values entered here until we add real faction auth.
    </div>
</div>`;
    }

    function renderPlanTab(plan, meData) {
        var memberRow = meData && meData.member && !Array.isArray(meData.member) ? meData.member : null;
        var claims = meData && Array.isArray(meData.claims) ? meData.claims : [];
        var latestClaim = claims.length ? claims[0] : null;

        return `
${renderIdentityCard()}

<div class="xi-card">
    <div class="xi-card-title">
        <strong>💊 Coverage</strong>
        <span class="xi-mini-badge">${escapeHtml(plan.title)}</span>
    </div>
    <div class="xi-grid">
        <div class="xi-stat">
            <div class="xi-stat-label">Premium</div>
            <div class="xi-stat-value">${money(plan.premium_amount)}</div>
        </div>
        <div class="xi-stat">
            <div class="xi-stat-label">Payout</div>
            <div class="xi-stat-value">${money(plan.payout_amount)}</div>
        </div>
    </div>
    <div class="xi-note">${escapeHtml(plan.description || '')}</div>
</div>

<div class="xi-card">
    <div class="xi-card-title">
        <strong>🩺 My Policy</strong>
        <span class="xi-mini-badge">${memberRow ? 'Enrolled' : 'Not Enrolled'}</span>
    </div>
    <div class="xi-list">
        <div class="xi-list-row">
            <div class="xi-list-left">Status</div>
            <div class="xi-list-right">${memberRow ? escapeHtml(memberRow.status || 'active') : 'inactive'}</div>
        </div>
        <div class="xi-list-row">
            <div class="xi-list-left">Covered Count</div>
            <div class="xi-list-right">${plan.min_count === plan.max_count ? plan.max_count : (plan.min_count + ' to ' + plan.max_count)}</div>
        </div>
        <div class="xi-list-row">
            <div class="xi-list-left">Last Claim</div>
            <div class="xi-list-right">${latestClaim ? escapeHtml(latestClaim.status || 'pending') : 'none yet'}</div>
        </div>
    </div>
</div>

<div class="xi-card">
    <div class="xi-card-title">
        <strong>📋 Actions</strong>
        <span class="xi-mini-badge">Live</span>
    </div>
    <div class="xi-actions">
        <button class="xi-btn primary" data-action="enroll" data-plan="${plan.plan_key}" type="button">Enroll</button>
        <button class="xi-btn success" data-action="claim" data-plan="${plan.plan_key}" type="button">File Claim</button>
        <button class="xi-btn ghost" data-action="refresh" data-plan="${plan.plan_key}" type="button">Refresh</button>
    </div>
    <div class="xi-note">
        Enroll and claim are now wired to Render.
    </div>
</div>`;
    }

    function renderBody() {
        var body = document.getElementById('xi-body');
        if (!body) return;

        body.innerHTML = '<div class="xi-loading">Loading plan and member data...</div>';

        ensurePlans(function (err) {
            if (err) {
                body.innerHTML = '<div class="xi-error">Could not load plans.</div>';
                return;
            }

            var plan = getPlan(currentTab);
            if (!plan) {
                body.innerHTML = '<div class="xi-error">Plan not found.</div>';
                return;
            }

            if (!memberData.torn_id) {
                body.innerHTML = renderPlanTab(plan, { member: null, claims: [] });
                bindUi(plan);
                return;
            }

            apiGet('/api/insurance/me?torn_id=' + encodeURIComponent(memberData.torn_id) + '&plan_key=' + encodeURIComponent(plan.plan_key), function (err2, meData) {
                if (err2 || !meData || !meData.ok) {
                    body.innerHTML = renderPlanTab(plan, { member: null, claims: [] });
                    bindUi(plan);
                    return;
                }

                body.innerHTML = renderPlanTab(plan, meData);
                bindUi(plan);
            });
        });
    }

    function bindUi(plan) {
        var saveBtn = document.getElementById('xi-save-identity');
        if (saveBtn) {
            saveBtn.addEventListener('click', function () {
                var tornId = Number((document.getElementById('xi-member-torn-id') || {}).value || 0);
                var name = String((document.getElementById('xi-member-name') || {}).value || '').trim();
                var factionId = Number((document.getElementById('xi-member-faction-id') || {}).value || 0);

                memberData.torn_id = tornId;
                memberData.name = name;
                memberData.faction_id = factionId;
                saveMemberData();
                alert('Identity saved.');
                renderBody();
            });
        }

        document.querySelectorAll('[data-action]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var action = btn.getAttribute('data-action');
                var planKey = btn.getAttribute('data-plan');
                if (action === 'refresh') {
                    renderBody();
                    return;
                }
                if (action === 'enroll') {
                    submitEnroll(planKey);
                    return;
                }
                if (action === 'claim') {
                    submitClaim(planKey, plan);
                }
            });
        });
    }

    function submitEnroll(planKey) {
        if (!ensureMemberBasics()) return;

        apiPost('/api/insurance/enroll', {
            torn_id: memberData.torn_id,
            name: memberData.name,
            faction_id: memberData.faction_id,
            plan_key: planKey
        }, function (err, data) {
            if (err) return alert('Enroll failed.');
            if (!data || !data.ok) return alert((data && data.error) || 'Enroll failed.');
            alert('Enrolled successfully.');
            renderBody();
        });
    }

    function submitClaim(planKey, plan) {
        if (!ensureMemberBasics()) return;

        var jumpCount = plan.max_count;
        if (plan.plan_key === 'jump_1_4') {
            var entered = prompt('Enter jump count between 1 and 4', '1');
            if (!entered) return;
            jumpCount = Number(entered) || 1;
        }

        var proofText = prompt('Enter proof or short claim note', '');
        if (proofText === null) return;

        apiPost('/api/insurance/claim', {
            torn_id: memberData.torn_id,
            name: memberData.name,
            faction_id: memberData.faction_id,
            plan_key: planKey,
            jump_count: jumpCount,
            proof_text: proofText
        }, function (err, data) {
            if (err) return alert('Claim failed.');
            if (!data || !data.ok) return alert((data && data.error) || 'Claim failed.');
            alert('Claim submitted.');
            renderBody();
        });
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
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
        createLauncher();
        createOverlay();
        return true;
    }

    function boot() {
        if (mount()) return;
        var tries = 0;
        var timer = setInterval(function () {
            tries += 1;
            if (mount() || tries > 60) clearInterval(timer);
        }, 500);
    }

    boot();
})();
