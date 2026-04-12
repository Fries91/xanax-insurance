// ==UserScript==
// @name         Sinner's Insurance 7DS
// @namespace    fries91-xanax-insurance
// @version      4.0.1
// @description  Sinner's Insurance
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @run-at       document-idle
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_deleteValue
// @updateURL    https://raw.githubusercontent.com/Fries91/xanax-insurance/main/static/xanax-insurance.user.js
// @downloadURL  https://raw.githubusercontent.com/Fries91/xanax-insurance/main/static/xanax-insurance.user.js
// @connect      xanax-insurance.onrender.com
// @connect      api.torn.com
// ==/UserScript==

(function () {
    'use strict';

    var launcher = null;
    var overlay = null;
    var backdrop = null;
    var remountTimer = null;
    var historyLoading = false;
    var warTabLoading = false;
    var warTabEnabled = !!gv('si_war_tab_enabled', 0);
    var warTabUpdatedAt = gv('si_war_tab_updated_at', '');
    var warTabUpdatedBy = gv('si_war_tab_updated_by', '');
    var warTabViewerCanManage = false;

    var activeTab = gv('si_active_tab', 'overview');
    var selectedPlan = gv('si_selected_plan', 'None');
    var sessionRole = gv('si_session_role', 'guest');
    var sessionName = gv('si_session_name', 'Guest');
    var claimStatus = gv('si_claim_status', 'Not submitted');
    var claimNote = gv('si_claim_note', '');
    var claimLoss = gv('si_claim_loss', '');
    var claimProof = gv('si_claim_proof', '');
    var claimStack = gv('si_claim_stack', '');
    var claimHistory = gv('si_claim_history', '[]');
    var claimId = gv('si_claim_id', '');
    var payoutAmount = gv('si_payout_amount', '');
    var decisionNote = gv('si_decision_note', '');
    var claimsDb = gv('si_claims_db', '[]');
    var selectedClaimId = gv('si_selected_claim_id', '');
    var claimFilterStatus = gv('si_claim_filter_status', 'all');
    var claimFilterMember = gv('si_claim_filter_member', '');
    var claimSortMode = gv('si_claim_sort_mode', 'newest');
    var apiBase = gv('si_api_base', 'https://xanax-insurance.onrender.com');
    var syncSecret = gv('si_sync_secret', '6282');
    var backendStatus = gv('si_backend_status', 'Not tested');
    var lastSyncAt = gv('si_last_sync_at', 'Never');
    var adminApiKey = gv('si_admin_api_key', '');
    var memberApiKey = gv('si_member_api_key', '');
    var singleApiKey = gv('si_single_api_key', gv('si_member_api_key', ''));
    var factionIdLock = gv('si_faction_id_lock', '49384');
    var authMode = gv('si_auth_mode', 'local');

    var scanTimer = null;
    var activeCoverageEnabled = !!gv('si_active_coverage_enabled', 0);
    var activeCoveragePlan = gv('si_active_coverage_plan', '');
    var activeCoverageStage = gv('si_active_coverage_stage', '');
    var activeCoverageArmedAt = gv('si_active_coverage_armed_at', '');
    var activeCoverageExpiresAt = gv('si_active_coverage_expires_at', '');
    var activeCoverageDetectStatus = gv('si_active_coverage_detect_status', 'idle');
    var activeCoverageLastCheckAt = gv('si_active_coverage_last_check_at', '');
    var activeCoverageLastEventKey = gv('si_active_coverage_last_event_key', '');
    var activeCoverageLastClaimId = gv('si_active_coverage_last_claim_id', '');
    var activeCoverageAutoSubmittedAt = gv('si_active_coverage_auto_submitted_at', '');
    var activeCoverageArmedEnergy = gv('si_active_coverage_armed_energy', '');
    var activeCoverageArmedBoosterCd = gv('si_active_coverage_armed_booster_cd', '');
    var activeCoverageRuleCheck = gv('si_active_coverage_rule_check', '');

    var PLANS = [
        {
            name: 'Pride',
            coverage: '6 Xanax',
            payment: '2 Xanax',
            window: '20 mins',
            payout: 'Up to 6 Xanax',
            stackType: 'any',
            rule: 'Can start with any amount of energy.',
            oldRows: [
                ['Coverage', '6 Xanax'],
                ['Payment', '2 Xanax'],
                ['Window', '20 mins'],
                ['Payout', 'Up to 6 Xanax']
            ]
        },
        {
            name: 'Envy',
            coverage: '25 Xanax + 3 E-DVD',
            payment: '2 Xanax + admin approval',
            window: '30 mins',
            payout: 'Plan review',
            stackType: 'mixed',
            rule: 'Use for approved Envy claims only.',
            oldRows: [
                ['Coverage', '25 Xanax + 3 E-DVD'],
                ['Payment', '2 Xanax'],
                ['Window', '30 mins'],
                ['Payout', 'Plan review']
            ]
        },
        {
            name: 'Wrath',
            coverage: 'Stage based',
            payment: '5 / 10 / 15 / 20 Xanax',
            window: '1 hour each stage',
            payout: '250 / 500 / 750 / 1000',
            stackType: 'xanax',
            rule: 'Must start at 0 energy so OD log shows the correct loss stage.',
            stages: [
                { stage: 'Stage 1', coverage: '2', payment: '5 Xanax', payout: '250', window: '1 hour' },
                { stage: 'Stage 2', coverage: '2', payment: '10 Xanax', payout: '500', window: '1 hour' },
                { stage: 'Stage 3', coverage: '2', payment: '15 Xanax', payout: '750', window: '1 hour' },
                { stage: 'Stage 4', coverage: '2', payment: '20 Xanax', payout: '1000', window: '1 hour' }
            ],
            oldRows: [
                ['Coverage', 'Stage based'],
                ['Payment', '5 / 10 / 15 / 20 Xanax'],
                ['Window', '1 hour each stage'],
                ['Payout', '250 / 500 / 750 / 1000']
            ]
        }
    ];

    function gv(key, fallback) {
        try {
            return typeof GM_getValue === 'function' ? GM_getValue(key, fallback) : fallback;
        } catch (e) {
            return fallback;
        }
    }

    function sv(key, value) {
        try {
            if (typeof GM_setValue === 'function') GM_setValue(key, value);
        } catch (e) {}
    }

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function saveSession() {
        sv('si_active_tab', activeTab || 'overview');
        sv('si_selected_plan', selectedPlan || 'None');
        sv('si_session_role', sessionRole || 'guest');
        sv('si_session_name', sessionName || 'Guest');
        sv('si_claim_status', claimStatus || 'Not submitted');
        sv('si_claim_note', claimNote || '');
        sv('si_claim_loss', claimLoss || '');
        sv('si_claim_proof', claimProof || '');
        sv('si_claim_stack', claimStack || '');
        sv('si_claim_history', claimHistory || '[]');
        sv('si_claim_id', claimId || '');
        sv('si_payout_amount', payoutAmount || '');
        sv('si_decision_note', decisionNote || '');
        sv('si_claims_db', claimsDb || '[]');
        sv('si_selected_claim_id', selectedClaimId || '');
        sv('si_claim_filter_status', claimFilterStatus || 'all');
        sv('si_claim_filter_member', claimFilterMember || '');
        sv('si_claim_sort_mode', claimSortMode || 'newest');
        sv('si_api_base', apiBase || '');
        sv('si_sync_secret', syncSecret || '');
        sv('si_backend_status', backendStatus || 'Not tested');
        sv('si_last_sync_at', lastSyncAt || 'Never');
        sv('si_admin_api_key', adminApiKey || '');
        sv('si_member_api_key', memberApiKey || '');
        sv('si_single_api_key', singleApiKey || '');
        sv('si_faction_id_lock', factionIdLock || '');
        sv('si_auth_mode', authMode || 'local');
        sv('si_active_coverage_enabled', activeCoverageEnabled ? 1 : 0);
        sv('si_active_coverage_plan', activeCoveragePlan || '');
        sv('si_active_coverage_stage', activeCoverageStage || '');
        sv('si_active_coverage_armed_at', activeCoverageArmedAt || '');
        sv('si_active_coverage_expires_at', activeCoverageExpiresAt || '');
        sv('si_active_coverage_detect_status', activeCoverageDetectStatus || 'idle');
        sv('si_active_coverage_last_check_at', activeCoverageLastCheckAt || '');
        sv('si_active_coverage_last_event_key', activeCoverageLastEventKey || '');
        sv('si_active_coverage_last_claim_id', activeCoverageLastClaimId || '');
        sv('si_active_coverage_auto_submitted_at', activeCoverageAutoSubmittedAt || '');
        sv('si_active_coverage_armed_energy', activeCoverageArmedEnergy || '');
        sv('si_active_coverage_armed_booster_cd', activeCoverageArmedBoosterCd || '');
        sv('si_active_coverage_rule_check', activeCoverageRuleCheck || '');
        sv('si_war_tab_enabled', warTabEnabled ? 1 : 0);
        sv('si_war_tab_updated_at', warTabUpdatedAt || '');
        sv('si_war_tab_updated_by', warTabUpdatedBy || '');
    }

    function isAdmin() {
        return sessionRole === 'admin';
    }

    function isMember() {
        return sessionRole === 'member' || sessionRole === 'admin';
    }

    function getPlanByName(name) {
        return PLANS.find(function (p) { return p.name === name; }) || null;
    }

    function getPlanRuleText(name) {
        var p = getPlanByName(name);
        return p ? p.rule : 'No plan selected.';
    }

    function getPayoutGuide(name) {
        var p = getPlanByName(name);
        return p ? p.payout : 'Admin review';
    }

    function stackMatchesPlan(name, stackText) {
        var p = getPlanByName(name);
        if (!p) return true;
        var s = String(stackText || '').toLowerCase();
        if (p.stackType === 'any') return true;
        if (p.stackType === 'xanax') return s.indexOf('xanax') >= 0;
        if (p.stackType === 'mixed') return s.indexOf('xanax') >= 0 || s.indexOf('dvd') >= 0 || s.indexOf('edvd') >= 0;
        return true;
    }


    function toMs(value) {
        var t = Date.parse(String(value || ''));
        return isNaN(t) ? 0 : t;
    }

    function nowMs() {
        return Date.now();
    }

    function formatDateTime(value) {
        var ms = toMs(value);
        return ms ? new Date(ms).toLocaleString() : 'Not set';
    }

    function formatRemaining(ms) {
        ms = Number(ms || 0);
        if (ms <= 0) return 'Expired';
        var total = Math.floor(ms / 1000);
        var h = Math.floor(total / 3600);
        var m = Math.floor((total % 3600) / 60);
        var s = total % 60;
        if (h > 0) return h + 'h ' + m + 'm ' + s + 's';
        return m + 'm ' + s + 's';
    }

    function getPlanStackLabel(name) {
        var p = getPlanByName(name);
        if (!p) return 'Unknown';
        if (p.stackType === 'xanax') return 'Xanax';
        if (p.stackType === 'mixed') return 'Mixed';
        return 'Any';
    }

    function getPlanWindowMinutes(name, stageName) {
        if (name === 'Wrath') {
            return 60;
        }
        if (name === 'Envy') return 30;
        if (name === 'Pride') return 20;
        return 30;
    }

    function getPlanPayoutText(name, stageName) {
        if (name === 'Wrath') {
            var p = getPlanByName(name);
            if (p && p.stages) {
                var s = p.stages.find(function (x) { return x.stage === stageName; }) || p.stages[0];
                if (s) return s.payout;
            }
        }
        return getPayoutGuide(name);
    }

    function getPlanRuleForActivation(name, stageName) {
        if (name === 'Wrath') {
            return 'Wrath active' + (stageName ? ' - ' + stageName : '') + '. Must start at 0 energy.';
        }
        return getPlanRuleText(name);
    }

    function currentCoverageRemainingMs() {
        return Math.max(0, toMs(activeCoverageExpiresAt) - nowMs());
    }

    function isCoverageActive() {
        if (!activeCoverageEnabled) return false;
        var expires = toMs(activeCoverageExpiresAt);
        return !!expires && expires > nowMs();
    }

    function clearCoverageState(reason) {
        activeCoverageEnabled = false;
        activeCoveragePlan = '';
        activeCoverageStage = '';
        activeCoverageArmedAt = '';
        activeCoverageExpiresAt = '';
        activeCoverageDetectStatus = reason || 'idle';
        activeCoverageArmedEnergy = '';
        activeCoverageArmedBoosterCd = '';
        activeCoverageRuleCheck = '';
        saveSession();
    }

    function armPlanCoverage(name, stageName) {
        if (!isMember()) {
            window.alert('Log in first.');
            return;
        }
        if (!name || name === 'None') {
            window.alert('Select a plan first.');
            return;
        }

        var now = new Date();
        var mins = getPlanWindowMinutes(name, stageName);
        var expiry = new Date(now.getTime() + (mins * 60000));

        selectedPlan = name;
        activeCoverageEnabled = true;
        activeCoveragePlan = name;
        activeCoverageStage = stageName || '';
        activeCoverageArmedAt = now.toISOString();
        activeCoverageExpiresAt = expiry.toISOString();
        activeCoverageDetectStatus = 'armed';
        activeCoverageLastCheckAt = '';
        activeCoverageLastEventKey = '';
        activeCoverageLastClaimId = '';
        activeCoverageAutoSubmittedAt = '';
        activeCoverageArmedEnergy = '';
        activeCoverageArmedBoosterCd = '';
        activeCoverageRuleCheck = getPlanRuleForActivation(name, stageName);
        saveSession();
        renderOverlay();
        window.alert(name + (stageName ? ' ' + stageName : '') + ' activated for ' + mins + ' minutes.');
        runCoverageScan();
    }

    function cancelCoverageState() {
        clearCoverageState('cancelled');
        renderOverlay();
    }

    function parseScanTimestamp(entry) {
        var candidates = [
            entry && entry.timestamp,
            entry && entry.started,
            entry && entry.time,
            entry && entry.createdAt,
            entry && entry.at
        ];
        for (var i = 0; i < candidates.length; i += 1) {
            var v = candidates[i];
            if (typeof v === 'number' && isFinite(v)) {
                return v > 1000000000000 ? v : (v * 1000);
            }
            var ms = toMs(v);
            if (ms) return ms;
        }
        return 0;
    }

    function collectLogEntries(data) {
        var out = [];
        function pushOne(key, entry) {
            if (!entry) return;
            var text = '';
            if (typeof entry === 'string') text = entry;
            if (!text) text = [entry.title, entry.type, entry.text, entry.description, entry.details, entry.reason, entry.message].filter(Boolean).join(' | ');
            out.push({
                key: String(key || entry.id || parseScanTimestamp(entry) || out.length),
                text: String(text || ''),
                timestampMs: parseScanTimestamp(entry),
                raw: entry
            });
        }

        var sources = [data && data.log, data && data.logs, data && data.events, data && data.event];
        sources.forEach(function (src) {
            if (!src) return;
            if (Array.isArray(src)) {
                src.forEach(function (entry, idx) { pushOne(idx, entry); });
            } else if (typeof src === 'object') {
                Object.keys(src).forEach(function (key) { pushOne(key, src[key]); });
            }
        });
        return out;
    }

    function findOdLikeEvent(data) {
        var armedAtMs = toMs(activeCoverageArmedAt);
        var expiryMs = toMs(activeCoverageExpiresAt);
        var logEntries = collectLogEntries(data);
        for (var i = 0; i < logEntries.length; i += 1) {
            var item = logEntries[i];
            var txt = String(item.text || '').toLowerCase();
            if (txt.indexOf('overdose') >= 0 || txt.indexOf('overdosed') >= 0 || txt.indexOf('over dos') >= 0 || txt.indexOf('rehab') >= 0) {
                var ts = item.timestampMs || nowMs();
                if (ts >= armedAtMs && ts <= expiryMs) return item;
            }
        }

        var profile = data && (data.profile || data.user || data.player || data);
        var status = profile && profile.status;
        var statusText = [
            status && status.description,
            status && status.details,
            status && status.state,
            status && status.reason,
            profile && profile.status_description,
            profile && profile.status_details
        ].filter(Boolean).join(' | ').toLowerCase();

        if (statusText.indexOf('overdose') >= 0 || statusText.indexOf('overdosed') >= 0) {
            return {
                key: 'status-' + Math.floor(nowMs() / 30000),
                text: statusText || 'Status indicates overdose.',
                timestampMs: nowMs(),
                raw: status || {}
            };
        }

        return null;
    }

    function fetchTornScanData(apiKey) {
        if (!apiKey) return Promise.resolve(null);
        var url = 'https://api.torn.com/user/?selections=profile,log&key=' + encodeURIComponent(apiKey);
        return new Promise(function (resolve) {
            if (typeof GM_xmlhttpRequest === 'function') {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    onload: function (res) {
                        try { resolve(JSON.parse(res.responseText || '{}')); } catch (e) { resolve(null); }
                    },
                    onerror: function () { resolve(null); }
                });
                return;
            }
            fetch(url).then(function (r) { return r.json(); }).then(resolve).catch(function () { resolve(null); });
        });
    }

    function createAutoDetectedClaim(eventInfo) {
        if (!eventInfo || activeCoverageLastEventKey === String(eventInfo.key || '')) return;
        if (!isCoverageActive()) return;

        var payoutText = getPlanPayoutText(activeCoveragePlan, activeCoverageStage);
        var proofText = 'Auto OD detect | ' + formatDateTime(new Date(eventInfo.timestampMs || nowMs()).toISOString()) + ' | ' + String(eventInfo.text || 'OD event');
        claimId = makeClaimId();
        selectedClaimId = claimId;
        selectedPlan = activeCoveragePlan || selectedPlan;
        claimStatus = 'Pending review';
        claimNote = 'Auto-detected OD during active ' + activeCoveragePlan + (activeCoverageStage ? ' ' + activeCoverageStage : '') + ' window.';
        claimLoss = payoutText;
        claimProof = proofText;
        claimStack = getPlanStackLabel(activeCoveragePlan);
        payoutAmount = '';
        decisionNote = '';
        activeCoverageDetectStatus = 'auto-claim-submitted';
        activeCoverageLastEventKey = String(eventInfo.key || '');
        activeCoverageLastClaimId = claimId;
        activeCoverageAutoSubmittedAt = new Date().toISOString();
        upsertCurrentClaim();
        addHistory('Auto-detected OD and created claim ' + claimId + '.');
        saveSession();
        pushCurrentClaimToBackend('auto_detect');
        renderOverlay();
    }

    function runCoverageScan() {
        if (!isCoverageActive()) {
            if (activeCoverageEnabled && currentCoverageRemainingMs() <= 0) {
                clearCoverageState('expired');
                renderOverlay();
            }
            return Promise.resolve(null);
        }

        if (!singleApiKey) return Promise.resolve(null);
        activeCoverageLastCheckAt = new Date().toISOString();
        activeCoverageDetectStatus = 'scanning';
        saveSession();

        return fetchTornScanData(singleApiKey).then(function (data) {
            if (!data) {
                activeCoverageDetectStatus = 'scan-failed';
                saveSession();
                return null;
            }

            var found = findOdLikeEvent(data);
            if (found) {
                createAutoDetectedClaim(found);
            } else {
                activeCoverageDetectStatus = 'clear';
                saveSession();
                renderOverlay();
            }
            return found;
        });
    }

    function ensureCoverageTimer() {
        if (scanTimer) return;
        scanTimer = setInterval(function () {
            if (isCoverageActive()) {
                runCoverageScan();
                renderOverlay();
            } else if (activeCoverageEnabled && currentCoverageRemainingMs() <= 0) {
                clearCoverageState('expired');
                renderOverlay();
            }
        }, 30000);
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

    function getClaimHistoryItems() {
        try {
            var arr = JSON.parse(claimHistory || '[]');
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            return [];
        }
    }

    function saveHistory(items) {
        claimHistory = JSON.stringify(Array.isArray(items) ? items : []);
        saveSession();
    }

    function addHistory(text) {
        var arr = getClaimHistoryItems();
        arr.unshift({ at: new Date().toLocaleString(), text: text });
        saveHistory(arr.slice(0, 20));
    }

    function makeClaimId() {
        return 'SIN-' + String(Date.now()).slice(-8);
    }

    function getSelectedClaimRecord() {
        var items = getClaimsDbItems();
        var rec = items.find(function (item) { return item && item.id === selectedClaimId; });
        if (rec) return rec;
        if (items.length) {
            selectedClaimId = items[0].id || '';
            return items[0];
        }
        return null;
    }

    function syncFromSelectedClaim() {
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

    function upsertCurrentClaim() {
        if (!claimId) return;
        var items = getClaimsDbItems();
        var idx = items.findIndex(function (item) { return item && item.id === claimId; });
        var rec = {
            id: claimId,
            member: sessionName || 'Guest',
            plan: selectedPlan || 'None',
            status: claimStatus || 'Not submitted',
            note: claimNote || '',
            loss: claimLoss || '',
            proof: claimProof || '',
            stack: claimStack || '',
            payout: payoutAmount || '',
            decision: decisionNote || '',
            updatedAt: new Date().toLocaleString()
        };
        if (idx >= 0) items[idx] = rec;
        else items.unshift(rec);
        selectedClaimId = claimId;
        saveClaimsDbItems(items.slice(0, 50));
    }

    function getStatusSortRank(status) {
        var s = String(status || '');
        if (s === 'Pending review') return 1;
        if (s === 'Under review') return 2;
        if (s === 'Approved') return 3;
        if (s === 'Denied') return 4;
        if (s === 'Paid') return 5;
        return 99;
    }

    function sortClaimsItems(items) {
        var arr = items.slice();
        arr.sort(function (a, b) {
            var mode = String(claimSortMode || 'newest');
            if (mode === 'oldest') return String(a && a.id || '').localeCompare(String(b && b.id || ''));
            if (mode === 'member_az') {
                var byMember = String(a && a.member || '').localeCompare(String(b && b.member || ''));
                if (byMember !== 0) return byMember;
            }
            if (mode === 'status') {
                var byStatus = getStatusSortRank(a && a.status) - getStatusSortRank(b && b.status);
                if (byStatus !== 0) return byStatus;
            }
            return String(b && b.id || '').localeCompare(String(a && a.id || ''));
        });
        return arr;
    }

    function getFilteredClaimsDbItems() {
        var filtered = getClaimsDbItems().filter(function (item) {
            if (!item) return false;
            var statusOk = claimFilterStatus === 'all' || String(item.status || '') === String(claimFilterStatus || '');
            var needle = String(claimFilterMember || '').trim().toLowerCase();
            var member = String(item.member || '').toLowerCase();
            var memberOk = !needle || member.indexOf(needle) >= 0;
            return statusOk && memberOk;
        });

        filtered = sortClaimsItems(filtered);

        if (isMember() && !isAdmin()) {
            filtered = filtered.filter(function (item) {
                return String(item && item.member || '').toLowerCase() === String(sessionName || '').toLowerCase();
            });
        }

        return filtered;
    }

    function getMemberClaimSummary() {
        var items = getClaimsDbItems();
        var total = items.length;
        var pending = 0;
        var approved = 0;
        var denied = 0;
        var paid = 0;
        var payouts = 0;
        var names = {};

        items.forEach(function (x) {
            var st = String(x && x.status || '');
            if (st === 'Pending review' || st === 'Under review') pending += 1;
            if (st === 'Approved') approved += 1;
            if (st === 'Denied') denied += 1;
            if (st === 'Paid') paid += 1;
            var n = String(x && x.member || '').trim();
            if (n) names[n.toLowerCase()] = true;
            var p = String(x && x.payout || '').replace(/[^0-9.-]/g, '');
            payouts += Number(p || 0) || 0;
        });

        return {
            total: total,
            pending: pending,
            approved: approved,
            denied: denied,
            paid: paid,
            members: Object.keys(names).length,
            payouts: payouts
        };
    }

    function apiRequest(method, path, payload) {
        var url = String(apiBase || '').replace(/\/$/, '') + path;

        if (typeof GM_xmlhttpRequest === 'function') {
            return new Promise(function (resolve, reject) {
                GM_xmlhttpRequest({
                    method: method,
                    url: url,
                    headers: { 'Content-Type': 'application/json' },
                    data: payload ? JSON.stringify(payload) : undefined,
                    onload: function (res) {
                        try {
                            resolve(JSON.parse(res.responseText || '{}'));
                        } catch (e) {
                            resolve({});
                        }
                    },
                    onerror: reject
                });
            });
        }

        return fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: payload ? JSON.stringify(payload) : undefined
        }).then(function (res) { return res.json(); });
    }

    function buildServerAuthPayload() {
        return {
            mode: authMode || 'local',
            admin_api_key: adminApiKey || singleApiKey || '',
            api_key: memberApiKey || singleApiKey || '',
            faction_id: factionIdLock || ''
        };
    }

    function testBackendConnection() {
        return apiRequest('GET', '/api/health', null).then(function (data) {
            backendStatus = data && data.ok ? 'Connected' : 'Health check failed';
            lastSyncAt = new Date().toLocaleString();
            saveSession();
            renderOverlay();
            return data;
        }).catch(function () {
            backendStatus = 'Connection failed';
            lastSyncAt = new Date().toLocaleString();
            saveSession();
            renderOverlay();
            return null;
        });
    }

    function syncClaimsFromBackend() {
        if (!syncSecret) {
            window.alert('Enter Sync Secret first.');
            return Promise.resolve(null);
        }
        return apiRequest('POST', '/api/claims/pull', { secret: syncSecret }).then(function (data) {
            if (data && Array.isArray(data.claims)) {
                saveClaimsDbItems(data.claims);
                if (!selectedClaimId && data.claims.length) selectedClaimId = data.claims[0].id || '';
                syncFromSelectedClaim();
                backendStatus = 'Claims pulled';
                lastSyncAt = new Date().toLocaleString();
                saveSession();
                renderOverlay();
            }
            return data;
        }).catch(function () {
            backendStatus = 'Pull failed';
            lastSyncAt = new Date().toLocaleString();
            saveSession();
            renderOverlay();
            return null;
        });
    }


    function fetchWarTabState() {
        if (!syncSecret || warTabLoading) return Promise.resolve(null);
        warTabLoading = true;
        return apiRequest('POST', '/api/warstack/state', {
            secret: syncSecret,
            auth: buildServerAuthPayload()
        }).then(function (data) {
            warTabLoading = false;
            var state = data && (data.state || data.warstack);
            if (state) {
                warTabEnabled = !!state.enabled;
                warTabUpdatedAt = state.updatedAt || '';
                warTabUpdatedBy = state.updatedBy || '';
                warTabViewerCanManage = !!state.viewerCanManage;
                backendStatus = 'War Stack loaded';
                lastSyncAt = new Date().toLocaleString();
                saveSession();
                renderOverlay();
            }
            return data;
        }).catch(function () {
            warTabLoading = false;
            return null;
        });
    }

    function setWarTabState(enabled) {
        if (!syncSecret) {
            window.alert('Enter Sync Secret first.');
            return;
        }
        apiRequest('POST', '/api/warstack/set-state', {
            secret: syncSecret,
            auth: buildServerAuthPayload(),
            enabled: enabled ? 1 : 0
        }).then(function (data) {
            var state = data && (data.state || data.warstack);
            if (state) {
                warTabEnabled = !!state.enabled;
                warTabUpdatedAt = state.updatedAt || '';
                warTabUpdatedBy = state.updatedBy || '';
                warTabViewerCanManage = !!state.viewerCanManage;
                backendStatus = 'War Stack updated';
                lastSyncAt = new Date().toLocaleString();
                saveSession();
                renderOverlay();
            } else {
                window.alert((data && data.error) ? data.error : 'War tab update failed.');
            }
        }).catch(function () {
            window.alert('War tab update failed.');
        });
    }

    function pushCurrentClaimToBackend(actionOverride) {
        if (!claimId || !syncSecret) return Promise.resolve(null);

        var action = actionOverride || (isAdmin() ? 'admin_update' : (isMember() ? 'member_submit' : 'guest'));
        var payload = {
            secret: syncSecret,
            action: action,
            auth: buildServerAuthPayload(),
            claim: {
                id: claimId || '',
                member: sessionName || 'Guest',
                plan: selectedPlan || 'None',
                status: claimStatus || 'Not submitted',
                note: claimNote || '',
                loss: claimLoss || '',
                proof: claimProof || '',
                stack: claimStack || '',
                payout: payoutAmount || '',
                decision: decisionNote || '',
                armedAt: activeCoverageArmedAt || '',
                armedPlan: activeCoveragePlan || '',
                armedStage: activeCoverageStage || '',
                armedEnergy: activeCoverageArmedEnergy || '',
                armedBoosterCd: activeCoverageArmedBoosterCd || '',
                expiresAt: activeCoverageExpiresAt || '',
                odDetectedAt: activeCoverageAutoSubmittedAt || '',
                ruleCheck: activeCoverageRuleCheck || '',
                detectStatus: activeCoverageDetectStatus || '',
                updatedAt: new Date().toISOString()
            }
        };

        return apiRequest('POST', '/api/claims/push', payload).then(function (data) {
            backendStatus = data && data.ok ? 'Claim pushed' : ((data && data.error) ? data.error : 'Push failed');
            lastSyncAt = new Date().toLocaleString();
            if (data && data.claim) {
                var rec = data.claim;
                claimId = rec.id || claimId;
                selectedClaimId = rec.id || selectedClaimId;
                selectedPlan = rec.plan || selectedPlan;
                claimStatus = rec.status || claimStatus;
                claimNote = rec.note || claimNote;
                claimLoss = rec.loss || claimLoss;
                claimProof = rec.proof || claimProof;
                claimStack = rec.stack || claimStack;
                payoutAmount = rec.payout || payoutAmount;
                decisionNote = rec.decision || decisionNote;
                upsertCurrentClaim();
            }
            saveSession();
            renderOverlay();
            return data;
        }).catch(function () {
            backendStatus = 'Push failed';
            lastSyncAt = new Date().toLocaleString();
            saveSession();
            renderOverlay();
            return null;
        });
    }

    function fetchSelectedClaimHistory() {
        if (!selectedClaimId || !syncSecret || historyLoading) return Promise.resolve(null);
        historyLoading = true;
        return apiRequest('POST', '/api/claims/history', {
            secret: syncSecret,
            claim_id: selectedClaimId
        }).then(function (data) {
            historyLoading = false;
            if (data && Array.isArray(data.history)) {
                saveHistory(data.history.map(function (x) {
                    return { at: x.at || x.createdAt || '', text: x.text || x.note || JSON.stringify(x) };
                }));
                renderOverlay();
            }
            return data;
        }).catch(function () {
            historyLoading = false;
            return null;
        });
    }

    function singleBackendLogin() {
        if (!apiBase || !syncSecret || !singleApiKey) {
            window.alert('Enter API Base URL, Sync Secret, and Torn API key first.');
            return;
        }

        adminApiKey = singleApiKey;
        memberApiKey = singleApiKey;

        apiRequest('POST', '/api/auth/admin-key-login', {
            api_key: singleApiKey,
            secret: syncSecret
        }).then(function (data) {
            if (data && data.ok && data.user) {
                sessionName = data.user.name || 'Admin';
                sessionRole = 'admin';
                authMode = 'backend-admin-key';
                backendStatus = 'Admin login ok';
                lastSyncAt = new Date().toLocaleString();
                saveSession();
                renderOverlay();
                fetchWarTabState();
                return;
            }

            return apiRequest('POST', '/api/auth/faction-login', {
                api_key: singleApiKey,
                faction_id: factionIdLock || '',
                secret: syncSecret
            }).then(function (memberData) {
                if (memberData && memberData.ok && memberData.user) {
                    sessionName = memberData.user.name || 'Member';
                    sessionRole = memberData.user.role || 'member';
                    authMode = 'backend-faction';
                    backendStatus = 'Member login ok';
                    lastSyncAt = new Date().toLocaleString();
                    saveSession();
                    renderOverlay();
                    fetchWarTabState();
                } else {
                    window.alert((memberData && memberData.error) ? memberData.error : 'Login failed.');
                }
            });
        }).catch(function () {
            window.alert('Login failed.');
        });
    }

    function localLogin(role) {
        var name = window.prompt(role === 'admin' ? 'Enter admin name' : 'Enter member name', sessionName || '');
        if (!name) return;
        var pass = window.prompt(role === 'admin' ? 'Enter admin passcode' : 'Enter member passcode', '');
        if (pass === null) return;

        if (role === 'admin' && pass !== 'wrathadmin') {
            window.alert('Admin login failed.');
            return;
        }
        if (role === 'member' && pass !== 'sinsmember') {
            window.alert('Member login failed.');
            return;
        }

        sessionRole = role;
        sessionName = String(name).trim() || (role === 'admin' ? 'Admin' : 'Member');
        authMode = 'local';
        saveSession();
        renderOverlay();
    }

    function logoutSession() {
        sessionRole = 'guest';
        sessionName = 'Guest';
        authMode = 'local';
        saveSession();
        renderOverlay();
    }

    function selectPlan(name) {
        selectedPlan = name;
        saveSession();
        renderOverlay();
    }

    function showPlanTerms(name) {
        window.alert(name + ' terms:\n\n' + getPlanRuleText(name));
    }

    function valueOf(selector) {
        var el = overlay && overlay.querySelector(selector);
        return el ? String(el.value || '').trim() : '';
    }

    function updateClaimFilters() {
        claimFilterStatus = valueOf('#si-claim-filter-status') || 'all';
        claimFilterMember = valueOf('#si-claim-filter-member') || '';
        claimSortMode = valueOf('#si-claim-sort-mode') || 'newest';
        saveSession();
        renderOverlay();
    }

    function submitClaim() {
        if (!isMember()) {
            window.alert('Log in as a member first.');
            return;
        }
        if (!selectedPlan || selectedPlan === 'None') {
            window.alert('Select a plan first.');
            return;
        }

        claimNote = valueOf('#si-claim-note');
        claimLoss = valueOf('#si-claim-loss');
        claimProof = valueOf('#si-claim-proof');
        claimStack = valueOf('#si-claim-stack');

        if (!claimNote || !claimLoss || !claimProof || !claimStack) {
            window.alert('Fill in all claim fields.');
            return;
        }
        if (!stackMatchesPlan(selectedPlan, claimStack)) {
            window.alert('Stack type does not match selected plan.\n\nRule: ' + getPlanRuleText(selectedPlan));
            return;
        }

        if (!claimId) claimId = makeClaimId();
        selectedClaimId = claimId;
        claimStatus = 'Pending review';
        upsertCurrentClaim();
        addHistory((sessionName || 'Member') + ' submitted claim ' + claimId + '.');
        saveSession();
        pushCurrentClaimToBackend('member_submit');
        activeTab = 'claims';
        renderOverlay();
    }

    function adminSetClaimStatus(nextStatus) {
        if (!isAdmin()) {
            window.alert('Admin login required.');
            return;
        }
        claimStatus = nextStatus;
        payoutAmount = valueOf('#si-payout') || payoutAmount;
        decisionNote = valueOf('#si-decision') || decisionNote;
        upsertCurrentClaim();
        addHistory((sessionName || 'Admin') + ' changed status to ' + nextStatus + '.');
        saveSession();
        pushCurrentClaimToBackend('admin_update');
        renderOverlay();
    }

    function card(title, body) {
        return '<div class="si-card"><div class="si-card-title">' + esc(title) + '</div>' + body + '</div>';
    }

    function tile(value, label) {
        return '<div class="si-tile"><div class="si-tile-num">' + esc(value) + '</div><div class="si-tile-label">' + esc(label) + '</div></div>';
    }


    function renderWarStackControls() {
        var canManage = isAdmin() || sessionRole === 'leader' || sessionRole === 'co-leader';
        var stateText = warTabEnabled ? 'Activated' : 'Inactive';
        var buttons = canManage
            ? '<div class="si-btnrow">'
                + '<button id="si-war-on" class="si-btn good">Activate War Stack</button>'
                + '<button id="si-war-off" class="si-btn alt">Deactivate War Stack</button>'
              + '</div>'
            : '<div class="si-text">Login with your Torn API key to manage War Stack.</div>';

        return card('War Stack',
            '<div class="si-row"><span class="si-label">Status</span><span class="si-badge">' + esc(stateText) + '</span></div>'
            + '<div class="si-row"><span class="si-label">Updated By</span><span>' + esc(warTabUpdatedBy || 'Not set') + '</span></div>'
            + '<div class="si-row"><span class="si-label">Updated At</span><span>' + esc(warTabUpdatedAt || 'Never') + '</span></div>'
            + buttons
        );
    }

    function renderOldPlanRows(rows) {
        return rows.map(function (row) {
            return '<div class="si-row"><span class="si-label">' + esc(row[0]) + '</span><span>' + esc(row[1]) + '</span></div>';
        }).join('');
    }

    function renderOverview() {
        var summary = getMemberClaimSummary();
        var coverageCard = card('Active Coverage',
            '<div class="si-row"><span class="si-label">Plan</span><span>' + esc(activeCoveragePlan || 'None') + '</span></div>'
            + '<div class="si-row"><span class="si-label">Stage</span><span>' + esc(activeCoverageStage || '-') + '</span></div>'
            + '<div class="si-row"><span class="si-label">Status</span><span class="si-status">' + esc(isCoverageActive() ? 'Active' : (activeCoverageDetectStatus || 'Idle')) + '</span></div>'
            + '<div class="si-row"><span class="si-label">Armed At</span><span>' + esc(formatDateTime(activeCoverageArmedAt)) + '</span></div>'
            + '<div class="si-row"><span class="si-label">Expires</span><span>' + esc(formatDateTime(activeCoverageExpiresAt)) + '</span></div>'
            + '<div class="si-row"><span class="si-label">Remaining</span><span>' + esc(isCoverageActive() ? formatRemaining(currentCoverageRemainingMs()) : 'Not active') + '</span></div>'
            + '<div class="si-row"><span class="si-label">Last Check</span><span>' + esc(formatDateTime(activeCoverageLastCheckAt)) + '</span></div>'
            + '<div class="si-row"><span class="si-label">Last Claim</span><span>' + esc(activeCoverageLastClaimId || 'None') + '</span></div>'
            + '<div class="si-btnrow">'
            + '<button id="si-scan-now" class="si-btn">Scan Now</button>'
            + '<button id="si-cancel-coverage" class="si-btn alt">Cancel Window</button>'
            + '</div>'
        );

        return ''
            + card('Overview',
                '<div class="si-row"><span class="si-label">User</span><span>' + esc(sessionName) + '</span></div>'
                + '<div class="si-row"><span class="si-label">Role</span><span>' + esc(sessionRole) + '</span></div>'
                + '<div class="si-row"><span class="si-label">Selected Plan</span><span>' + esc(selectedPlan) + '</span></div>'
                + '<div class="si-row"><span class="si-label">Claims</span><span>' + esc(summary.total) + '</span></div>'
                + '<div class="si-row"><span class="si-label">Pending</span><span>' + esc(summary.pending) + '</span></div>'
                + '<div class="si-row"><span class="si-label">Approved</span><span>' + esc(summary.approved) + '</span></div>'
                + '<div class="si-row"><span class="si-label">Denied</span><span>' + esc(summary.denied) + '</span></div>'
                + '<div class="si-row"><span class="si-label">Paid</span><span>' + esc(summary.paid) + '</span></div>'
                + '<div class="si-row"><span class="si-label">Backend</span><span>' + esc(backendStatus) + '</span></div>'
                + '<div class="si-row"><span class="si-label">Last Sync</span><span>' + esc(lastSyncAt) + '</span></div>')
            + coverageCard
            + renderWarStackControls();
    }

    function renderPlans() {
        return PLANS.map(function (p) {
            var rows = renderOldPlanRows(p.oldRows || []);
            var wrathStages = '';
            if (p.stages && p.stages.length) {
                wrathStages = '<div class="si-wrath-wrap">'
                    + p.stages.map(function (s) {
                        return '<div class="si-wrath-stage">'
                            + '<div class="si-wrath-title">' + esc(s.stage) + '</div>'
                            + '<div class="si-row"><span class="si-label">Coverage</span><span>' + esc(s.coverage) + '</span></div>'
                            + '<div class="si-row"><span class="si-label">Payment</span><span>' + esc(s.payment) + '</span></div>'
                            + '<div class="si-row"><span class="si-label">Payout</span><span>' + esc(s.payout) + '</span></div>'
                            + '<div class="si-row"><span class="si-label">Window</span><span>' + esc(s.window) + '</span></div>'
                            + '</div>';
                    }).join('') + '</div>';
            }

            var activateButtons = '<div class="si-btnrow">'
                + '<button class="si-btn" data-action="select-plan" data-plan="' + esc(p.name) + '">Select</button>'
                + '<button class="si-btn good" data-action="arm-plan" data-plan="' + esc(p.name) + '">Activate</button>'
                + '<button class="si-btn alt" data-action="terms-plan" data-plan="' + esc(p.name) + '">Terms</button>'
                + '</div>';

            if (p.stages && p.stages.length) {
                activateButtons += '<div class="si-wrath-wrap">'
                    + p.stages.map(function (s) {
                        return '<div class="si-btnrow">'
                            + '<button class="si-btn good" data-action="arm-stage" data-plan="' + esc(p.name) + '" data-stage="' + esc(s.stage) + '">Activate ' + esc(s.stage) + '</button>'
                            + '</div>';
                    }).join('') + '</div>';
            }

            return card(p.name,
                rows
                + '<div class="si-text">' + esc(p.rule) + '</div>'
                + wrathStages
                + activateButtons
            );
        }).join('') + card('Selected Plan', '<div class="si-text"><strong>' + esc(selectedPlan) + '</strong></div>');
    }

    function renderClaims() {
        syncFromSelectedClaim();
        var items = getFilteredClaimsDbItems();
        var history = getClaimHistoryItems();
        var options = items.map(function (item) {
            return '<option value="' + esc(item.id) + '"' + (selectedClaimId === item.id ? ' selected' : '') + '>'
                + esc(item.id + ' | ' + item.member + ' | ' + item.status)
                + '</option>';
        }).join('');

        return ''
            + card('Claim Filters',
                '<div class="si-field"><label>Status</label><select id="si-claim-filter-status" class="si-input">'
                + '<option value="all"' + (claimFilterStatus === 'all' ? ' selected' : '') + '>All</option>'
                + '<option value="Pending review"' + (claimFilterStatus === 'Pending review' ? ' selected' : '') + '>Pending review</option>'
                + '<option value="Under review"' + (claimFilterStatus === 'Under review' ? ' selected' : '') + '>Under review</option>'
                + '<option value="Approved"' + (claimFilterStatus === 'Approved' ? ' selected' : '') + '>Approved</option>'
                + '<option value="Denied"' + (claimFilterStatus === 'Denied' ? ' selected' : '') + '>Denied</option>'
                + '<option value="Paid"' + (claimFilterStatus === 'Paid' ? ' selected' : '') + '>Paid</option>'
                + '</select></div>'
                + '<div class="si-field"><label>Member Filter</label><input id="si-claim-filter-member" class="si-input" value="' + esc(claimFilterMember) + '" placeholder="Search member"></div>'
                + '<div class="si-field"><label>Sort</label><select id="si-claim-sort-mode" class="si-input">'
                + '<option value="newest"' + (claimSortMode === 'newest' ? ' selected' : '') + '>Newest</option>'
                + '<option value="oldest"' + (claimSortMode === 'oldest' ? ' selected' : '') + '>Oldest</option>'
                + '<option value="member_az"' + (claimSortMode === 'member_az' ? ' selected' : '') + '>Member A-Z</option>'
                + '<option value="status"' + (claimSortMode === 'status' ? ' selected' : '') + '>Status</option>'
                + '</select></div>'
                + '<div class="si-btnrow"><button id="si-apply-filters" class="si-btn alt">Apply Filters</button></div>')
            + card('Current Claim',
                '<div class="si-field"><label>Saved Claims</label><select id="si-claim-select" class="si-input"><option value="">Select claim</option>' + options + '</select></div>'
                + '<div class="si-field"><label>Plan</label><div class="si-text">' + esc(selectedPlan) + '</div></div>'
                + '<div class="si-field"><label>Claim Note</label><textarea id="si-claim-note" class="si-textarea" placeholder="Describe what happened">' + esc(claimNote) + '</textarea></div>'
                + '<div class="si-field"><label>Loss</label><input id="si-claim-loss" class="si-input" value="' + esc(claimLoss) + '" placeholder="Loss amount"></div>'
                + '<div class="si-field"><label>Proof</label><input id="si-claim-proof" class="si-input" value="' + esc(claimProof) + '" placeholder="Proof or logs"></div>'
                + '<div class="si-field"><label>Stack Type</label><input id="si-claim-stack" class="si-input" value="' + esc(claimStack) + '" placeholder="Xanax / E-DVD / Mixed"></div>'
                + '<div class="si-row"><span class="si-label">Status</span><span class="si-status">' + esc(claimStatus) + '</span></div>'
                + '<div class="si-row"><span class="si-label">Auto Window</span><span>' + esc(activeCoveragePlan ? (activeCoveragePlan + (activeCoverageStage ? ' ' + activeCoverageStage : '')) : 'None') + '</span></div>'
                + '<div class="si-row"><span class="si-label">Detect</span><span>' + esc(activeCoverageDetectStatus || 'idle') + '</span></div>'
                + '<div class="si-btnrow"><button id="si-submit-claim" class="si-btn">Submit Claim</button></div>')
            + (isAdmin() ? card('Admin Review',
                '<div class="si-field"><label>Payout</label><input id="si-payout" class="si-input" value="' + esc(payoutAmount) + '" placeholder="Payout amount"></div>'
                + '<div class="si-field"><label>Decision Note</label><textarea id="si-decision" class="si-textarea" placeholder="Admin note">' + esc(decisionNote) + '</textarea></div>'
                + '<div class="si-btnstack">'
                + '<button id="si-under-review" class="si-btn alt">Under Review</button>'
                + '<button id="si-approve" class="si-btn good">Approve</button>'
                + '<button id="si-deny" class="si-btn bad">Deny</button>'
                + '<button id="si-paid" class="si-btn">Mark Paid</button>'
                + '</div>') : '')
            + card('Claim History',
                history.length ? history.map(function (item) {
                    return '<div class="si-history-item"><div class="si-history-at">' + esc(item.at) + '</div><div class="si-text">' + esc(item.text) + '</div></div>';
                }).join('') : '<div class="si-text">No history yet.</div>');
    }

    function renderSettings() {
        return ''
            + card('Torn Login',
                '<div class="si-field"><label>Torn API Key</label><input id="si-single-api-key" class="si-input" value="' + esc(singleApiKey) + '" placeholder="Enter your Torn API key"></div>'
                + '<div class="si-field"><label>Faction ID</label><input id="si-faction-id-lock" class="si-input" value="' + esc(factionIdLock) + '" placeholder="Optional faction id"></div>'
                + '<div class="si-field"><label>Sync Secret</label><input id="si-sync-secret" class="si-input" value="' + esc(syncSecret) + '" placeholder="Backend sync secret"></div>'
                + '<div class="si-field"><label>API Base URL</label><input id="si-api-base" class="si-input" value="' + esc(apiBase) + '"></div>'
                + '<div class="si-btnrow">'
                + '<button id="si-save-settings" class="si-btn">Save</button>'
                + '<button id="si-single-login" class="si-btn good">Login</button>'
                + '<button id="si-logout" class="si-btn alt">Logout</button>'
                + '</div>'
                + '<div class="si-text">One Torn API key is used for member or admin login depending on the key owner.</div>');
    }

    function bindEvents() {
        if (!overlay) return;

        overlay.querySelectorAll('[data-tab]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                activeTab = btn.getAttribute('data-tab') || 'overview';
                saveSession();
                renderOverlay();
                if (activeTab === 'claims') fetchSelectedClaimHistory();
            });
        });

        overlay.querySelectorAll('[data-plan]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var name = btn.getAttribute('data-plan') || '';
                var action = btn.getAttribute('data-action') || '';
                var stage = btn.getAttribute('data-stage') || '';
                if (action === 'select-plan') selectPlan(name);
                if (action === 'terms-plan') showPlanTerms(name);
                if (action === 'arm-plan') armPlanCoverage(name, '');
                if (action === 'arm-stage') armPlanCoverage(name, stage);
            });
        });

        var closeBtn = overlay.querySelector('#si-close-btn');
        if (closeBtn) closeBtn.addEventListener('click', closeOverlay);

        var saveBtn = overlay.querySelector('#si-save-settings');
        if (saveBtn) saveBtn.addEventListener('click', function () {
            apiBase = valueOf('#si-api-base') || apiBase;
            syncSecret = valueOf('#si-sync-secret') || syncSecret;
            singleApiKey = valueOf('#si-single-api-key') || singleApiKey;
            adminApiKey = singleApiKey;
            memberApiKey = singleApiKey;
            factionIdLock = valueOf('#si-faction-id-lock') || factionIdLock;
            saveSession();
            renderOverlay();
        });

        var applyFiltersBtn = overlay.querySelector('#si-apply-filters');
        if (applyFiltersBtn) applyFiltersBtn.addEventListener('click', updateClaimFilters);

        var testBtn = overlay.querySelector('#si-test-backend');
        if (testBtn) testBtn.addEventListener('click', testBackendConnection);

        var pullBtn = overlay.querySelector('#si-pull-claims');
        if (pullBtn) pullBtn.addEventListener('click', syncClaimsFromBackend);

        var singleLoginBtn = overlay.querySelector('#si-single-login');
        if (singleLoginBtn) singleLoginBtn.addEventListener('click', singleBackendLogin);

        var warOnBtn = overlay.querySelector('#si-war-on');
        if (warOnBtn) warOnBtn.addEventListener('click', function () { setWarTabState(true); });

        var warOffBtn = overlay.querySelector('#si-war-off');
        if (warOffBtn) warOffBtn.addEventListener('click', function () { setWarTabState(false); });

        var scanNowBtn = overlay.querySelector('#si-scan-now');
        if (scanNowBtn) scanNowBtn.addEventListener('click', runCoverageScan);

        var cancelCoverageBtn = overlay.querySelector('#si-cancel-coverage');
        if (cancelCoverageBtn) cancelCoverageBtn.addEventListener('click', cancelCoverageState);

        var logoutBtn = overlay.querySelector('#si-logout');
        if (logoutBtn) logoutBtn.addEventListener('click', logoutSession);

        var submitBtn = overlay.querySelector('#si-submit-claim');
        if (submitBtn) submitBtn.addEventListener('click', submitClaim);

        var claimSelect = overlay.querySelector('#si-claim-select');
        if (claimSelect) claimSelect.addEventListener('change', function () {
            selectedClaimId = claimSelect.value || '';
            syncFromSelectedClaim();
            saveSession();
            renderOverlay();
            fetchSelectedClaimHistory();
        });

        var approveBtn = overlay.querySelector('#si-approve');
        if (approveBtn) approveBtn.addEventListener('click', function () { adminSetClaimStatus('Approved'); });

        var underReviewBtn = overlay.querySelector('#si-under-review');
        if (underReviewBtn) underReviewBtn.addEventListener('click', function () { adminSetClaimStatus('Under review'); });

        var denyBtn = overlay.querySelector('#si-deny');
        if (denyBtn) denyBtn.addEventListener('click', function () { adminSetClaimStatus('Denied'); });

        var paidBtn = overlay.querySelector('#si-paid');
        if (paidBtn) paidBtn.addEventListener('click', function () { adminSetClaimStatus('Paid'); });
    }

    function openOverlay() {
        ensureMounted();
        if (overlay) overlay.classList.add('open');
        if (backdrop) backdrop.classList.add('open');
    }

    function closeOverlay() {
        if (overlay) overlay.classList.remove('open');
        if (backdrop) backdrop.classList.remove('open');
    }

    function renderOverlay() {
        ensureMounted();
        if (!overlay) return;

        var body = renderOverview();
        if (activeTab === 'plans') body = renderPlans();
        if (activeTab === 'claims') body = renderClaims();
        if (activeTab === 'settings') body = renderSettings();

        overlay.innerHTML = ''
            + '<div class="si-head">'
            + '<div><div class="si-title">Sinners Insurance</div><div class="si-sub">thin classic panel</div></div>'
            + '<button id="si-close-btn" class="si-close" type="button">×</button>'
            + '</div>'
            + '<div class="si-tabs">'
            + '<button class="si-tab ' + (activeTab === 'overview' ? 'active' : '') + '" data-tab="overview">Overview</button>'
            + '<button class="si-tab ' + (activeTab === 'plans' ? 'active' : '') + '" data-tab="plans">Plans</button>'
            + '<button class="si-tab ' + (activeTab === 'claims' ? 'active' : '') + '" data-tab="claims">Claims</button>'
            + '<button class="si-tab ' + (activeTab === 'settings' ? 'active' : '') + '" data-tab="settings">Settings</button>'
            + '</div>'
            + '<div class="si-body">' + body + '</div>';

        bindEvents();
    }

    function addStyles() {
        if (document.getElementById('si-pda-style-flag')) return;
        GM_addStyle(`
#si-pda-launcher{position:fixed!important;left:10px!important;bottom:10px!important;z-index:2147483647!important;width:132px!important;height:34px!important;display:flex!important;align-items:center!important;justify-content:center!important;}
#si-pda-launcher button{width:132px!important;height:34px!important;border-radius:10px!important;border:1px solid rgba(205,164,74,.5)!important;background:linear-gradient(180deg,rgba(90,12,18,.95),rgba(35,8,10,.98))!important;color:#f5df9d!important;font-size:11px!important;font-weight:800!important;letter-spacing:.2px!important;box-shadow:0 8px 20px rgba(0,0,0,.35)!important;}
#si-pda-backdrop{position:fixed!important;inset:0!important;background:rgba(0,0,0,.62)!important;z-index:2147483645!important;display:none!important;}
#si-pda-backdrop.open{display:block!important;}
#si-pda-overlay{position:fixed!important;left:10px!important;right:10px!important;top:78px!important;bottom:84px!important;z-index:2147483646!important;display:none!important;flex-direction:column!important;overflow:hidden!important;border-radius:14px!important;border:1px solid rgba(201,162,80,.22)!important;background:linear-gradient(180deg,rgba(28,10,14,.99),rgba(8,5,8,.99))!important;color:#f7ead0!important;box-shadow:0 20px 55px rgba(0,0,0,.55)!important;}
#si-pda-overlay.open{display:flex!important;}
#si-pda-overlay .si-head{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;padding:10px 12px!important;border-bottom:1px solid rgba(201,162,80,.18)!important;}
#si-pda-overlay .si-title{font-size:14px!important;font-weight:900!important;color:#f2de9f!important;text-transform:uppercase!important;}
#si-pda-overlay .si-sub{font-size:10px!important;color:rgba(241,223,171,.78)!important;text-transform:uppercase!important;}
#si-pda-overlay .si-close{width:40px!important;height:40px!important;border-radius:10px!important;border:1px solid rgba(201,162,80,.22)!important;background:linear-gradient(180deg,rgba(72,14,18,.96),rgba(24,7,10,.98))!important;color:#f2de9f!important;font-size:22px!important;}
#si-pda-overlay .si-tabs{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:5px!important;padding:8px 8px 0!important;}
#si-pda-overlay .si-tab{min-height:32px!important;border-radius:9px!important;border:1px solid rgba(201,162,80,.16)!important;background:linear-gradient(180deg,rgba(60,12,16,.85),rgba(24,7,10,.92))!important;color:#f1dfab!important;font-size:10px!important;font-weight:800!important;}
#si-pda-overlay .si-tab.active{background:linear-gradient(180deg,rgba(124,19,26,.95),rgba(64,10,15,.98))!important;}
#si-pda-overlay .si-body{overflow:auto!important;padding:8px!important;display:grid!important;gap:8px!important;}
#si-pda-overlay .si-card{border-radius:12px!important;border:1px solid rgba(201,162,80,.14)!important;background:rgba(255,255,255,.03)!important;padding:10px!important;}
#si-pda-overlay .si-card-title{font-size:11px!important;font-weight:900!important;color:#f0dd9f!important;text-transform:uppercase!important;margin-bottom:8px!important;}
#si-pda-overlay .si-grid3{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important;}
#si-pda-overlay .si-tile{border-radius:10px!important;padding:10px!important;background:rgba(255,255,255,.02)!important;border:1px solid rgba(201,162,80,.12)!important;text-align:center!important;}
#si-pda-overlay .si-tile-num{font-size:16px!important;font-weight:900!important;color:#f7e4a7!important;}
#si-pda-overlay .si-tile-label{font-size:10px!important;font-weight:800!important;color:rgba(241,223,171,.76)!important;text-transform:uppercase!important;}
#si-pda-overlay .si-row{display:flex!important;justify-content:space-between!important;gap:10px!important;padding:7px 0!important;border-bottom:1px solid rgba(201,162,80,.08)!important;}
#si-pda-overlay .si-label{color:#f2de9f!important;font-weight:800!important;font-size:11px!important;text-transform:uppercase!important;}
#si-pda-overlay .si-text{font-size:13px!important;line-height:1.45!important;color:#f8f0dd!important;}
#si-pda-overlay .si-plan-head{display:flex!important;justify-content:space-between!important;gap:10px!important;align-items:center!important;margin-bottom:10px!important;}
#si-pda-overlay .si-plan-name{font-size:14px!important;font-weight:900!important;color:#f2de9f!important;text-transform:uppercase!important;}
#si-pda-overlay .si-badge,#si-pda-overlay .si-status{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:28px!important;padding:0 10px!important;border-radius:999px!important;border:1px solid rgba(201,162,80,.18)!important;background:rgba(119,17,22,.22)!important;color:#f1dfab!important;font-size:11px!important;font-weight:900!important;}
#si-pda-overlay .si-stat-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;margin-bottom:10px!important;}
#si-pda-overlay .si-stat{border-radius:10px!important;padding:8px!important;background:rgba(255,255,255,.02)!important;border:1px solid rgba(201,162,80,.12)!important;}
#si-pda-overlay .si-stat-k{font-size:10px!important;font-weight:800!important;color:rgba(241,223,171,.72)!important;text-transform:uppercase!important;margin-bottom:4px!important;}
#si-pda-overlay .si-stat-v{font-size:12px!important;font-weight:800!important;color:#f8f0dd!important;}
#si-pda-overlay .si-btnrow,#si-pda-overlay .si-btnstack{display:flex!important;flex-wrap:wrap!important;gap:8px!important;}
#si-pda-overlay .si-btnstack{display:grid!important;grid-template-columns:1fr!important;}
#si-pda-overlay .si-btn{min-height:40px!important;padding:0 12px!important;border-radius:10px!important;border:1px solid rgba(201,162,80,.24)!important;background:linear-gradient(180deg,rgba(124,19,26,.95),rgba(64,10,15,.98))!important;color:#f7e4a7!important;font-size:11px!important;font-weight:900!important;text-transform:uppercase!important;}
#si-pda-overlay .si-btn.alt{background:linear-gradient(180deg,rgba(60,12,16,.92),rgba(24,7,10,.96))!important;}
#si-pda-overlay .si-btn.good{background:linear-gradient(180deg,rgba(20,112,58,.94),rgba(12,66,34,.98))!important;}
#si-pda-overlay .si-btn.bad{background:linear-gradient(180deg,rgba(120,26,32,.94),rgba(70,12,18,.98))!important;}
#si-pda-overlay .si-field{display:grid!important;gap:6px!important;margin-bottom:10px!important;}
#si-pda-overlay .si-field label{font-size:11px!important;font-weight:800!important;color:#f2de9f!important;text-transform:uppercase!important;}
#si-pda-overlay .si-input,#si-pda-overlay .si-textarea{width:100%!important;box-sizing:border-box!important;border-radius:10px!important;border:1px solid rgba(201,162,80,.18)!important;background:rgba(255,255,255,.04)!important;color:#f8f0dd!important;padding:11px!important;font-size:14px!important;}
#si-pda-overlay .si-textarea{min-height:92px!important;resize:none!important;}
#si-pda-overlay .si-history-item{border-radius:10px!important;background:rgba(255,255,255,.02)!important;border:1px solid rgba(201,162,80,.10)!important;padding:10px!important;margin-bottom:8px!important;}
#si-pda-overlay .si-history-at{font-size:10px!important;color:rgba(241,223,171,.72)!important;margin-bottom:4px!important;}
#si-pda-overlay .si-wrath-wrap{display:grid!important;gap:8px!important;margin:8px 0!important;}
#si-pda-overlay .si-wrath-stage{border-radius:10px!important;padding:8px!important;background:rgba(255,255,255,.02)!important;border:1px solid rgba(201,162,80,.12)!important;}
#si-pda-overlay .si-wrath-title{font-size:11px!important;font-weight:900!important;color:#f7e4a7!important;text-transform:uppercase!important;margin-bottom:6px!important;}
`);
        var flag = document.createElement('div');
        flag.id = 'si-pda-style-flag';
        flag.style.display = 'none';
        document.documentElement.appendChild(flag);
    }

    function ensureMounted() {
        addStyles();

        if (!document.body) return;

        if (!backdrop || !document.body.contains(backdrop)) {
            backdrop = document.createElement('div');
            backdrop.id = 'si-pda-backdrop';
            backdrop.addEventListener('click', closeOverlay);
            document.body.appendChild(backdrop);
        }

        if (!overlay || !document.body.contains(overlay)) {
            overlay = document.createElement('div');
            overlay.id = 'si-pda-overlay';
            document.body.appendChild(overlay);
        }

        if (!launcher || !document.body.contains(launcher)) {
            launcher = document.createElement('div');
            launcher.id = 'si-pda-launcher';
            launcher.innerHTML = '<button type="button">💊 Sinners</button>';
            document.body.appendChild(launcher);
            var btn = launcher.querySelector('button');
            if (btn) btn.addEventListener('click', openOverlay);
        }
    }

    function boot() {
        ensureMounted();
        ensureCoverageTimer();
        renderOverlay();
        if (syncSecret) fetchWarTabState();
        if (isCoverageActive()) runCoverageScan();
        if (!remountTimer) {
            remountTimer = setInterval(function () {
                if (!document.body) return;
                ensureMounted();
            }, 2000);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
