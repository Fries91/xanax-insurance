// ==UserScript==
// @name         Faction Xanax Insurance
// @namespace    fries91-xanax-insurance
// @version      1.0.0
// @description  Medical-style faction Xanax insurance overlay
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';

    var currentTab = 'xanax_stack';
    var overlayOpen = false;

    function addStyles() {
        var css = `
#xi-pill-launcher {
    position: fixed !important;
    top: 52% !important;
    right: 14px !important;
    transform: translateY(-50%) !important;
    width: 52px !important;
    height: 52px !important;
    border-radius: 16px !important;
    z-index: 2147483647 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    cursor: pointer !important;
    user-select: none !important;
    -webkit-user-select: none !important;
    border: 1px solid rgba(120, 220, 240, 0.35) !important;
    background:
        radial-gradient(circle at 30% 25%, rgba(255,255,255,0.22), transparent 35%),
        linear-gradient(180deg, #102a35 0%, #0a171d 100%) !important;
    box-shadow:
        0 8px 24px rgba(0, 0, 0, 0.45),
        0 0 0 1px rgba(72, 199, 217, 0.12),
        0 0 18px rgba(72, 199, 217, 0.16) !important;
    transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease !important;
}

#xi-pill-launcher:hover {
    transform: translateY(-50%) scale(1.05) !important;
    box-shadow:
        0 10px 28px rgba(0, 0, 0, 0.52),
        0 0 0 1px rgba(72, 199, 217, 0.18),
        0 0 24px rgba(72, 199, 217, 0.24) !important;
}

#xi-pill-launcher .xi-pill-svg {
    width: 30px !important;
    height: 30px !important;
    display: block !important;
    filter: drop-shadow(0 1px 4px rgba(0,0,0,0.35)) !important;
}

#xi-pill-launcher .xi-plus-badge {
    position: absolute !important;
    right: -4px !important;
    bottom: -4px !important;
    width: 19px !important;
    height: 19px !important;
    border-radius: 999px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-size: 12px !important;
    font-weight: 900 !important;
    color: #eaffff !important;
    background: linear-gradient(180deg, #57d6a6 0%, #299b74 100%) !important;
    border: 2px solid #091116 !important;
    box-shadow: 0 4px 10px rgba(0,0,0,0.35) !important;
}

#xi-overlay {
    position: fixed !important;
    top: 70px !important;
    right: 78px !important;
    width: 385px !important;
    max-width: calc(100vw - 24px) !important;
    max-height: calc(100vh - 90px) !important;
    overflow: hidden !important;
    z-index: 2147483646 !important;
    border-radius: 18px !important;
    background:
        radial-gradient(circle at top right, rgba(72, 199, 217, 0.10), transparent 28%),
        linear-gradient(180deg, rgba(16, 32, 40, 0.98) 0%, rgba(8, 18, 24, 0.98) 100%) !important;
    border: 1px solid rgba(72, 199, 217, 0.22) !important;
    box-shadow:
        0 20px 40px rgba(0, 0, 0, 0.45),
        0 0 0 1px rgba(255,255,255,0.03) inset !important;
    backdrop-filter: blur(10px) !important;
    -webkit-backdrop-filter: blur(10px) !important;
    color: #e9f7fb !important;
    font-family: Arial, Helvetica, sans-serif !important;
}

#xi-overlay.hidden {
    display: none !important;
}

#xi-header {
    padding: 14px 14px 12px 14px !important;
    border-bottom: 1px solid rgba(72, 199, 217, 0.14) !important;
    background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0)) !important;
}

#xi-header-top {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 10px !important;
}

#xi-brand {
    display: flex !important;
    align-items: center !important;
    gap: 10px !important;
    min-width: 0 !important;
}

#xi-brand-icon {
    width: 38px !important;
    height: 38px !important;
    border-radius: 12px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    background:
        radial-gradient(circle at 30% 25%, rgba(255,255,255,0.18), transparent 35%),
        linear-gradient(180deg, #14323d 0%, #0b1a22 100%) !important;
    border: 1px solid rgba(137, 228, 242, 0.24) !important;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.05) !important;
}

#xi-brand-icon svg {
    width: 22px !important;
    height: 22px !important;
    display: block !important;
}

#xi-title-wrap {
    min-width: 0 !important;
}

#xi-title {
    font-size: 16px !important;
    font-weight: 800 !important;
    line-height: 1.2 !important;
    color: #ecfbff !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
}

#xi-subtitle {
    margin-top: 2px !important;
    font-size: 11px !important;
    color: #9fc0c7 !important;
    letter-spacing: 0.2px !important;
}

#xi-close {
    width: 32px !important;
    height: 32px !important;
    border: 1px solid rgba(255,255,255,0.08) !important;
    border-radius: 10px !important;
    background: rgba(255,255,255,0.04) !important;
    color: #dff7fb !important;
    cursor: pointer !important;
    font-size: 18px !important;
    line-height: 1 !important;
}

#xi-close:hover {
    background: rgba(255,255,255,0.08) !important;
}

#xi-badges {
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    flex-wrap: wrap !important;
    margin-top: 10px !important;
}

.xi-badge {
    display: inline-flex !important;
    align-items: center !important;
    gap: 5px !important;
    padding: 5px 9px !important;
    border-radius: 999px !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    letter-spacing: 0.2px !important;
    border: 1px solid transparent !important;
}

.xi-badge.faction {
    color: #dffcff !important;
    background: rgba(72, 199, 217, 0.12) !important;
    border-color: rgba(72, 199, 217, 0.20) !important;
}

.xi-badge.covered {
    color: #eafff4 !important;
    background: rgba(80, 216, 144, 0.12) !important;
    border-color: rgba(80, 216, 144, 0.20) !important;
}

#xi-tabs {
    display: grid !important;
    grid-template-columns: 1fr 1fr 1fr !important;
    gap: 8px !important;
    padding: 12px 14px 10px 14px !important;
    border-bottom: 1px solid rgba(72, 199, 217, 0.10) !important;
}

.xi-tab {
    border: 1px solid rgba(255,255,255,0.07) !important;
    background: rgba(255,255,255,0.03) !important;
    color: #cfe9ee !important;
    border-radius: 12px !important;
    padding: 10px 8px !important;
    cursor: pointer !important;
    font-size: 12px !important;
    font-weight: 700 !important;
    text-align: center !important;
    transition: all 0.16s ease !important;
}

.xi-tab:hover {
    background: rgba(255,255,255,0.06) !important;
}

.xi-tab.active {
    color: #f3feff !important;
    background: linear-gradient(180deg, rgba(72, 199, 217, 0.18), rgba(72, 199, 217, 0.07)) !important;
    border-color: rgba(72, 199, 217, 0.25) !important;
    box-shadow: 0 0 0 1px rgba(72, 199, 217, 0.08) inset !important;
}

#xi-body {
    max-height: calc(100vh - 220px) !important;
    overflow-y: auto !important;
    padding: 14px !important;
}

#xi-body::-webkit-scrollbar {
    width: 8px !important;
}

#xi-body::-webkit-scrollbar-thumb {
    background: rgba(137, 228, 242, 0.18) !important;
    border-radius: 999px !important;
}

.xi-card {
    margin-bottom: 12px !important;
    border-radius: 14px !important;
    border: 1px solid rgba(255,255,255,0.06) !important;
    background:
        linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015)) !important;
    padding: 12px !important;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.03) !important;
}

.xi-card-title {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 10px !important;
    margin-bottom: 10px !important;
}

.xi-card-title strong {
    font-size: 13px !important;
    color: #ecfbff !important;
    letter-spacing: 0.2px !important;
}

.xi-mini-badge {
    display: inline-flex !important;
    align-items: center !important;
    padding: 4px 8px !important;
    border-radius: 999px !important;
    font-size: 10px !important;
    font-weight: 800 !important;
    color: #c9fbff !important;
    background: rgba(72, 199, 217, 0.12) !important;
    border: 1px solid rgba(72, 199, 217, 0.18) !important;
}

.xi-grid {
    display: grid !important;
    grid-template-columns: 1fr 1fr !important;
    gap: 10px !important;
}

.xi-stat {
    border-radius: 12px !important;
    background: rgba(0,0,0,0.14) !important;
    border: 1px solid rgba(255,255,255,0.05) !important;
    padding: 10px !important;
}

.xi-stat-label {
    font-size: 11px !important;
    color: #9fc0c7 !important;
    margin-bottom: 5px !important;
}

.xi-stat-value {
    font-size: 15px !important;
    font-weight: 800 !important;
    color: #f1fdff !important;
}

.xi-text {
    font-size: 12px !important;
    line-height: 1.5 !important;
    color: #cce5ea !important;
}

.xi-list {
    display: grid !important;
    gap: 8px !important;
}

.xi-list-row {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 8px !important;
    padding: 8px 10px !important;
    border-radius: 10px !important;
    background: rgba(0,0,0,0.12) !important;
    border: 1px solid rgba(255,255,255,0.04) !important;
}

.xi-list-left {
    font-size: 12px !important;
    color: #dff4f8 !important;
}

.xi-list-right {
    font-size: 11px !important;
    color: #8fb5bd !important;
    text-align: right !important;
}

.xi-actions {
    display: flex !important;
    gap: 8px !important;
    flex-wrap: wrap !important;
}

.xi-btn {
    appearance: none !important;
    border: 1px solid rgba(255,255,255,0.08) !important;
    border-radius: 12px !important;
    padding: 10px 12px !important;
    font-size: 12px !important;
    font-weight: 800 !important;
    cursor: pointer !important;
    transition: all 0.16s ease !important;
}

.xi-btn.primary {
    color: #ecfeff !important;
    background: linear-gradient(180deg, #1f94a8 0%, #12697a 100%) !important;
    border-color: rgba(137, 228, 242, 0.22) !important;
    box-shadow: 0 6px 16px rgba(18, 105, 122, 0.28) !important;
}

.xi-btn.primary:hover {
    filter: brightness(1.05) !important;
}

.xi-btn.success {
    color: #effff6 !important;
    background: linear-gradient(180deg, #39b47d 0%, #268961 100%) !important;
    border-color: rgba(80, 216, 144, 0.22) !important;
}

.xi-btn.ghost {
    color: #d7eef3 !important;
    background: rgba(255,255,255,0.04) !important;
}

.xi-note {
    margin-top: 8px !important;
    font-size: 11px !important;
    color: #8fb5bd !important;
    line-height: 1.45 !important;
}

@media (max-width: 520px) {
    #xi-overlay {
        top: 60px !important;
        right: 8px !important;
        left: 8px !important;
        width: auto !important;
        max-width: none !important;
        max-height: calc(100vh - 72px) !important;
    }

    #xi-pill-launcher {
        right: 10px !important;
        width: 50px !important;
        height: 50px !important;
    }

    #xi-tabs {
        grid-template-columns: 1fr !important;
    }

    .xi-grid {
        grid-template-columns: 1fr !important;
    }
}
        `;
        GM_addStyle(css);
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
        <rect x="10" y="20" rx="12" ry="12" width="44" height="24" fill="url(#xiPillGrad)" stroke="rgba(0,0,0,0.18)"></rect>
        <line x1="32" y1="20" x2="32" y2="44" stroke="#0b3038" stroke-width="2.6" opacity="0.35"></line>
    </g>
</svg>`;
    }

    function createLauncher() {
        if (document.getElementById('xi-pill-launcher')) return;

        var launcher = document.createElement('div');
        launcher.id = 'xi-pill-launcher';
        launcher.setAttribute('title', 'Faction Xanax Insurance');
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
            <div id="xi-title-wrap">
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

        var closeBtn = overlay.querySelector('#xi-close');
        closeBtn.addEventListener('click', closeOverlay);

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
            var active = btn.getAttribute('data-tab') === currentTab;
            btn.classList.toggle('active', active);
        });
    }

    function renderBody() {
        var body = document.getElementById('xi-body');
        if (!body) return;

        if (currentTab === 'xanax_stack') {
            body.innerHTML = renderXanaxStack();
            bindActionButtons();
            return;
        }

        if (currentTab === 'jump_1_4') {
            body.innerHTML = renderJump14();
            bindActionButtons();
            return;
        }

        if (currentTab === 'xanax_only') {
            body.innerHTML = renderXanaxOnly();
            bindActionButtons();
            return;
        }

        body.innerHTML = '<div class="xi-card"><div class="xi-text">No tab selected.</div></div>';
    }

    function renderXanaxStack() {
        return `
<div class="xi-card">
    <div class="xi-card-title">
        <strong>💊 Coverage</strong>
        <span class="xi-mini-badge">4 Stack</span>
    </div>

    <div class="xi-grid">
        <div class="xi-stat">
            <div class="xi-stat-label">Premium</div>
            <div class="xi-stat-value">$1,000,000</div>
        </div>
        <div class="xi-stat">
            <div class="xi-stat-label">Payout</div>
            <div class="xi-stat-value">$4,000,000</div>
        </div>
    </div>

    <div class="xi-note">
        Full coverage placeholder for members insuring a complete 4 Xanax stack.
    </div>
</div>

<div class="xi-card">
    <div class="xi-card-title">
        <strong>🩺 My Policy</strong>
        <span class="xi-mini-badge">Not Enrolled</span>
    </div>

    <div class="xi-list">
        <div class="xi-list-row">
            <div class="xi-list-left">Status</div>
            <div class="xi-list-right">Inactive</div>
        </div>
        <div class="xi-list-row">
            <div class="xi-list-left">Coverage Type</div>
            <div class="xi-list-right">Full 4 Stack</div>
        </div>
        <div class="xi-list-row">
            <div class="xi-list-left">Last Claim</div>
            <div class="xi-list-right">None yet</div>
        </div>
    </div>
</div>

<div class="xi-card">
    <div class="xi-card-title">
        <strong>📋 Actions</strong>
        <span class="xi-mini-badge">Ready</span>
    </div>

    <div class="xi-actions">
        <button class="xi-btn primary" data-action="enroll_stack" type="button">Enroll</button>
        <button class="xi-btn success" data-action="claim_stack" type="button">File Claim</button>
        <button class="xi-btn ghost" data-action="rules_stack" type="button">View Rules</button>
    </div>

    <div class="xi-note">
        Backend wiring comes next. These buttons are ready for your enroll and claim flows.
    </div>
</div>
        `;
    }

    function renderJump14() {
        return `
<div class="xi-card">
    <div class="xi-card-title">
        <strong>💉 Coverage</strong>
        <span class="xi-mini-badge">1–4 Jumps</span>
    </div>

    <div class="xi-grid">
        <div class="xi-stat">
            <div class="xi-stat-label">Premium Range</div>
            <div class="xi-stat-value">$250k+</div>
        </div>
        <div class="xi-stat">
            <div class="xi-stat-label">Payout Range</div>
            <div class="xi-stat-value">$1m+</div>
        </div>
    </div>

    <div class="xi-note">
        Variable-size jump coverage placeholder. Later this tab can use a dropdown for 1, 2, 3, or 4 jumps.
    </div>
</div>

<div class="xi-card">
    <div class="xi-card-title">
        <strong>🩹 My Policy</strong>
        <span class="xi-mini-badge">No Plan</span>
    </div>

    <div class="xi-list">
        <div class="xi-list-row">
            <div class="xi-list-left">Selected Jump Size</div>
            <div class="xi-list-right">Not set</div>
        </div>
        <div class="xi-list-row">
            <div class="xi-list-left">Status</div>
            <div class="xi-list-right">Inactive</div>
        </div>
        <div class="xi-list-row">
            <div class="xi-list-left">Pending Claim</div>
            <div class="xi-list-right">No</div>
        </div>
    </div>
</div>

<div class="xi-card">
    <div class="xi-card-title">
        <strong>📋 Actions</strong>
        <span class="xi-mini-badge">Pending Setup</span>
    </div>

    <div class="xi-actions">
        <button class="xi-btn primary" data-action="enroll_jump" type="button">Choose Plan</button>
        <button class="xi-btn success" data-action="claim_jump" type="button">File Claim</button>
        <button class="xi-btn ghost" data-action="rules_jump" type="button">View Rules</button>
    </div>

    <div class="xi-note">
        This is where we will later add the jump-size selector and dynamic premium/payout values.
    </div>
</div>
        `;
    }

    function renderXanaxOnly() {
        return `
<div class="xi-card">
    <div class="xi-card-title">
        <strong>💊 Coverage</strong>
        <span class="xi-mini-badge">Single Use</span>
    </div>

    <div class="xi-grid">
        <div class="xi-stat">
            <div class="xi-stat-label">Premium</div>
            <div class="xi-stat-value">$100,000</div>
        </div>
        <div class="xi-stat">
            <div class="xi-stat-label">Payout</div>
            <div class="xi-stat-value">$400,000</div>
        </div>
    </div>

    <div class="xi-note">
        Single Xanax protection placeholder for quick coverage and smaller claims.
    </div>
</div>

<div class="xi-card">
    <div class="xi-card-title">
        <strong>🧾 My Policy</strong>
        <span class="xi-mini-badge">Quick Cover</span>
    </div>

    <div class="xi-list">
        <div class="xi-list-row">
            <div class="xi-list-left">Enrollment</div>
            <div class="xi-list-right">Not active</div>
        </div>
        <div class="xi-list-row">
            <div class="xi-list-left">Last Activity</div>
            <div class="xi-list-right">No records</div>
        </div>
        <div class="xi-list-row">
            <div class="xi-list-left">Cooldown</div>
            <div class="xi-list-right">None</div>
        </div>
    </div>
</div>

<div class="xi-card">
    <div class="xi-card-title">
        <strong>📋 Actions</strong>
        <span class="xi-mini-badge">Fast Action</span>
    </div>

    <div class="xi-actions">
        <button class="xi-btn primary" data-action="enroll_single" type="button">Enroll</button>
        <button class="xi-btn success" data-action="claim_single" type="button">File Claim</button>
        <button class="xi-btn ghost" data-action="rules_single" type="button">View Rules</button>
    </div>

    <div class="xi-note">
        Best for a simple single-Xanax coverage flow once the backend is connected.
    </div>
</div>
        `;
    }

    function bindActionButtons() {
        var body = document.getElementById('xi-body');
        if (!body) return;

        body.querySelectorAll('[data-action]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var action = btn.getAttribute('data-action') || '';
                handleAction(action);
            });
        });
    }

    function handleAction(action) {
        if (action === 'enroll_stack') return alert('Enroll flow for Xanax Stack comes next.');
        if (action === 'claim_stack') return alert('Claim flow for Xanax Stack comes next.');
        if (action === 'rules_stack') return alert('Rules panel for Xanax Stack comes next.');

        if (action === 'enroll_jump') return alert('Plan selector for 1–4 Jumps comes next.');
        if (action === 'claim_jump') return alert('Claim flow for 1–4 Jumps comes next.');
        if (action === 'rules_jump') return alert('Rules panel for 1–4 Jumps comes next.');

        if (action === 'enroll_single') return alert('Enroll flow for Single Xanax comes next.');
        if (action === 'claim_single') return alert('Claim flow for Single Xanax comes next.');
        if (action === 'rules_single') return alert('Rules panel for Single Xanax comes next.');
    }

    function openOverlay() {
        var overlay = document.getElementById('xi-overlay');
        if (!overlay) return;
        overlay.classList.remove('hidden');
        overlayOpen = true;
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
            if (mount() || tries > 60) {
                clearInterval(timer);
            }
        }, 500);
    }

    boot();
})();
