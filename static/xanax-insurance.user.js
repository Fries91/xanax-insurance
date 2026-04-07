// ==UserScript==
// @name         Sinner's Insurance Minimal Header
// @namespace    fries91-xanax-insurance
// @version      1.0.0
// @description  Minimal Torn header bar with one centered Sinner's Insurance button and simple overlay
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @run-at       document-idle
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';

    var headerBar = null;
    var overlay = null;
    var remountTimer = null;

    function addStyles() {
        if (document.getElementById('si-minimal-style')) return;
        GM_addStyle(`
#si-minimal-headerbar {
  position: fixed !important;
  left: 0 !important;
  right: 0 !important;
  top: 150px !important;
  z-index: 2147483647 !important;
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
  padding: 8px 10px !important;
  box-sizing: border-box !important;
  pointer-events: none !important;
}
#si-minimal-headerbtn {
  pointer-events: auto !important;
  appearance: none !important;
  -webkit-appearance: none !important;
  border: 1px solid rgba(255,255,255,.18) !important;
  border-radius: 12px !important;
  min-height: 42px !important;
  width: min(720px, calc(100% - 16px)) !important;
  padding: 10px 16px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 8px !important;
  font-size: 16px !important;
  font-weight: 800 !important;
  color: #fff !important;
  background: linear-gradient(180deg, rgba(39,140,164,.98), rgba(18,87,106,.98)) !important;
  box-shadow: 0 8px 24px rgba(0,0,0,.34) !important;
  cursor: pointer !important;
}
#si-minimal-headerbtn:active {
  transform: translateY(1px) !important;
}
#si-minimal-overlay {
  position: fixed !important;
  left: 10px !important;
  right: 10px !important;
  top: 204px !important;
  bottom: 10px !important;
  margin: 0 auto !important;
  width: auto !important;
  max-width: 540px !important;
  z-index: 2147483646 !important;
  display: none !important;
  flex-direction: column !important;
  border-radius: 14px !important;
  overflow: hidden !important;
  background: linear-gradient(180deg, #171717, #0c0c0c) !important;
  color: #f3f3f3 !important;
  border: 1px solid rgba(255,255,255,.10) !important;
  box-shadow: 0 18px 38px rgba(0,0,0,.52) !important;
}
#si-minimal-overlay.open {
  display: flex !important;
}
#si-minimal-overlay .si-head {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 12px !important;
  padding: 14px 16px !important;
  border-bottom: 1px solid rgba(255,255,255,.08) !important;
  background: rgba(255,255,255,.03) !important;
}
#si-minimal-overlay .si-title {
  font-size: 16px !important;
  font-weight: 800 !important;
}
#si-minimal-overlay .si-close {
  appearance: none !important;
  -webkit-appearance: none !important;
  border: 1px solid rgba(255,255,255,.14) !important;
  border-radius: 10px !important;
  min-width: 42px !important;
  height: 36px !important;
  background: rgba(255,255,255,.06) !important;
  color: #fff !important;
  font-size: 18px !important;
  cursor: pointer !important;
}
#si-minimal-overlay .si-body {
  padding: 16px !important;
  overflow: auto !important;
  font-size: 14px !important;
  line-height: 1.45 !important;
}
#si-minimal-backdrop {
  position: fixed !important;
  inset: 0 !important;
  z-index: 2147483645 !important;
  display: none !important;
  background: rgba(0,0,0,.42) !important;
}
#si-minimal-backdrop.open {
  display: block !important;
}
@media (max-width: 520px) {
  #si-minimal-headerbar {
    top: 146px !important;
    padding: 7px 8px !important;
  }
  #si-minimal-headerbtn {
    width: calc(100% - 8px) !important;
    min-height: 44px !important;
    font-size: 15px !important;
  }
  #si-minimal-overlay {
    left: 8px !important;
    right: 8px !important;
    top: 198px !important;
    bottom: 8px !important;
    max-width: none !important;
  }
}
        `);
        var styleTag = document.createElement('div');
        styleTag.id = 'si-minimal-style';
        styleTag.style.display = 'none';
        document.documentElement.appendChild(styleTag);
    }

    function setOpen(isOpen) {
        if (!overlay) return;
        var backdrop = document.getElementById('si-minimal-backdrop');
        overlay.classList.toggle('open', !!isOpen);
        if (backdrop) backdrop.classList.toggle('open', !!isOpen);
    }

    function toggleOverlay() {
        if (!overlay) return;
        setOpen(!overlay.classList.contains('open'));
    }

    function createHeaderBar() {
        if (headerBar && document.body.contains(headerBar)) return headerBar;

        headerBar = document.createElement('div');
        headerBar.id = 'si-minimal-headerbar';
        headerBar.innerHTML = '<button type="button" id="si-minimal-headerbtn"><span>📝</span><span>Sinners Insurance 💊</span></button>';
        document.body.appendChild(headerBar);

        var btn = headerBar.querySelector('#si-minimal-headerbtn');
        if (btn) btn.addEventListener('click', toggleOverlay);
        return headerBar;
    }

    function createOverlay() {
        if (overlay && document.body.contains(overlay)) return overlay;

        var backdrop = document.getElementById('si-minimal-backdrop');
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.id = 'si-minimal-backdrop';
            backdrop.addEventListener('click', function () { setOpen(false); });
            document.body.appendChild(backdrop);
        }

        overlay = document.createElement('div');
        overlay.id = 'si-minimal-overlay';
        overlay.innerHTML = ''
            + '<div class="si-head">'
            +   '<div class="si-title">Sinners Insurance 💊</div>'
            +   '<button type="button" class="si-close" aria-label="Close">×</button>'
            + '</div>'
            + '<div class="si-body">'
            +   '<p>This is the starter overlay.</p>'
            +   '<p>Right now it only opens and closes from the header button.</p>'
            +   '<p>No tabs. No extra launcher. No floating icon.</p>'
            + '</div>';
        document.body.appendChild(overlay);

        var closeBtn = overlay.querySelector('.si-close');
        if (closeBtn) closeBtn.addEventListener('click', function () { setOpen(false); });

        return overlay;
    }

    function mount() {
        if (!document.body) return;
        addStyles();
        createHeaderBar();
        createOverlay();
    }

    function ensureMounted() {
        if (!document.body) return;
        if (!document.getElementById('si-minimal-headerbar')) headerBar = null;
        if (!document.getElementById('si-minimal-overlay')) overlay = null;
        if (!headerBar || !overlay) mount();
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
