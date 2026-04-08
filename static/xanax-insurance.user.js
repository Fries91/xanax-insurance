// ==UserScript==
// @name         Sinner's Insurance 7DS Tabs
// @namespace    fries91-xanax-insurance
// @version      2.2.5
// @description  Sinner's Insurance bottom-left launcher with 4-tab 7 Deadly Sins themed overlay
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @run-at       document-idle
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';

    var launcherBar = null;
    var overlay = null;
    var remountTimer = null;
    var activeTab = 'overview';

    var TAB_LABELS = {
        overview: 'Overview',
        plans: 'Plans',
        claims: 'Claims',
        settings: 'Settings'
    };

    function addStyles() {
        if (document.getElementById('si-7ds-style-flag')) return;

        GM_addStyle(`
#si-7ds-launcher {
  position: fixed !important;
  left: env(safe-area-inset-left, 0px) !important;
  bottom: env(safe-area-inset-bottom, 0px) !important;
  width: 170px !important;
  height: 34px !important;
  z-index: 2147483647 !important;
  display: flex !important;
  justify-content: flex-start !important;
  align-items: flex-end !important;
  box-sizing: border-box !important;
  pointer-events: none !important;
}
#si-7ds-launcher-btn {
  pointer-events: auto !important;
  appearance: none !important;
  -webkit-appearance: none !important;
  position: absolute !important;
  left: 0 !important;
  bottom: 0 !important;
  transform: none !important;
  width: 164px !important;
  height: 28px !important;
  padding: 0 10px !important;
  border-radius: 8px !important;
  border: 1px solid rgba(205, 164, 74, .46) !important;
  background: linear-gradient(180deg, rgba(82, 10, 14, .88), rgba(44, 6, 9, .92)) !important;
  box-shadow:
    0 0 0 1px rgba(255,255,255,.03) inset,
    0 6px 16px rgba(0,0,0,.22),
    0 0 12px rgba(164, 17, 23, .12) !important;
  color: #f3df9c !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 6px !important;
  text-align: center !important;
  font-size: 11px !important;
  font-weight: 800 !important;
  letter-spacing: .15px !important;
  white-space: nowrap !important;
  cursor: pointer !important;
  overflow: hidden !important;
}
#si-7ds-launcher-btn::before {
  content: '' !important;
  position: absolute !important;
  inset: 0 !important;
  background: linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,0) 38%, rgba(0,0,0,.14)) !important;
  pointer-events: none !important;
}
#si-7ds-launcher-btn::after {
  content: '' !important;
  position: absolute !important;
  left: 8px !important;
  right: 8px !important;
  bottom: 0 !important;
  height: 1px !important;
  background: linear-gradient(90deg, rgba(176,27,35,0), rgba(222,185,90,.9), rgba(176,27,35,0)) !important;
  opacity: .95 !important;
  pointer-events: none !important;
}
#si-7ds-launcher-btn:active {
  transform: translateY(1px) !important;
}
#si-7ds-launcher-btn .si-7ds-icon {
  font-size: 11px !important;
  line-height: 1 !important;
  filter: drop-shadow(0 0 4px rgba(232, 196, 102, .24)) !important;
}
#si-7ds-overlay-backdrop {
  position: fixed !important;
  inset: 0 !important;
  z-index: 2147483645 !important;
  display: none !important;
  background: rgba(4, 2, 5, .58) !important;
  backdrop-filter: blur(2px) !important;
  -webkit-backdrop-filter: blur(2px) !important;
}
#si-7ds-overlay-backdrop.open {
  display: block !important;
}
#si-7ds-overlay {
  position: fixed !important;
  left: 10px !important;
  right: 10px !important;
  top: 84px !important;
  bottom: 96px !important;
  width: auto !important;
  max-width: 540px !important;
  margin: 0 auto !important;
  z-index: 2147483646 !important;
  display: none !important;
  flex-direction: column !important;
  overflow: hidden !important;
  border-radius: 16px !important;
  border: 1px solid rgba(201, 162, 80, .28) !important;
  background:
    radial-gradient(circle at top center, rgba(118, 16, 21, .24), rgba(118, 16, 21, 0) 34%),
    linear-gradient(180deg, rgba(28, 10, 14, .985), rgba(9, 5, 8, .99)) !important;
  box-shadow:
    0 28px 60px rgba(0,0,0,.62),
    0 0 0 1px rgba(255,255,255,.03) inset,
    0 0 24px rgba(133, 10, 17, .18) !important;
  color: #f7ead0 !important;
}
#si-7ds-overlay.open {
  display: flex !important;
}
#si-7ds-overlay .si-7ds-head {
  position: relative !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 12px !important;
  padding: 14px 14px 12px !important;
  background: linear-gradient(180deg, rgba(111, 13, 18, .36), rgba(22, 7, 10, .08)) !important;
  border-bottom: 1px solid rgba(201, 162, 80, .22) !important;
}
#si-7ds-overlay .si-7ds-head::after {
  content: '' !important;
  position: absolute !important;
  left: 14px !important;
  right: 14px !important;
  bottom: 0 !important;
  height: 2px !important;
  background: linear-gradient(90deg, rgba(0,0,0,0), rgba(210,172,86,.95), rgba(0,0,0,0)) !important;
}
#si-7ds-overlay .si-7ds-titlewrap {
  display: flex !important;
  flex-direction: column !important;
  gap: 3px !important;
  min-width: 0 !important;
}
#si-7ds-overlay .si-7ds-title {
  font-size: 16px !important;
  font-weight: 900 !important;
  letter-spacing: .45px !important;
  color: #f1dfab !important;
  text-transform: uppercase !important;
}
#si-7ds-overlay .si-7ds-sub {
  font-size: 11px !important;
  color: rgba(241, 223, 171, .74) !important;
  text-transform: uppercase !important;
  letter-spacing: .9px !important;
}
#si-7ds-overlay .si-7ds-close {
  appearance: none !important;
  -webkit-appearance: none !important;
  min-width: 38px !important;
  height: 38px !important;
  border-radius: 11px !important;
  border: 1px solid rgba(201, 162, 80, .24) !important;
  background: linear-gradient(180deg, rgba(71, 14, 18, .96), rgba(26, 8, 10, .98)) !important;
  color: #f2de9f !important;
  font-size: 18px !important;
  font-weight: 700 !important;
  cursor: pointer !important;
  box-shadow: 0 6px 16px rgba(0,0,0,.28) !important;
}
#si-7ds-overlay .si-7ds-tabrow {
  display: grid !important;
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 8px !important;
  padding: 12px 14px 0 !important;
}
#si-7ds-overlay .si-7ds-tab {
  appearance: none !important;
  -webkit-appearance: none !important;
  min-height: 36px !important;
  padding: 0 8px !important;
  border-radius: 10px !important;
  border: 1px solid rgba(201, 162, 80, .18) !important;
  background: linear-gradient(180deg, rgba(62, 12, 16, .82), rgba(24, 7, 10, .92)) !important;
  color: rgba(241, 223, 171, .86) !important;
  font-size: 11px !important;
  font-weight: 800 !important;
  letter-spacing: .45px !important;
  text-transform: uppercase !important;
  cursor: pointer !important;
  box-shadow: 0 6px 14px rgba(0,0,0,.18) !important;
}
#si-7ds-overlay .si-7ds-tab.active {
  border-color: rgba(222,185,90,.42) !important;
  background: linear-gradient(180deg, rgba(124, 19, 26, .95), rgba(64, 10, 15, .98)) !important;
  color: #f8e6ab !important;
  box-shadow:
    0 0 0 1px rgba(255,255,255,.03) inset,
    0 0 14px rgba(176, 27, 35, .24),
    0 8px 18px rgba(0,0,0,.25) !important;
}
#si-7ds-overlay .si-7ds-body {
  padding: 14px !important;
  overflow: auto !important;
  display: grid !important;
  gap: 12px !important;
}
#si-7ds-overlay .si-7ds-card {
  border-radius: 14px !important;
  border: 1px solid rgba(201, 162, 80, .16) !important;
  background: linear-gradient(180deg, rgba(255,255,255,.032), rgba(255,255,255,.018)) !important;
  box-shadow: 0 8px 18px rgba(0,0,0,.18) !important;
  padding: 12px !important;
}
#si-7ds-overlay .si-7ds-card-title {
  font-size: 12px !important;
  font-weight: 900 !important;
  color: #f0dd9f !important;
  text-transform: uppercase !important;
  letter-spacing: .8px !important;
  margin-bottom: 8px !important;
}
#si-7ds-overlay .si-7ds-text {
  font-size: 13px !important;
  line-height: 1.5 !important;
  color: #f8f0dd !important;
}
#si-7ds-overlay .si-7ds-pillrow {
  display: flex !important;
  flex-wrap: wrap !important;
  gap: 8px !important;
}
#si-7ds-overlay .si-7ds-pill {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  min-height: 28px !important;
  padding: 0 10px !important;
  border-radius: 999px !important;
  border: 1px solid rgba(201, 162, 80, .18) !important;
  background: rgba(119, 17, 22, .22) !important;
  color: #f1dfab !important;
  font-size: 11px !important;
  font-weight: 800 !important;
  letter-spacing: .55px !important;
  text-transform: uppercase !important;
}
#si-7ds-overlay .si-7ds-list {
  display: grid !important;
  gap: 8px !important;
}
#si-7ds-overlay .si-7ds-list-item {
  border-radius: 10px !important;
  border: 1px solid rgba(201, 162, 80, .14) !important;
  background: rgba(255,255,255,.02) !important;
  padding: 10px !important;
}
#si-7ds-overlay .si-7ds-setting-row {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 10px !important;
  padding: 10px 0 !important;
  border-bottom: 1px solid rgba(201, 162, 80, .08) !important;
}
#si-7ds-overlay .si-7ds-setting-row:last-child {
  border-bottom: 0 !important;
}
#si-7ds-overlay .si-7ds-setting-label {
  font-size: 12px !important;
  font-weight: 800 !important;
  color: #f3df9c !important;
  text-transform: uppercase !important;
  letter-spacing: .5px !important;
}
#si-7ds-overlay .si-7ds-setting-value {
  font-size: 12px !important;
  color: #f8f0dd !important;
}
@media (max-width: 520px) {
  #si-7ds-launcher-btn {
    left: 0 !important;
    bottom: 0 !important;
    width: 166px !important;
    height: 28px !important;
    font-size: 11px !important;
    gap: 5px !important;
  }
  #si-7ds-overlay {
    left: 8px !important;
    right: 8px !important;
    top: 80px !important;
    bottom: 92px !important;
    max-width: none !important;
  }
  #si-7ds-overlay .si-7ds-tabrow {
    gap: 6px !important;
    padding: 10px 10px 0 !important;
  }
  #si-7ds-overlay .si-7ds-tab {
    min-height: 34px !important;
    font-size: 10px !important;
    padding: 0 4px !important;
  }
}
        `);

        var flag = document.createElement('div');
        flag.id = 'si-7ds-style-flag';
        flag.style.display = 'none';
        document.documentElement.appendChild(flag);
    }

    function setOpen(isOpen) {
        if (!overlay) return;
        var backdrop = document.getElementById('si-7ds-overlay-backdrop');
        overlay.classList.toggle('open', !!isOpen);
        if (backdrop) backdrop.classList.toggle('open', !!isOpen);
    }

    function toggleOverlay() {
        if (!overlay) return;
        setOpen(!overlay.classList.contains('open'));
    }

    function createLauncherBar() {
        if (launcherBar && document.body.contains(launcherBar)) return launcherBar;

        launcherBar = document.createElement('div');
        launcherBar.id = 'si-7ds-launcher';
        launcherBar.innerHTML = ''
            + '<button type="button" id="si-7ds-launcher-btn" aria-label="Open Sinners Insurance">'
            +   '<span class="si-7ds-icon">💊</span>'
            +   '<span>Sinners Insurance</span>'
            +   '<span class="si-7ds-icon">☠️</span>'
            + '</button>';

        document.body.appendChild(launcherBar);

        var btn = launcherBar.querySelector('#si-7ds-launcher-btn');
        if (btn) btn.addEventListener('click', toggleOverlay);
        return launcherBar;
    }

    function renderTabRow() {
        return '<div class="si-7ds-tabrow">'
            + Object.keys(TAB_LABELS).map(function (key) {
                return '<button type="button" class="si-7ds-tab' + (activeTab === key ? ' active' : '') + '" data-tab="' + key + '">' + TAB_LABELS[key] + '</button>';
            }).join('')
            + '</div>';
    }

    function renderTabContent() {
        if (activeTab === 'overview') {
            return ''
                + '<div class="si-7ds-card">'
                +   '<div class="si-7ds-card-title">Welcome to Sinners Insurance</div>'
                +   '<div class="si-7ds-text">Protect your members, track your coverage, and keep your payouts organized in one place. This overview tab is the main home screen for your insurance system and gives members a quick look at what is active and how to use it.</div>'
                + '</div>'
                + '<div class="si-7ds-card">'
                +   '<div class="si-7ds-card-title">What This Does</div>'
                +   '<div class="si-7ds-list">'
                +     '<div class="si-7ds-list-item"><div class="si-7ds-text">View your available insurance plans and what each one covers.</div></div>'
                +     '<div class="si-7ds-list-item"><div class="si-7ds-text">Submit and review claims from one themed overlay instead of jumping around.</div></div>'
                +     '<div class="si-7ds-list-item"><div class="si-7ds-text">Keep member coverage, payouts, and future admin settings together in one clean tool.</div></div>'
                +   '</div>'
                + '</div>'
                + '<div class="si-7ds-card">'
                +   '<div class="si-7ds-card-title">Quick Status</div>'
                +   '<div class="si-7ds-pillrow">'
                +     '<span class="si-7ds-pill">4 tabs active</span>'
                +     '<span class="si-7ds-pill">Launcher online</span>'
                +     '<span class="si-7ds-pill">7DS theme active</span>'
                +   '</div>'
                + '</div>'
                + '<div class="si-7ds-card">'
                +   '<div class="si-7ds-card-title">How to Use</div>'
                +   '<div class="si-7ds-text">Use <strong>Plans</strong> to view coverage options, <strong>Claims</strong> to handle claim flow, and <strong>Settings</strong> for future admin controls. This Overview tab is your quick start and home page.</div>'
                + '</div>';
        }

        if (activeTab === 'plans') {
            return ''
                + '<div class="si-7ds-card">'
                +   '<div class="si-7ds-card-title">Coverage Plans</div>'
                +   '<div class="si-7ds-text">Choose from three insurance tiers built for different member needs. These are your main plan display boxes and can be edited later with your real pricing and payout numbers.</div>'
                + '</div>'
                + '<div class="si-7ds-card">'
                +   '<div class="si-7ds-card-title">Basic Plan</div>'
                +   '<div class="si-7ds-pillrow">'
                +     '<span class="si-7ds-pill">Entry tier</span>'
                +     '<span class="si-7ds-pill">Low cost</span>'
                +   '</div>'
                +   '<div class="si-7ds-list" style="margin-top:10px;">'
                +     '<div class="si-7ds-list-item"><div class="si-7ds-text"><strong>Price:</strong> Set your starter fee here.</div></div>'
                +     '<div class="si-7ds-list-item"><div class="si-7ds-text"><strong>Payout:</strong> Set your basic payout amount here.</div></div>'
                +     '<div class="si-7ds-list-item"><div class="si-7ds-text"><strong>Rules:</strong> Best for light coverage with simple claim rules.</div></div>'
                +   '</div>'
                + '</div>'
                + '<div class="si-7ds-card">'
                +   '<div class="si-7ds-card-title">Standard Plan</div>'
                +   '<div class="si-7ds-pillrow">'
                +     '<span class="si-7ds-pill">Balanced tier</span>'
                +     '<span class="si-7ds-pill">Most used</span>'
                +   '</div>'
                +   '<div class="si-7ds-list" style="margin-top:10px;">'
                +     '<div class="si-7ds-list-item"><div class="si-7ds-text"><strong>Price:</strong> Set your mid-tier fee here.</div></div>'
                +     '<div class="si-7ds-list-item"><div class="si-7ds-text"><strong>Payout:</strong> Set your mid-tier payout amount here.</div></div>'
                +     '<div class="si-7ds-list-item"><div class="si-7ds-text"><strong>Rules:</strong> Good balance between cost, protection, and claim value.</div></div>'
                +   '</div>'
                + '</div>'
                + '<div class="si-7ds-card">'
                +   '<div class="si-7ds-card-title">Premium Plan</div>'
                +   '<div class="si-7ds-pillrow">'
                +     '<span class="si-7ds-pill">Top tier</span>'
                +     '<span class="si-7ds-pill">High payout</span>'
                +   '</div>'
                +   '<div class="si-7ds-list" style="margin-top:10px;">'
                +     '<div class="si-7ds-list-item"><div class="si-7ds-text"><strong>Price:</strong> Set your premium fee here.</div></div>'
                +     '<div class="si-7ds-list-item"><div class="si-7ds-text"><strong>Payout:</strong> Set your premium payout amount here.</div></div>'
                +     '<div class="si-7ds-list-item"><div class="si-7ds-text"><strong>Rules:</strong> Highest protection tier with stronger member benefits.</div></div>'
                +   '</div>'
                + '</div>';
        }

        if (activeTab === 'claims') {
            return ''
                + '<div class="si-7ds-card">'
                +   '<div class="si-7ds-card-title">Claims Center</div>'
                +   '<div class="si-7ds-text">Submit, review, and track insurance claims here. This tab is the main place for members to understand how claims move through the system and what details are needed for a payout.</div>'
                + '</div>'
                + '<div class="si-7ds-card">'
                +   '<div class="si-7ds-card-title">Claim Flow</div>'
                +   '<div class="si-7ds-pillrow">'
                +     '<span class="si-7ds-pill">Submit</span>'
                +     '<span class="si-7ds-pill">Review</span>'
                +     '<span class="si-7ds-pill">Approve</span>'
                +     '<span class="si-7ds-pill">Payout</span>'
                +   '</div>'
                + '</div>'
                + '<div class="si-7ds-card">'
                +   '<div class="si-7ds-card-title">Required Claim Details</div>'
                +   '<div class="si-7ds-list">'
                +     '<div class="si-7ds-list-item"><div class="si-7ds-text"><strong>Member:</strong> Name or ID of the insured member filing the claim.</div></div>'
                +     '<div class="si-7ds-list-item"><div class="si-7ds-text"><strong>Plan:</strong> Pride Sin, Wrath Sin, or Envy Sin.</div></div>'
                +     '<div class="si-7ds-list-item"><div class="si-7ds-text"><strong>Loss:</strong> What was lost and what stack or jump it affected.</div></div>'
                +     '<div class="si-7ds-list-item"><div class="si-7ds-text"><strong>Proof:</strong> Screenshots, logs, or notes to support the claim review.</div></div>'
                +   '</div>'
                + '</div>'
                + '<div class="si-7ds-card">'
                +   '<div class="si-7ds-card-title">Claim Status Board</div>'
                +   '<div class="si-7ds-pillrow">'
                +     '<span class="si-7ds-pill">Pending</span>'
                +     '<span class="si-7ds-pill">Under review</span>'
                +     '<span class="si-7ds-pill">Approved</span>'
                +     '<span class="si-7ds-pill">Denied</span>'
                +     '<span class="si-7ds-pill">Paid</span>'
                +   '</div>'
                + '</div>'
                + '<div class="si-7ds-card">'
                +   '<div class="si-7ds-card-title">Payout Notes</div>'
                +   '<div class="si-7ds-text">Use this area later for claim buttons, claim forms, payout logs, and admin review actions. Right now it acts as the structure box for the full claim system you will build next.</div>'
                + '</div>';
        }

        return ''
            + '<div class="si-7ds-card">'
            +   '<div class="si-7ds-card-title">Settings</div>'
            +   '<div class="si-7ds-setting-row"><div class="si-7ds-setting-label">Launcher</div><div class="si-7ds-setting-value">Bottom-left locked</div></div>'
            +   '<div class="si-7ds-setting-row"><div class="si-7ds-setting-label">Theme</div><div class="si-7ds-setting-value">7 Deadly Sins crimson/gold</div></div>'
            +   '<div class="si-7ds-setting-row"><div class="si-7ds-setting-label">Overlay</div><div class="si-7ds-setting-value">4-tab shell active</div></div>'
            + '</div>'
            + '<div class="si-7ds-card">'
            +   '<div class="si-7ds-card-title">Next Build Step</div>'
            +   '<div class="si-7ds-text">This tab is ready for toggles, admin settings, webhook settings, or API controls.</div>'
            + '</div>';
    }

    function bindOverlayEvents() {
        if (!overlay) return;

        var closeBtn = overlay.querySelector('.si-7ds-close');
        if (closeBtn && !closeBtn.dataset.bound) {
            closeBtn.dataset.bound = '1';
            closeBtn.addEventListener('click', function () { setOpen(false); });
        }

        overlay.querySelectorAll('.si-7ds-tab').forEach(function (btn) {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', function () {
                activeTab = btn.getAttribute('data-tab') || 'overview';
                renderOverlay();
            });
        });
    }

    function renderOverlay() {
        if (!overlay) return;
        overlay.innerHTML = ''
            + '<div class="si-7ds-head">'
            +   '<div class="si-7ds-titlewrap">'
            +     '<div class="si-7ds-title">Sinners Insurance 💊</div>'
            +     '<div class="si-7ds-sub">7 Deadly Sins Theme</div>'
            +   '</div>'
            +   '<button type="button" class="si-7ds-close" aria-label="Close">×</button>'
            + '</div>'
            + renderTabRow()
            + '<div class="si-7ds-body">'
            +   renderTabContent()
            + '</div>';

        bindOverlayEvents();
    }

    function createOverlay() {
        if (overlay && document.body.contains(overlay)) return overlay;

        var backdrop = document.getElementById('si-7ds-overlay-backdrop');
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.id = 'si-7ds-overlay-backdrop';
            backdrop.addEventListener('click', function () { setOpen(false); });
            document.body.appendChild(backdrop);
        }

        overlay = document.createElement('div');
        overlay.id = 'si-7ds-overlay';
        renderOverlay();
        document.body.appendChild(overlay);
        return overlay;
    }

    function mount() {
        if (!document.body) return;
        addStyles();
        createLauncherBar();
        createOverlay();
    }

    function ensureMounted() {
        if (!document.body) return;
        if (!document.getElementById('si-7ds-launcher')) launcherBar = null;
        if (!document.getElementById('si-7ds-overlay')) overlay = null;
        if (!launcherBar || !overlay) mount();
    }

    function startRemountWatch() {
        if (remountTimer) clearInterval(remountTimer);
        remountTimer = setInterval(ensureMounted, 1000);
    }

    function boot() {
        mount();
        startRemountWatch();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();
