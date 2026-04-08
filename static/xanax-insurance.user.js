// ==UserScript==
// @name         Sinner's Insurance 7DS Tabs
// @namespace    fries91-xanax-insurance
// @version      2.3.7
// @description  Sinner's Insurance bottom-left launcher with 4-tab 7 Deadly Sins themed overlay
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @run-at       document-idle
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
    'use strict';

    var launcherBar = null;
    var overlay = null;
    var remountTimer = null;
    var activeTab = 'overview';
    var selectedPlan = (typeof GM_getValue === 'function' ? GM_getValue('si_selected_plan', 'None') : 'None');
    var sessionRole = (typeof GM_getValue === 'function' ? GM_getValue('si_session_role', 'guest') : 'guest');
    var sessionName = (typeof GM_getValue === 'function' ? GM_getValue('si_session_name', 'Guest') : 'Guest');
    var claimStatus = (typeof GM_getValue === 'function' ? GM_getValue('si_claim_status', 'Not submitted') : 'Not submitted');
    var claimNote = (typeof GM_getValue === 'function' ? GM_getValue('si_claim_note', '') : '');
    var claimLoss = (typeof GM_getValue === 'function' ? GM_getValue('si_claim_loss', '') : '');
    var claimProof = (typeof GM_getValue === 'function' ? GM_getValue('si_claim_proof', '') : '');
    var claimStack = (typeof GM_getValue === 'function' ? GM_getValue('si_claim_stack', '') : '');
    var claimHistory = (typeof GM_getValue === 'function' ? GM_getValue('si_claim_history', '[]') : '[]');
    var claimId = (typeof GM_getValue === 'function' ? GM_getValue('si_claim_id', '') : '');
    var payoutAmount = (typeof GM_getValue === 'function' ? GM_getValue('si_payout_amount', '') : '');
    var decisionNote = (typeof GM_getValue === 'function' ? GM_getValue('si_decision_note', '') : '');
    var claimsDb = (typeof GM_getValue === 'function' ? GM_getValue('si_claims_db', '[]') : '[]');
    var selectedClaimId = (typeof GM_getValue === 'function' ? GM_getValue('si_selected_claim_id', '') : '');

    var TAB_LABELS = {
        overview: 'Overview',
        plans: 'Plans',
        claims: 'Claims',
        settings: 'Settings'
    };

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function saveSession() {
        if (typeof GM_setValue === 'function') {
            GM_setValue('si_selected_plan', selectedPlan || 'None');
            GM_setValue('si_session_role', sessionRole || 'guest');
            GM_setValue('si_session_name', sessionName || 'Guest');
            GM_setValue('si_claim_status', claimStatus || 'Not submitted');
            GM_setValue('si_claim_note', claimNote || '');
            GM_setValue('si_claim_loss', claimLoss || '');
            GM_setValue('si_claim_proof', claimProof || '');
            GM_setValue('si_claim_stack', claimStack || '');
            GM_setValue('si_claim_history', claimHistory || '[]');
            GM_setValue('si_claim_id', claimId || '');
            GM_setValue('si_payout_amount', payoutAmount || '');
            GM_setValue('si_decision_note', decisionNote || '');
            GM_setValue('si_claims_db', claimsDb || '[]');
            GM_setValue('si_selected_claim_id', selectedClaimId || '');
        }
    }

    function isAdmin() {
        return sessionRole === 'admin';
    }

    function isMember() {
        return sessionRole === 'member' || sessionRole === 'admin';
    }

    function loginAs(role) {
        var promptLabel = role === 'admin' ? 'Enter admin name' : 'Enter member name';
        var name = window.prompt(promptLabel, sessionName && sessionName !== 'Guest' ? sessionName : '');
        if (!name) return;

        var passLabel = role === 'admin' ? 'Enter admin passcode' : 'Enter member passcode';
        var pass = window.prompt(passLabel, '');
        if (pass === null) return;

        if (role === 'admin') {
            if (pass !== 'wrathadmin') {
                window.alert('Admin login failed.');
                return;
            }
        } else {
            if (pass !== 'sinsmember') {
                window.alert('Member login failed.');
                return;
            }
        }

        sessionRole = role;
        sessionName = String(name).trim() || (role === 'admin' ? 'Admin' : 'Member');
        saveSession();
        renderOverlay();
    }

    function logoutSession() {
        sessionRole = 'guest';
        sessionName = 'Guest';
        saveSession();
        renderOverlay();
    }

    function submitClaim() {
        if (!isMember()) {
            window.alert('Member login required before submitting a claim.');
            return;
        }
        if (!selectedPlan || selectedPlan === 'None') {
            window.alert('Select a plan first before submitting a claim.');
            return;
        }
        if (!claimNote.trim() || !claimLoss.trim() || !claimProof.trim() || !claimStack.trim()) {
            window.alert('Fill in all claim fields before submitting.');
            return;
        }
        if (!claimId) claimId = makeClaimId();
        selectedClaimId = claimId;
        claimStatus = 'Pending review';
        upsertCurrentClaimRecord();
        addClaimHistoryEntry((sessionName || 'Member') + ' submitted claim ' + claimId + ' for ' + (selectedPlan || 'No plan') + '.');
        saveSession();
        activeTab = 'claims';
        renderOverlay();
    }

    function getClaimsDbItems() {
        try {
            var arr = JSON.parse(claimsDb || '[]');
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            return [];
        }
    }

    function saveClaimsDbItems(arr) {
        claimsDb = JSON.stringify(Array.isArray(arr) ? arr : []);
        saveSession();
    }

    function getSelectedClaimRecord() {
        var items = getClaimsDbItems();
        var found = items.find(function (item) { return item && item.id === selectedClaimId; });
        if (found) return found;
        if (items.length) {
            selectedClaimId = items[0].id || '';
            saveSession();
            return items[0];
        }
        return null;
    }

    function syncCurrentFromSelectedClaim() {
        var rec = getSelectedClaimRecord();
        if (!rec) return;
        claimId = rec.id || '';
        selectedClaimId = rec.id || '';
        selectedPlan = rec.plan || selectedPlan || 'None';
        claimStatus = rec.status || 'Not submitted';
        claimNote = rec.note || '';
        claimLoss = rec.loss || '';
        claimProof = rec.proof || '';
        claimStack = rec.stack || '';
        payoutAmount = rec.payout || '';
        decisionNote = rec.decision || '';
    }

    function upsertCurrentClaimRecord() {
        if (!claimId) return;
        var items = getClaimsDbItems();
        var idx = items.findIndex(function (item) { return item && item.id === claimId; });
        var rec = {
            id: claimId,
            plan: selectedPlan || 'None',
            status: claimStatus || 'Not submitted',
            note: claimNote || '',
            loss: claimLoss || '',
            proof: claimProof || '',
            stack: claimStack || '',
            payout: payoutAmount || '',
            decision: decisionNote || '',
            member: sessionName || 'Guest',
            updatedAt: new Date().toLocaleString()
        };
        if (idx >= 0) items[idx] = rec;
        else items.unshift(rec);
        selectedClaimId = claimId;
        saveClaimsDbItems(items.slice(0, 25));
    }

    function selectClaimById(id) {
        selectedClaimId = id || '';
        syncCurrentFromSelectedClaim();
        saveSession();
        renderOverlay();
    }

    function makeClaimId() {
        return 'SIN-' + Date.now().toString().slice(-8);
    }

    function getClaimHistoryItems() {
        try {
            var arr = JSON.parse(claimHistory || '[]');
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            return [];
        }
    }

    function addClaimHistoryEntry(text) {
        var arr = getClaimHistoryItems();
        arr.unshift({
            at: new Date().toLocaleString(),
            text: text
        });
        claimHistory = JSON.stringify(arr.slice(0, 12));
        saveSession();
    }

    function updateClaimField(field, value) {
        if (field === 'note') claimNote = value || '';
        if (field === 'loss') claimLoss = value || '';
        if (field === 'proof') claimProof = value || '';
        if (field === 'stack') claimStack = value || '';
        if (field === 'payout') payoutAmount = value || '';
        if (field === 'decision') decisionNote = value || '';
        upsertCurrentClaimRecord();
        saveSession();
    }

    function clearClaimHistory() {
        if (!isAdmin()) {
            window.alert('Admin login required.');
            return;
        }
        claimHistory = '[]';
        saveSession();
        renderOverlay();
    }

    function adminSetClaimStatus(nextStatus) {
        if (!isAdmin()) {
            window.alert('Admin login required.');
            return;
        }
        claimStatus = nextStatus;
        upsertCurrentClaimRecord();
        addClaimHistoryEntry((sessionName || 'Admin') + ' changed claim ' + (claimId || 'unassigned') + ' status to ' + nextStatus + (decisionNote ? ' | Note: ' + decisionNote : '') + (payoutAmount ? ' | Payout: ' + payoutAmount : '') + '.');
        saveSession();
        activeTab = 'claims';
        renderOverlay();
    }

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
#si-7ds-overlay .si-7ds-plan-box {
  border-radius: 14px !important;
  border: 1px solid rgba(201, 162, 80, .20) !important;
  background: linear-gradient(180deg, rgba(95, 14, 20, .22), rgba(255,255,255,.02)) !important;
  box-shadow: 0 10px 22px rgba(0,0,0,.20) !important;
  padding: 12px !important;
  display: grid !important;
  gap: 10px !important;
}
#si-7ds-overlay .si-7ds-plan-top {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 10px !important;
}
#si-7ds-overlay .si-7ds-plan-name {
  font-size: 14px !important;
  font-weight: 900 !important;
  color: #f2de9f !important;
  text-transform: uppercase !important;
  letter-spacing: .7px !important;
}
#si-7ds-overlay .si-7ds-plan-tier {
  font-size: 10px !important;
  font-weight: 900 !important;
  color: rgba(241, 223, 171, .78) !important;
  text-transform: uppercase !important;
  letter-spacing: .8px !important;
}
#si-7ds-overlay .si-7ds-plan-grid {
  display: grid !important;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  gap: 8px !important;
}
#si-7ds-overlay .si-7ds-plan-stat {
  border-radius: 10px !important;
  border: 1px solid rgba(201,162,80,.12) !important;
  background: rgba(255,255,255,.02) !important;
  padding: 8px 9px !important;
}
#si-7ds-overlay .si-7ds-plan-stat-label {
  font-size: 10px !important;
  font-weight: 800 !important;
  color: rgba(241,223,171,.72) !important;
  text-transform: uppercase !important;
  letter-spacing: .75px !important;
  margin-bottom: 4px !important;
}
#si-7ds-overlay .si-7ds-plan-stat-value {
  font-size: 12px !important;
  font-weight: 800 !important;
  color: #f8f0dd !important;
}
#si-7ds-overlay .si-7ds-plan-actions {
  display: flex !important;
  flex-wrap: wrap !important;
  gap: 8px !important;
}
#si-7ds-overlay .si-7ds-btn {
  appearance: none !important;
  -webkit-appearance: none !important;
  min-height: 34px !important;
  padding: 0 12px !important;
  border-radius: 10px !important;
  border: 1px solid rgba(201,162,80,.24) !important;
  background: linear-gradient(180deg, rgba(124, 19, 26, .95), rgba(64, 10, 15, .98)) !important;
  color: #f7e4a7 !important;
  font-size: 11px !important;
  font-weight: 900 !important;
  text-transform: uppercase !important;
  letter-spacing: .55px !important;
  cursor: pointer !important;
}
#si-7ds-overlay .si-7ds-btn.alt {
  background: linear-gradient(180deg, rgba(60, 12, 16, .92), rgba(24, 7, 10, .96)) !important;
}
#si-7ds-overlay .si-7ds-auth-box {
  border-radius: 14px !important;
  border: 1px solid rgba(201,162,80,.18) !important;
  background: linear-gradient(180deg, rgba(102, 15, 22, .22), rgba(255,255,255,.02)) !important;
  padding: 12px !important;
  display: grid !important;
  gap: 10px !important;
}
#si-7ds-overlay .si-7ds-auth-title {
  font-size: 13px !important;
  font-weight: 900 !important;
  color: #f2de9f !important;
  text-transform: uppercase !important;
  letter-spacing: .8px !important;
}
#si-7ds-overlay .si-7ds-auth-actions {
  display: flex !important;
  flex-wrap: wrap !important;
  gap: 8px !important;
}
#si-7ds-overlay .si-7ds-role-badge {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  min-height: 28px !important;
  padding: 0 10px !important;
  border-radius: 999px !important;
  border: 1px solid rgba(201,162,80,.18) !important;
  background: rgba(119, 17, 22, .22) !important;
  color: #f1dfab !important;
  font-size: 11px !important;
  font-weight: 900 !important;
  letter-spacing: .55px !important;
  text-transform: uppercase !important;
}
#si-7ds-overlay .si-7ds-select {
  width: 100% !important;
  box-sizing: border-box !important;
  border-radius: 10px !important;
  border: 1px solid rgba(201,162,80,.18) !important;
  background: rgba(255,255,255,.04) !important;
  color: #f8f0dd !important;
  padding: 10px !important;
  font-size: 13px !important;
  outline: none !important;
}
#si-7ds-overlay .si-7ds-select option {
  background: #1b0d10 !important;
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
                +   '<div class="si-7ds-card-title">Sin Plans</div>'
                +   '<div class="si-7ds-text">Choose a sin plan and save it to your member profile before submitting a claim.</div>'
                + '</div>'
                + '<div class="si-7ds-auth-box">'
                +   '<div class="si-7ds-auth-title">Selected Plan</div>'
                +   '<div class="si-7ds-text">Current plan: <strong>' + selectedPlan + '</strong></div>'
                + '</div>'
                + '<div class="si-7ds-plan-box">'
                +   '<div class="si-7ds-plan-top"><div><div class="si-7ds-plan-name">Pride Sin</div><div class="si-7ds-plan-tier">Basic coverage</div></div><span class="si-7ds-pill">1 Xanax</span></div>'
                +   '<div class="si-7ds-plan-grid">'
                +     '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Coverage</div><div class="si-7ds-plan-stat-value">Single Xanax</div></div>'
                +     '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Tier</div><div class="si-7ds-plan-stat-value">Basic</div></div>'
                +     '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Best For</div><div class="si-7ds-plan-stat-value">Light use</div></div>'
                +     '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Claim Scope</div><div class="si-7ds-plan-stat-value">1 use only</div></div>'
                +   '</div>'
                +   '<div class="si-7ds-plan-actions"><button type="button" class="si-7ds-btn" data-action="select-plan" data-plan="Pride Sin">Select Pride</button></div>'
                + '</div>'
                + '<div class="si-7ds-plan-box">'
                +   '<div class="si-7ds-plan-top"><div><div class="si-7ds-plan-name">Wrath Sin</div><div class="si-7ds-plan-tier">Standard coverage</div></div><span class="si-7ds-pill">1st to 4th stack</span></div>'
                +   '<div class="si-7ds-plan-grid">'
                +     '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Coverage</div><div class="si-7ds-plan-stat-value">1st-4th Xanax</div></div>'
                +     '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Tier</div><div class="si-7ds-plan-stat-value">Standard</div></div>'
                +     '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Best For</div><div class="si-7ds-plan-stat-value">Stacking</div></div>'
                +     '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Claim Scope</div><div class="si-7ds-plan-stat-value">4 uses</div></div>'
                +   '</div>'
                +   '<div class="si-7ds-plan-actions"><button type="button" class="si-7ds-btn" data-action="select-plan" data-plan="Wrath Sin">Select Wrath</button></div>'
                + '</div>'
                + '<div class="si-7ds-plan-box">'
                +   '<div class="si-7ds-plan-top"><div><div class="si-7ds-plan-name">Envy Sin</div><div class="si-7ds-plan-tier">Premium coverage</div></div><span class="si-7ds-pill">Full happy jump</span></div>'
                +   '<div class="si-7ds-plan-grid">'
                +     '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Coverage</div><div class="si-7ds-plan-stat-value">Full jump</div></div>'
                +     '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Tier</div><div class="si-7ds-plan-stat-value">Premium</div></div>'
                +     '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Best For</div><div class="si-7ds-plan-stat-value">Max setup</div></div>'
                +     '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Claim Scope</div><div class="si-7ds-plan-stat-value">Full stack</div></div>'
                +   '</div>'
                +   '<div class="si-7ds-plan-actions"><button type="button" class="si-7ds-btn" data-action="select-plan" data-plan="Envy Sin">Select Envy</button></div>'
                + '</div>';
        }

        if (activeTab === 'claims') {
            syncCurrentFromSelectedClaim();
            var claimOptions = getClaimsDbItems().length
                ? getClaimsDbItems().map(function (item) {
                    var label = (item.id || 'No ID') + ' | ' + (item.plan || 'No plan') + ' | ' + (item.status || 'No status');
                    var sel = (item.id === selectedClaimId || (!selectedClaimId && item.id === claimId)) ? ' selected' : '';
                    return '<option value="' + esc(item.id || '') + '"' + sel + '>' + esc(label) + '</option>';
                }).join('')
                : '<option value="">No claims yet</option>';

            var memberForm = isMember() && !isAdmin()
                ? '<div class="si-7ds-form-grid">'
                    + '<div class="si-7ds-field">'
                      + '<label class="si-7ds-label" for="si-claim-stack">Stack Type</label>'
                      + '<input id="si-claim-stack" class="si-7ds-input" type="text" placeholder="Example: 2nd Xanax stack or full happy jump" value="' + esc(claimStack) + '">'
                    + '</div>'
                    + '<div class="si-7ds-field">'
                      + '<label class="si-7ds-label" for="si-claim-loss">Loss Details</label>'
                      + '<input id="si-claim-loss" class="si-7ds-input" type="text" placeholder="What was lost?" value="' + esc(claimLoss) + '">'
                    + '</div>'
                    + '<div class="si-7ds-field">'
                      + '<label class="si-7ds-label" for="si-claim-proof">Proof / Screenshot Note</label>'
                      + '<input id="si-claim-proof" class="si-7ds-input" type="text" placeholder="Proof link or screenshot note" value="' + esc(claimProof) + '">'
                    + '</div>'
                    + '<div class="si-7ds-field">'
                      + '<label class="si-7ds-label" for="si-claim-note">Claim Note</label>'
                      + '<textarea id="si-claim-note" class="si-7ds-textarea" placeholder="Add your claim details here">' + esc(claimNote) + '</textarea>'
                    + '</div>'
                  + '</div>'
                : '<div class="si-7ds-note-box"><div class="si-7ds-text">'
                    + (isAdmin()
                        ? '<strong>Admin review mode:</strong> member claim fields are read-only below.'
                        : '<strong>Member login required:</strong> sign in as a member to edit claim fields.')
                  + '</div></div>';

            var memberActions = isMember() && !isAdmin()
                ? '<button type="button" class="si-7ds-btn" data-action="submit-claim">Submit Claim</button>'
                : '';

            var adminPanel = isAdmin()
                ? '<div class="si-7ds-card">'
                    + '<div class="si-7ds-card-title">Admin Review Panel</div>'
                    + '<div class="si-7ds-admin-panel">'
                      + '<div class="si-7ds-field">'
                        + '<label class="si-7ds-label" for="si-payout-amount">Payout Amount</label>'
                        + '<input id="si-payout-amount" class="si-7ds-input" type="text" placeholder="Example: $5,000,000" value="' + esc(payoutAmount) + '">'
                      + '</div>'
                      + '<div class="si-7ds-field">'
                        + '<label class="si-7ds-label" for="si-decision-note">Decision Note</label>'
                        + '<textarea id="si-decision-note" class="si-7ds-textarea" placeholder="Admin decision notes">' + esc(decisionNote) + '</textarea>'
                      + '</div>'
                      + '<div class="si-7ds-plan-actions">'
                        + '<button type="button" class="si-7ds-btn alt" data-action="review-claim">Mark Review</button>'
                        + '<button type="button" class="si-7ds-btn alt" data-action="approve-claim">Approve</button>'
                        + '<button type="button" class="si-7ds-btn alt" data-action="deny-claim">Deny</button>'
                        + '<button type="button" class="si-7ds-btn alt" data-action="pay-claim">Mark Paid</button>'
                      + '</div>'
                    + '</div>'
                  + '</div>'
                : '';

            var historyItems = getClaimHistoryItems().length
                ? getClaimHistoryItems().map(function (item) {
                    return '<div class="si-7ds-history-item">'
                        + '<div class="si-7ds-history-time">' + esc(item.at || '') + '</div>'
                        + '<div class="si-7ds-history-text">' + esc(item.text || '') + '</div>'
                    + '</div>';
                }).join('')
                : '<div class="si-7ds-list-item"><div class="si-7ds-text">No history yet.</div></div>';

            return ''
                + '<div class="si-7ds-card">'
                +   '<div class="si-7ds-card-title">Claims Center</div>'
                +   '<div class="si-7ds-text">Members can fill in the claim form directly here. Admins get a read-only review view with status controls, payout amount, and decision notes.</div>'
                + '</div>'
                + '<div class="si-7ds-card">'
                +   '<div class="si-7ds-card-title">Claim Dropdown</div>'
                +   '<div class="si-7ds-field">'
                +     '<label class="si-7ds-label" for="si-claim-select">Select Claim</label>'
                +     '<select id="si-claim-select" class="si-7ds-select">' + claimOptions + '</select>'
                +   '</div>'
                + '</div>'
                + '<div class="si-7ds-card">'
                +   '<div class="si-7ds-card-title">Access State</div>'
                +   '<div class="si-7ds-text">Signed in as: <strong>' + sessionName + '</strong> (' + sessionRole + ')</div>'
                + '</div>'
                + '<div class="si-7ds-card">'
                +   '<div class="si-7ds-card-title">Claim Summary</div>'
                +   '<div class="si-7ds-text"><strong>Claim ID:</strong> ' + esc(claimId || 'Not assigned yet') + '</div>'
                +   '<div class="si-7ds-text"><strong>Selected plan:</strong> ' + esc(selectedPlan || 'None') + '</div>'
                +   '<div class="si-7ds-text"><strong>Status:</strong> ' + esc(claimStatus || 'Not submitted') + '</div>'
                + '</div>'
                + '<div class="si-7ds-claim-box">'
                +   '<div class="si-7ds-claim-status">Claim Status: ' + claimStatus + '</div>'
                +   memberForm
                +   '<div class="si-7ds-plan-actions">' + memberActions + '</div>'
                + '</div>'
                + '<div class="si-7ds-card">'
                +   '<div class="si-7ds-card-title">Saved Claim Details</div>'
                +   '<div class="si-7ds-list">'
                +     '<div class="si-7ds-list-item"><div class="si-7ds-text"><strong>Stack:</strong> ' + esc(claimStack || 'Not set') + '</div></div>'
                +     '<div class="si-7ds-list-item"><div class="si-7ds-text"><strong>Loss:</strong> ' + esc(claimLoss || 'Not set') + '</div></div>'
                +     '<div class="si-7ds-list-item"><div class="si-7ds-text"><strong>Proof:</strong> ' + esc(claimProof || 'Not set') + '</div></div>'
                +     '<div class="si-7ds-list-item"><div class="si-7ds-text"><strong>Note:</strong> ' + esc(claimNote || 'Not set') + '</div></div>'
                +   '</div>'
                + '</div>'
                + adminPanel
                + '<div class="si-7ds-card">'
                +   '<div class="si-7ds-card-title">Claim History / Payout Log</div>'
                +   '<div class="si-7ds-list">' + historyItems + '</div>'
                +   '<div class="si-7ds-plan-actions">'
                +     (isAdmin() ? '<button type="button" class="si-7ds-btn alt" data-action="clear-history">Clear Log</button>' : '')
                +   '</div>'
                + '</div>'
                + '<div class="si-7ds-card">'
                +   '<div class="si-7ds-card-title">Role Rules</div>'
                +   '<div class="si-7ds-list">'
                +     '<div class="si-7ds-list-item"><div class="si-7ds-text"><strong>Members:</strong> Can edit fields and submit claims after logging in and choosing a plan.</div></div>'
                +     '<div class="si-7ds-list-item"><div class="si-7ds-text"><strong>Admins:</strong> Can review saved details, add payout amounts, write decision notes, and move claims into review, approve, deny, or mark paid.</div></div>'
                +     '<div class="si-7ds-list-item"><div class="si-7ds-text"><strong>Guests:</strong> Can view saved details but cannot edit or submit.</div></div>'
                +   '</div>'
                + '</div>';
        }

        return ''
            + '<div class="si-7ds-card">'
            +   '<div class="si-7ds-card-title">Settings Center</div>'
            +   '<div class="si-7ds-text">This tab is the control room for launcher settings, account access, and admin/member login state.</div>'
            + '</div>'
            + '<div class="si-7ds-auth-box">'
            +   '<div class="si-7ds-auth-title">Access Login</div>'
            +   '<div class="si-7ds-text">Current user: <strong>' + sessionName + '</strong></div>'
            +   '<div class="si-7ds-pillrow">'
            +     '<span class="si-7ds-role-badge">Role: ' + sessionRole + '</span>'
            +     '<span class="si-7ds-role-badge">Plan: ' + selectedPlan + '</span>'
            +   '</div>'
            +   '<div class="si-7ds-auth-actions">'
            +     '<button type="button" class="si-7ds-btn" data-action="login-member">Member Login</button>'
            +     '<button type="button" class="si-7ds-btn alt" data-action="login-admin">Admin Login</button>'
            +     '<button type="button" class="si-7ds-btn alt" data-action="logout-session">Logout</button>'
            +   '</div>'
            + '</div>'
            + '<div class="si-7ds-card">'
            +   '<div class="si-7ds-card-title">Current Setup</div>'
            +   '<div class="si-7ds-setting-row"><div class="si-7ds-setting-label">Launcher</div><div class="si-7ds-setting-value">Bottom-left locked</div></div>'
            +   '<div class="si-7ds-setting-row"><div class="si-7ds-setting-label">Theme</div><div class="si-7ds-setting-value">7 Deadly Sins crimson/gold</div></div>'
            +   '<div class="si-7ds-setting-row"><div class="si-7ds-setting-label">Overlay</div><div class="si-7ds-setting-value">4 tabs active</div></div>'
            +   '<div class="si-7ds-setting-row"><div class="si-7ds-setting-label">Plans</div><div class="si-7ds-setting-value">Pride / Wrath / Envy</div></div>'
            + '</div>'
            + '<div class="si-7ds-card">'
            +   '<div class="si-7ds-card-title">Passcodes In This Build</div>'
            +   '<div class="si-7ds-text"><strong>Member passcode:</strong> sinsmember</div>'
            +   '<div class="si-7ds-text"><strong>Admin passcode:</strong> wrathadmin</div>'
            + '</div>'
            + '<div class="si-7ds-card">'
            +   '<div class="si-7ds-card-title">Builder Notes</div>'
            +   '<div class="si-7ds-text">Login state, selected plan, and claims save between page loads.</div>'
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

        overlay.querySelectorAll('[data-action="select-plan"]').forEach(function (btn) {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', function () {
                selectedPlan = btn.getAttribute('data-plan') || 'None';
                saveSession();
                renderOverlay();
            });
        });

        overlay.querySelectorAll('[data-action="login-member"]').forEach(function (btn) {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', function () { loginAs('member'); });
        });

        overlay.querySelectorAll('[data-action="login-admin"]').forEach(function (btn) {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', function () { loginAs('admin'); });
        });

        overlay.querySelectorAll('[data-action="logout-session"]').forEach(function (btn) {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', function () { logoutSession(); });
        });

        overlay.querySelectorAll('[data-action="submit-claim"]').forEach(function (btn) {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', function () { submitClaim(); });
        });

        overlay.querySelectorAll('[data-action="review-claim"]').forEach(function (btn) {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', function () { adminSetClaimStatus('Under review'); });
        });

        overlay.querySelectorAll('[data-action="approve-claim"]').forEach(function (btn) {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', function () { adminSetClaimStatus('Approved'); });
        });

        overlay.querySelectorAll('[data-action="deny-claim"]').forEach(function (btn) {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', function () { adminSetClaimStatus('Denied'); });
        });

        overlay.querySelectorAll('[data-action="pay-claim"]').forEach(function (btn) {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', function () { adminSetClaimStatus('Paid'); });
        });

        [['si-claim-stack','stack'],['si-claim-loss','loss'],['si-claim-proof','proof'],['si-claim-note','note'],['si-payout-amount','payout'],['si-decision-note','decision']].forEach(function (pair) {
            var el = overlay.querySelector('#' + pair[0]);
            if (!el || el.dataset.bound) return;
            el.dataset.bound = '1';
            el.addEventListener('input', function () { updateClaimField(pair[1], el.value); });
        });

        overlay.querySelectorAll('[data-action="clear-history"]').forEach(function (btn) {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', function () { clearClaimHistory(); });
        });

        var claimSelect = overlay.querySelector('#si-claim-select');
        if (claimSelect && !claimSelect.dataset.bound) {
            claimSelect.dataset.bound = '1';
            claimSelect.addEventListener('change', function () { selectClaimById(claimSelect.value); });
        }
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
        syncCurrentFromSelectedClaim();
        mount();
        startRemountWatch();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();
