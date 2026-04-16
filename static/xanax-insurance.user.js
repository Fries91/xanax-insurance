// ==UserScript==
// @name         Sinner's Insurance 7DS
// @namespace    fries91-xanax-insurance
// @version      4.0.2
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

    var activeTab = gv('si_active_tab', 'rules');
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
    var finVerifiedXanax = Number(gv('si_fin_verified_xanax', 0) || 0);
    var finFactionCut = Number(gv('si_fin_faction_cut', 0) || 0);
    var finPool = Number(gv('si_fin_pool', 0) || 0);
    var finReceiptCount = Number(gv('si_fin_receipt_count', 0) || 0);
    var finMemberPayCount = Number(gv('si_fin_member_pay_count', 0) || 0);
    var finPayoutCount = Number(gv('si_fin_payout_count', 0) || 0);
    var financeLoading = false;
    var adminApiKey = gv('si_admin_api_key', '');
    var memberApiKey = gv('si_member_api_key', '');
    var singleApiKey = gv('si_single_api_key', gv('si_member_api_key', ''));
    var factionIdLock = gv('si_faction_id_lock', '49384');
    var authMode = gv('si_auth_mode', 'local');
    var settingsNotice = gv('si_settings_notice', 'Waiting for API key save or login.');
    var autoLoginTriedAt = gv('si_auto_login_tried_at', '');
    var autoLoginBusy = false;
    var xanaxRequestTotalOwed = Number(gv('si_xr_total_owed', 0) || 0);
    var xanaxRequestRequested = !!gv('si_xr_requested', 0);
    var xanaxRequestRequestedAt = gv('si_xr_requested_at', '');
    var xanaxRequestRequestedBy = gv('si_xr_requested_by', '');
    var xanaxRequestSentAt = gv('si_xr_sent_at', '');
    var xanaxRequestSentBy = gv('si_xr_sent_by', '');
    var xanaxRequestResetAt = gv('si_xr_reset_at', '');
    var xanaxRequestResetBy = gv('si_xr_reset_by', '');
    var xanaxRequestStatus = gv('si_xr_status', 'idle');
    var xanaxRequestViewerCanRequest = false;
    var xanaxRequestViewerIsAdmin = false;
    var alertUnreadClaims = Number(gv('si_alert_unread_claims', 0) || 0);
    var alertPendingActivations = Number(gv('si_alert_pending_activations', 0) || 0);
    var activationsDb = gv('si_activations_db', '[]');
    var selectedActivationId = gv('si_selected_activation_id', '');
    var activationNotice = gv('si_activation_notice', '');

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
            payment: '1 Xanax',
            window: '30 mins',
            payout: '6 Xanax',
            stackType: 'any',
            rule: 'Can start with any amount of energy.',
            oldRows: [
                ['Coverage', '6 Xanax'],
                ['Payment', '2 Xanax'],
                ['Window', '30 mins'],
                ['Payout', 'Up to 6 Xanax']
            ]
        },
        {
            name: 'Envy',
            coverage: '25 Xanax + 3 E-DVD',
            payment: '5 Xanax',
            window: '30 mins',
            payout: '10 Xanax + 2 E-DVD',
            stackType: 'mixed',
            rule: 'Use for approved Envy claims only.',
            oldRows: [
                ['Coverage', '25 Xanax + 3 E-DVD'],
                ['Payment', '5 Xanax'],
                ['Window', '30 mins'],
                ['Payout', 'Plan review']
            ]
        },
        {
            name: 'Wrath',
            coverage: 'Stage based',
            payment: '2 Xanax each stage',
            window: '30 mins each stage',
            payout: '4 / 5 / 6 / 8 Xanax',
            stackType: 'xanax',
            rule: 'Each stage has a required starting energy amount and must be armed on the matching stage.',
            stages: [
                { stage: 'Stage 1', coverage: '5 Xanax', payment: '2 Xanax', payout: '4 Xanax', terms: 'Start at 0 energy', window: '30 mins' },
                { stage: 'Stage 2', coverage: '10 Xanax', payment: '2 Xanax', payout: '5 Xanax', terms: 'Start at 250 energy', window: '30 mins' },
                { stage: 'Stage 3', coverage: '15 Xanax', payment: '2 Xanax', payout: '6 Xanax', terms: 'Start at 500 energy', window: '30 mins' },
                { stage: 'Stage 4', coverage: '20 Xanax', payment: '2 Xanax', payout: '8 Xanax', terms: 'Start at 750 energy', window: '30 mins' }
            ],
            oldRows: [
                ['Coverage', 'Stage based'],
                ['Payment', '2 Xanax each stage'],
                ['Window', '30 mins each stage'],
                ['Payout', '5 / 10 / 15 / 20 Xanax']
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
        sv('si_fin_verified_xanax', finVerifiedXanax || 0);
        sv('si_fin_faction_cut', finFactionCut || 0);
        sv('si_fin_pool', finPool || 0);
        sv('si_fin_receipt_count', finReceiptCount || 0);
        sv('si_fin_member_pay_count', finMemberPayCount || 0);
        sv('si_fin_payout_count', finPayoutCount || 0);
        sv('si_admin_api_key', adminApiKey || '');
        sv('si_member_api_key', memberApiKey || '');
        sv('si_single_api_key', singleApiKey || '');
        sv('si_faction_id_lock', factionIdLock || '');
        sv('si_auth_mode', authMode || 'local');
        sv('si_settings_notice', settingsNotice || '');
        sv('si_auto_login_tried_at', autoLoginTriedAt || '');
        sv('si_xr_total_owed', xanaxRequestTotalOwed || 0);
        sv('si_xr_requested', xanaxRequestRequested ? 1 : 0);
        sv('si_xr_requested_at', xanaxRequestRequestedAt || '');
        sv('si_xr_requested_by', xanaxRequestRequestedBy || '');
        sv('si_xr_sent_at', xanaxRequestSentAt || '');
        sv('si_xr_sent_by', xanaxRequestSentBy || '');
        sv('si_xr_reset_at', xanaxRequestResetAt || '');
        sv('si_xr_reset_by', xanaxRequestResetBy || '');
        sv('si_xr_status', xanaxRequestStatus || 'idle');
        sv('si_alert_unread_claims', alertUnreadClaims || 0);
        sv('si_alert_pending_activations', alertPendingActivations || 0);
        sv('si_activations_db', activationsDb || '[]');
        sv('si_selected_activation_id', selectedActivationId || '');
        sv('si_activation_notice', activationNotice || '');
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

    function canManageWarStackUi() {
        return sessionRole === 'admin' || sessionRole === 'leader' || sessionRole === 'co-leader';
    }

    function canSeeClaimsUi() {
        return sessionRole === 'admin';
    }

    function canSeeActivationsUi() {
        return sessionRole === 'admin';
    }

    function canSeeXanaxRequestUi() {
        return sessionRole === 'admin' || sessionRole === 'leader';
    }

    function maskApiKeyForDisplay(value) {
        var v = String(value || '');
        if (!v) return '';
        if (v.length <= 4) return '****';
        return Array(Math.max(4, v.length - 4) + 1).join('*') + v.slice(-4);
    }

    function getPlanByName(name) {
        return PLANS.find(function (p) { return p.name === name; }) || null;
    }

    function getPlanRuleText(name) {
        var p = getPlanByName(name);
        return p ? p.rule : 'No plan selected.';
    }

    function getGreedPlanData() {
        return {
            name: 'Greed',
            coverage: '1 Feathery Hotel Coupon',
            payment: '2 Xanax',
            window: '30 mins',
            payout: '1 Feathery Hotel Coupon',
            terms: [
                'Greed Terms:',
                'Any energy.',
                'Payment: 1 Xanax.',
                'Payout: 1 Feathery Hotel Coupon.',
                'Window: 30 mins.',
                'Only available when War Stack is activated.'
            ].join('\n')
        };
    }

    function getDetailedPlanTerms(name) {
        var p = getPlanByName(name);
        if (!p) return 'No plan selected.';
        if (name === 'Wrath' && p.stages && p.stages.length) {
            return [
                'Wrath Terms:',
                'Window: 30 mins for every stage.',
                'Payment: 2 Xanax per stage.',
                'Stage 1 payout: 4 Xanax | Terms: Start at 0 energy.',
                'Stage 2 payout: 5 Xanax | Terms: Start at 250 energy.',
                'Stage 3 payout: 6 Xanax | Terms: Start at 500 energy.',
                'Stage 4 payout: 8 Xanax | Terms: Start at 750 energy.'
            ].join('\n');
        }
        if (name === 'Envy') {
            return [
                'Envy Terms:',
                'Use for approved Envy claims only.',
                'Must start with 1000 energy.',
                'Must start with 0 booster cool down.',
                'Can use Wrath for stack.',
                'Payout: 10 Xanax + 2 E-DVD.',
                'Payment: 5 Xanax.',
                'Window: 30 mins.'
            ].join('\n');
        }
        if (name === 'Pride') {
            return [
                'Pride Terms:',
                'Payout: 6 Xanax.',
                'Payment: 1 Xanax.',
                'Window: 30 mins.',
                p.rule
            ].join('\n');
        }
        return p.rule;
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
            var p = getPlanByName(name);
            if (p && p.stages) {
                var s = p.stages.find(function (x) { return x.stage === stageName; }) || p.stages[0];
                if (s) return 'Wrath active - ' + s.stage + '. ' + s.terms + '.';
            }
            return 'Wrath active.';
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

        var payment = getRequiredPaymentForPlan(name, stageName);
        var paymentNote = window.prompt('Enter payment sent note / proof for ' + name + (stageName ? ' ' + stageName : '') + '\nRequired: ' + payment.qty + ' ' + payment.item, '') || '';

        var now = new Date();
        var mins = getPlanWindowMinutes(name, stageName);
        var expiry = new Date(now.getTime() + (mins * 60000));

        selectedPlan = name;
        activeCoverageEnabled = true;
        activeCoveragePlan = name;
        activeCoverageStage = stageName || '';
        activeCoverageArmedAt = now.toISOString();
        activeCoverageExpiresAt = expiry.toISOString();
        activeCoverageDetectStatus = 'armed-pending-verification';
        activeCoverageLastCheckAt = '';
        activeCoverageLastEventKey = '';
        activeCoverageLastClaimId = '';
        activeCoverageAutoSubmittedAt = '';
        activeCoverageArmedEnergy = '';
        activeCoverageArmedBoosterCd = '';
        activeCoverageRuleCheck = getPlanRuleForActivation(name, stageName);

        var activationId = makeActivationId();
        activationNotice = 'Activation requested. Waiting for admin payment verification.';
        upsertActivationLocal({
            id: activationId,
            member: sessionName || 'Member',
            memberId: '',
            plan: name,
            stage: stageName || '',
            status: 'Pending verification',
            requiredPaymentItem: payment.item,
            requiredPaymentQty: payment.qty,
            paymentNote: paymentNote,
            memberPaymentVerified: 0,
            adminReceiptVerified: 0,
            reviewedBy: '',
            reviewNote: '',
            createdAt: now.toISOString(),
            updatedAt: now.toISOString()
        });
        saveSession();
        renderOverlay();
        maybeAutoLogin(false);
        pushActivation('member_request', {
            id: activationId,
            plan: name,
            stage: stageName || '',
            paymentNote: paymentNote
        });
        window.alert(name + (stageName ? ' ' + stageName : '') + ' armed for ' + mins + ' minutes. Verification request sent to admin.');
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


    function getActivationsDbItems() {
        try {
            var arr = JSON.parse(activationsDb || '[]');
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            return [];
        }
    }

    function saveActivationsDbItems(arr) {
        activationsDb = JSON.stringify(Array.isArray(arr) ? arr : []);
        saveSession();
    }

    function makeActivationId() {
        return 'ACT-' + String(Date.now()).slice(-8);
    }

    function getRequiredPaymentForPlan(name, stageName) {
        var plan = String(name || '').toLowerCase();
        if (plan === 'pride') return { item: 'Xanax', qty: '2' };
        if (plan === 'envy') return { item: 'Xanax', qty: '5' };
        if (plan === 'wrath') return { item: 'Xanax', qty: '2' };
        if (plan === 'greed') return { item: 'Xanax', qty: '1' };
        return { item: 'Xanax', qty: '0' };
    }

    function upsertActivationLocal(rec) {
        var items = getActivationsDbItems();
        var idx = items.findIndex(function (x) { return x && x.id === rec.id; });
        if (idx >= 0) items[idx] = rec; else items.unshift(rec);
        selectedActivationId = rec.id || selectedActivationId;
        saveActivationsDbItems(items.slice(0, 100));
    }

    function fetchAlertsState() {
        if (!syncSecret) return Promise.resolve(null);
        return apiRequest('POST', '/api/alerts/state', { secret: syncSecret, auth: buildServerAuthPayload() }).then(function (data) {
            var st = data && data.state;
            if (st) {
                alertUnreadClaims = Number(st.unreadClaims || 0);
                alertPendingActivations = Number(st.pendingActivations || 0);
                saveSession();
                renderOverlay();
            }
            return data;
        }).catch(function () { return null; });
    }

    function fetchActivations() {
        if (!syncSecret) return Promise.resolve(null);
        return apiRequest('POST', '/api/activations/pull', { secret: syncSecret, auth: buildServerAuthPayload() }).then(function (data) {
            if (data && Array.isArray(data.activations)) {
                saveActivationsDbItems(data.activations);
                if (!selectedActivationId && data.activations.length) selectedActivationId = data.activations[0].id || '';
                fetchAlertsState();
                renderOverlay();
            }
            return data;
        }).catch(function () { return null; });
    }

    function pushActivation(action, activation) {
        return apiRequest('POST', '/api/activations/push', {
            secret: syncSecret,
            action: action,
            auth: buildServerAuthPayload(),
            activation: activation || {}
        }).then(function (data) {
            if (data && data.activation) {
                upsertActivationLocal(data.activation);
                fetchAlertsState();
                renderOverlay();
            }
            return data;
        }).catch(function () { return null; });
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

    function getRecentMemberClaims(limit) {
        limit = Number(limit || 5) || 5;
        var name = String(sessionName || '').toLowerCase();
        return getClaimsDbItems()
            .filter(function (item) {
                return item && String(item.member || '').toLowerCase() === name;
            })
            .slice(0, limit);
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


    function fetchFinancialSummary() {
        if (!syncSecret || financeLoading) return Promise.resolve(null);
        financeLoading = true;
        return apiRequest('POST', '/api/overview/financial-summary', {
            secret: syncSecret,
            auth: buildServerAuthPayload()
        }).then(function (data) {
            financeLoading = false;
            var summary = data && data.summary;
            if (summary) {
                finVerifiedXanax = Number(summary.verified_xanax_in || 0);
                finFactionCut = Number(summary.faction_cut_xanax || 0);
                finPool = Number(summary.insurance_pool_xanax || 0);
                finReceiptCount = Number(summary.verified_receipts_count || 0);
                finMemberPayCount = Number(summary.member_payment_verified_count || 0);
                finPayoutCount = Number(summary.admin_payout_verified_count || 0);
                backendStatus = 'Payments loaded';
                lastSyncAt = new Date().toLocaleString();
                saveSession();
                renderOverlay();
            }
            return data;
        }).catch(function () {
            financeLoading = false;
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
                warTabUpdatedBy = state.updatedAt ? (state.updatedBy || '') : (state.updatedBy || '');
                warTabViewerCanManage = !!state.viewerCanManage;
                if (!warTabEnabled && activeTab === 'war_stack') activeTab = 'overview';
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
                if (!warTabEnabled && activeTab === 'war_stack') activeTab = 'overview';
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

    function finishLoginSuccess(user, roleLabel) {
        sessionRole = (user && user.role) ? user.role : (roleLabel || 'member');
        sessionName = (user && user.name) ? user.name : 'Member';
        authMode = 'backend';
        backendStatus = roleLabel === 'admin' ? 'Admin login ok' : 'Member login ok';
        settingsNotice = 'Login successful. Signed in as ' + sessionName + '.';
        lastSyncAt = new Date().toLocaleString();
        autoLoginTriedAt = new Date().toISOString();
        saveSession();
        renderOverlay();
        if (typeof touchScriptUsage === 'function') touchScriptUsage();
        if (typeof fetchWarTabState === 'function') fetchWarTabState();
        if (typeof fetchFinancialSummary === 'function') fetchFinancialSummary();
        if (typeof fetchUsageSummary === 'function') fetchUsageSummary();
        if (typeof fetchXanaxRequestState === 'function') fetchXanaxRequestState();
        if (typeof syncClaimsFromBackend === 'function') syncClaimsFromBackend();
        if (typeof fetchAlerts === 'function') fetchAlerts();
        if (typeof fetchActivations === 'function') fetchActivations();
    }

    function tryBackendLoginSilently() {
        if (!singleApiKey || autoLoginBusy) return Promise.resolve(false);
        autoLoginBusy = true;

        return apiRequest('POST', '/api/auth/admin-key-login', {
            secret: syncSecret,
            api_key: singleApiKey
        }).then(function (data) {
            if (data && data.ok && data.user) {
                finishLoginSuccess(data.user, 'admin');
                autoLoginBusy = false;
                return true;
            }
            return apiRequest('POST', '/api/auth/faction-login', {
                secret: syncSecret,
                api_key: singleApiKey,
                faction_id: factionIdLock
            }).then(function (memberData) {
                if (memberData && memberData.ok && memberData.user) {
                    finishLoginSuccess(memberData.user, 'member');
                    autoLoginBusy = false;
                    return true;
                }
                autoLoginBusy = false;
                return false;
            });
        }).catch(function () {
            autoLoginBusy = false;
            return false;
        });
    }

    function maybeAutoLogin(force) {
        if (!singleApiKey) return Promise.resolve(false);
        if (sessionRole !== 'guest' && !force) return Promise.resolve(true);

        var now = Date.now();
        var lastTry = Date.parse(String(autoLoginTriedAt || '')) || 0;
        if (!force && lastTry && (now - lastTry) < 15000) {
            return Promise.resolve(false);
        }

        autoLoginTriedAt = new Date().toISOString();
        saveSession();
        return tryBackendLoginSilently();
    }

    function singleBackendLogin() {
        if (!apiBase || !syncSecret || !singleApiKey) {
            window.alert('Enter your Torn API key first.');
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
                settingsNotice = 'Login successful. Signed in as admin.';
                lastSyncAt = new Date().toLocaleString();
                saveSession();
                renderOverlay();
                fetchWarTabState();
                fetchFinancialSummary();
                fetchXanaxRequestState();
                fetchAlertsState();
                fetchActivations();
                syncClaimsFromBackend();
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
                    settingsNotice = 'Login successful. Signed in as ' + (memberData.user.name || 'Member') + '.';
                    lastSyncAt = new Date().toLocaleString();
                    saveSession();
                    renderOverlay();
                    fetchWarTabState();
                    fetchFinancialSummary();
                    syncClaimsFromBackend();
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
        settingsNotice = 'Logged out.';
        saveSession();
        renderOverlay();
    }

    function selectPlan(name) {
        selectedPlan = name;
        saveSession();
        renderOverlay();
    }

    function showPlanTerms(name) {
        window.alert(getDetailedPlanTerms(name));
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


    function fetchXanaxRequestState() {
        if (!syncSecret) return Promise.resolve(null);
        return apiRequest('POST', '/api/xanax-request/state', {
            secret: syncSecret,
            auth: buildServerAuthPayload()
        }).then(function (data) {
            var state = data && data.state;
            if (state) {
                xanaxRequestTotalOwed = Number(state.totalOwed || 0);
                xanaxRequestRequested = !!state.requested;
                xanaxRequestRequestedAt = state.requestedAt || '';
                xanaxRequestRequestedBy = state.requestedBy || '';
                xanaxRequestSentAt = state.sentAt || '';
                xanaxRequestSentBy = state.sentBy || '';
                xanaxRequestResetAt = state.resetAt || '';
                xanaxRequestResetBy = state.resetBy || '';
                xanaxRequestStatus = state.status || 'idle';
                xanaxRequestViewerCanRequest = !!state.viewerCanRequest;
                xanaxRequestViewerIsAdmin = !!state.viewerIsAdmin;
                saveSession();
                renderOverlay();
            }
            return data;
        }).catch(function () { return null; });
    }

    function requestXanaxCut() {
        return apiRequest('POST', '/api/xanax-request/request', {
            secret: syncSecret,
            auth: buildServerAuthPayload()
        }).then(function (data) {
            if (data && data.state) {
                window.alert('Faction cut request sent to admin.');
                return fetchXanaxRequestState();
            }
            window.alert((data && data.error) ? data.error : 'Request failed.');
            return data;
        }).catch(function () {
            window.alert('Request failed.');
            return null;
        });
    }

    function markXanaxCutSent() {
        return apiRequest('POST', '/api/xanax-request/mark-sent', {
            secret: syncSecret,
            auth: buildServerAuthPayload()
        }).then(function (data) {
            if (data && data.state) {
                window.alert('Faction cut marked as sent.');
                return fetchXanaxRequestState();
            }
            window.alert((data && data.error) ? data.error : 'Mark sent failed.');
            return data;
        }).catch(function () {
            window.alert('Mark sent failed.');
            return null;
        });
    }

    function resetXanaxCutTotal() {
        return apiRequest('POST', '/api/xanax-request/reset', {
            secret: syncSecret,
            auth: buildServerAuthPayload()
        }).then(function (data) {
            if (data && data.state) {
                window.alert('Faction cut total reset.');
                return fetchXanaxRequestState();
            }
            window.alert((data && data.error) ? data.error : 'Reset failed.');
            return data;
        }).catch(function () {
            window.alert('Reset failed.');
            return null;
        });
    }

    function renderXanaxRequest() {
        var requestBtn = xanaxRequestViewerCanRequest
            ? '<div class="si-btnrow"><button id="si-xr-request" class="si-btn good">Request 15% Faction Cut</button></div>'
            : '<div class="si-text">Leader and Co-Leader can request the faction cut. Admin can send and reset it.</div>';

        var adminBtns = xanaxRequestViewerIsAdmin
            ? '<div class="si-btnrow"><button id="si-xr-sent" class="si-btn">Mark Sent</button><button id="si-xr-reset" class="si-btn alt">Reset Total Owed</button></div>'
            : '';

        return card('Xanax Request',
            '<div class="si-row"><span class="si-label">Total Owed</span><span>' + esc(xanaxRequestTotalOwed + ' Xanax') + '</span></div>'
            + '<div class="si-row"><span class="si-label">Status</span><span>' + esc(xanaxRequestStatus || 'idle') + '</span></div>'
            + '<div class="si-row"><span class="si-label">Requested By</span><span>' + esc(xanaxRequestRequestedBy || 'Not requested') + '</span></div>'
            + '<div class="si-row"><span class="si-label">Requested At</span><span>' + esc(formatDateTime(xanaxRequestRequestedAt)) + '</span></div>'
            + '<div class="si-row"><span class="si-label">Sent By</span><span>' + esc(xanaxRequestSentBy || 'Not sent') + '</span></div>'
            + '<div class="si-row"><span class="si-label">Sent At</span><span>' + esc(formatDateTime(xanaxRequestSentAt)) + '</span></div>'
            + '<div class="si-row"><span class="si-label">Last Reset By</span><span>' + esc(xanaxRequestResetBy || 'Never') + '</span></div>'
            + '<div class="si-row"><span class="si-label">Last Reset At</span><span>' + esc(formatDateTime(xanaxRequestResetAt)) + '</span></div>'
            + requestBtn
            + adminBtns
        );
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

    function renderRules() {
        return ''
            + card('Rules',
                '<div class="si-text">1. Save your Torn API key in Settings and log in first.</div>'
                + '<div class="si-text">2. Use only the correct plan for the stack or situation you are covering.</div>'
                + '<div class="si-text">3. Make sure the required payment is sent for the plan before relying on coverage.</div>'
                + '<div class="si-text">4. Read the plan Terms button carefully before activating any plan or Wrath stage.</div>'
                + '<div class="si-text">5. If War Stack is active, only use War Stack plans inside that tab.</div>'
                + '<div class="si-text">6. False, misleading, or rule-breaking claims can be denied.</div>'
                + '<div class="si-text">7. Payout is only final after admin review and verification.</div>')
            + card('How To Use It Properly To Receive Payment If You OD',
                '<div class="si-text">Step 1: Open Settings, save your Torn API key, and log in.</div>'
                + '<div class="si-text">Step 2: Go to Plans and choose the correct plan for what you are doing.</div>'
                + '<div class="si-text">Step 3: Read the Terms button for that plan and make sure you match its rules.</div>'
                + '<div class="si-text">Step 4: Activate the plan or the correct Wrath stage before you start.</div>'
                + '<div class="si-text">Step 5: Stay within the active coverage window shown by the script.</div>'
                + '<div class="si-text">Step 6: If an OD happens during the active window, the system can create a pending claim for review.</div>'
                + '<div class="si-text">Step 7: Admin reviews the claim, payment proof, and plan rules before payout is approved.</div>')
            + card('How It Works',
                '<div class="si-text">Sinner\'s Insurance lets members log in with one Torn API key, activate a plan, and run a timed coverage window.</div>'
                + '<div class="si-text">During an active window, the script checks for OD-style events and can submit a pending claim automatically.</div>'
                + '<div class="si-text">Claims, payment checks, admin review, War Stack controls, and faction request tools are all managed through the overlay and backend.</div>'
                + '<div class="si-text">Different plans have different payment, coverage, payout, and terms rules, so always follow the exact plan requirements.</div>');
    }

    function renderOverview() {
        var financeTiles = '<div class="si-tiles">'
            + tile(finReceiptCount, 'Claims')
            + tile(finFactionCut + 'x', 'Faction Cut')
            + tile(finPayoutCount, 'Payouts Verified')
            + '</div>';

        var financeCard = card('Insurance Overview',
            financeTiles
            + '<div class="si-row"><span class="si-label">Faction Cut</span><span>' + esc(finFactionCut + ' Xanax') + '</span></div>'
            + '<div class="si-row"><span class="si-label">Member Payments Verified</span><span>' + esc(finMemberPayCount) + '</span></div>'
            + '<div class="si-row"><span class="si-label">Admin Payouts Verified</span><span>' + esc(finPayoutCount) + '</span></div>'
        );

        var adminAlerts = isAdmin()
            ? card('Admin Alerts',
                '<div class="si-row"><span class="si-label">Unread Claims</span><span>' + esc(alertUnreadClaims) + '</span></div>'
                + '<div class="si-row"><span class="si-label">Pending Activations</span><span>' + esc(alertPendingActivations) + '</span></div>')
            : '';

        var coverageInfo = '';
        if (activeCoveragePlan) {
            coverageInfo = card('Active Coverage',
                '<div class="si-row"><span class="si-label">Plan</span><span>' + esc(activeCoveragePlan || 'None') + '</span></div>'
                + '<div class="si-row"><span class="si-label">Stage</span><span>' + esc(activeCoverageStage || '-') + '</span></div>'
                + '<div class="si-row"><span class="si-label">Payout</span><span>' + esc(getPlanPayoutText(activeCoveragePlan, activeCoverageStage) || '-') + '</span></div>'
                + '<div class="si-row"><span class="si-label">Status</span><span class="si-badge">' + esc(isCoverageActive() ? 'Active' : (activeCoverageDetectStatus || 'Idle')) + '</span></div>'
                + '<div class="si-row"><span class="si-label">Expires</span><span>' + esc(formatDateTime(activeCoverageExpiresAt)) + '</span></div>'
                + '<div class="si-row"><span class="si-label">Remaining</span><span>' + esc(isCoverageActive() ? formatRemaining(currentCoverageRemainingMs()) : 'Not active') + '</span></div>'
            );
        }

        var warStackCard = canManageWarStackUi() ? renderWarStackControls() : '';

        return financeCard + adminAlerts + coverageInfo + warStackCard;
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
                            + '<div class="si-row"><span class="si-label">Terms</span><span>' + esc(s.terms) + '</span></div>'
                            + '<div class="si-row"><span class="si-label">Window</span><span>' + esc(s.window) + '</span></div>'
                            + '<div class="si-btnrow">'
                                + '<button class="si-btn" data-action="select-stage" data-plan="' + esc(p.name) + '" data-stage="' + esc(s.stage) + '">Select ' + esc(s.stage) + '</button>'
                                + '<button class="si-btn good" data-action="arm-stage" data-plan="' + esc(p.name) + '" data-stage="' + esc(s.stage) + '">Activate ' + esc(s.stage) + '</button>'
                            + '</div>'
                        + '</div>';
                    }).join('')
                    + '</div>';
            }

            var buttonRow = '<div class="si-btnrow">'
                + '<button class="si-btn" data-action="select-plan" data-plan="' + esc(p.name) + '">Select</button>'
                + ((p.name === 'Pride' || p.name === 'Envy')
                    ? '<button class="si-btn good" data-action="arm-plan" data-plan="' + esc(p.name) + '">Activate</button>'
                    : '')
                + '<button class="si-btn alt" data-action="terms-plan" data-plan="' + esc(p.name) + '">Terms</button>'
                + '</div>';

            return card(p.name, rows + wrathStages + buttonRow);
        }).join('');
    }

    function renderClaims() {
        if (!isAdmin()) {
            var recent = getRecentMemberClaims(6);
            return card('Your Recent Claims',
                recent.length ? recent.map(function (item) {
                    return '<div class="si-history-item">'
                        + '<div class="si-history-at">' + esc(item.updatedAt || '') + '</div>'
                        + '<div class="si-text"><strong>' + esc(item.id || '') + '</strong> | '
                        + esc(item.plan || 'None') + ' | ' + esc(item.status || 'Unknown')
                        + (item.loss ? ' | Loss: ' + esc(item.loss) : '')
                        + '</div>'
                        + (item.note ? '<div class="si-text">' + esc(item.note) + '</div>' : '')
                        + '</div>';
                }).join('') : '<div class="si-text">No recent claims yet.</div>');
        }

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
            + card('Admin Review',
                '<div class="si-field"><label>Payout</label><input id="si-payout" class="si-input" value="' + esc(payoutAmount) + '" placeholder="Payout amount"></div>'
                + '<div class="si-field"><label>Decision Note</label><textarea id="si-decision" class="si-textarea" placeholder="Admin note">' + esc(decisionNote) + '</textarea></div>'
                + '<div class="si-btnstack">'
                + '<button id="si-under-review" class="si-btn alt">Under Review</button>'
                + '<button id="si-approve" class="si-btn good">Approve</button>'
                + '<button id="si-deny" class="si-btn bad">Deny</button>'
                + '<button id="si-paid" class="si-btn">Mark Paid</button>'
                + '</div>')
            + card('Claim History',
                history.length ? history.map(function (item) {
                    return '<div class="si-history-item"><div class="si-history-at">' + esc(item.at) + '</div><div class="si-text">' + esc(item.text) + '</div></div>';
                }).join('') : '<div class="si-text">No history yet.</div>');
    }

    function renderSettings() {
        var maskedKey = maskApiKeyForDisplay(singleApiKey);
        return ''
            + card('Torn Login',
                '<div class="si-field"><label>Torn API Key</label><input id="si-single-api-key" type="password" class="si-input" value="' + esc(singleApiKey) + '" placeholder="Enter your Torn API key"></div>'
                + '<div class="si-row"><span class="si-label">Saved Key</span><span>' + esc(singleApiKey ? maskedKey : 'Not saved') + '</span></div>'
                + '<div class="si-btnrow">'
                + '<button id="si-save-settings" class="si-btn">Save API Key</button>'
                + '<button id="si-single-login" class="si-btn good">Login</button>'
                + '<button id="si-logout" class="si-btn alt">Logout</button>'
                + '</div>'
                + '<div class="si-text">Use one Torn API key to log in. After saving, the key is masked in the status display.</div>')
            + card('API Key Status',
                '<div class="si-row"><span class="si-label">Login Status</span><span>' + esc(sessionRole === 'guest' ? 'Not logged in' : ('Logged in as ' + sessionName + ' (' + sessionRole + ')')) + '</span></div>'
                + '<div class="si-text">' + esc(settingsNotice || 'Waiting for API key save or login.') + '</div>')
            + card('ToS',
                '<div class="si-text">By using Sinner\'s Insurance, you agree that coverage, activations, and claims are subject to faction rules and review. Payouts are only valid after approval and verification. False claims, false proofs, or abuse of the system may lead to denial and removal of access.</div>')
            + card('API Key Storage and Usage',
                '<div class="si-text">Your Torn API key is stored locally in userscript storage on your device. It is used only for Torn login, plan activation, OD scan checks during active windows, and syncing insurance data with the Sinner\'s Insurance backend. Keep your key private and rotate it if your device or install is no longer trusted.</div>');
    }

    function bindEvents() {
        if (!overlay) return;

        overlay.querySelectorAll('[data-tab]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                activeTab = btn.getAttribute('data-tab') || 'overview';
                saveSession();
                renderOverlay();
                if (activeTab === 'overview') {
                    fetchFinancialSummary();
                    fetchWarTabState();
                }
                if (activeTab === 'xanax_request') fetchXanaxRequestState();
                if (activeTab === 'activations') fetchActivations();
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
            singleApiKey = valueOf('#si-single-api-key') || '';
            adminApiKey = singleApiKey;
            memberApiKey = singleApiKey;
            settingsNotice = singleApiKey ? 'API key saved successfully.' : 'No API key saved yet.';
            saveSession();
            renderOverlay();
            maybeAutoLogin(true);
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

        var greedSelectBtn = overlay.querySelector('#si-greed-select');
        if (greedSelectBtn) greedSelectBtn.addEventListener('click', function () {
            selectedPlan = 'Greed';
            saveSession();
            renderOverlay();
        });

        var greedTermsBtn = overlay.querySelector('#si-greed-terms');
        if (greedTermsBtn) greedTermsBtn.addEventListener('click', function () {
            window.alert(getGreedPlanData().terms);
        });

        var xrRequestBtn = overlay.querySelector('#si-xr-request');
        if (xrRequestBtn) xrRequestBtn.addEventListener('click', requestXanaxCut);

        var xrSentBtn = overlay.querySelector('#si-xr-sent');
        if (xrSentBtn) xrSentBtn.addEventListener('click', markXanaxCutSent);

        var xrResetBtn = overlay.querySelector('#si-xr-reset');
        if (xrResetBtn) xrResetBtn.addEventListener('click', resetXanaxCutTotal);

        var refreshActivationsBtn = overlay.querySelector('#si-refresh-activations');
        if (refreshActivationsBtn) refreshActivationsBtn.addEventListener('click', fetchActivations);

        var activationSelect = overlay.querySelector('#si-activation-select');
        if (activationSelect) activationSelect.addEventListener('change', function () {
            selectedActivationId = activationSelect.value || '';
            saveSession();
            renderOverlay();
        });

        var actVerifyPaymentBtn = overlay.querySelector('#si-act-verify-payment');
        if (actVerifyPaymentBtn) actVerifyPaymentBtn.addEventListener('click', function () {
            var note = valueOf('#si-activation-admin-note') || '';
            if (!selectedActivationId) return;
            pushActivation('admin_verify_payment', { id: selectedActivationId, reviewNote: note });
        });

        var actVerifyReceiptBtn = overlay.querySelector('#si-act-verify-receipt');
        if (actVerifyReceiptBtn) actVerifyReceiptBtn.addEventListener('click', function () {
            var note = valueOf('#si-activation-admin-note') || '';
            if (!selectedActivationId) return;
            pushActivation('admin_verify_receipt', { id: selectedActivationId, reviewNote: note });
        });

        var actRejectBtn = overlay.querySelector('#si-act-reject');
        if (actRejectBtn) actRejectBtn.addEventListener('click', function () {
            var note = valueOf('#si-activation-admin-note') || '';
            if (!selectedActivationId) return;
            pushActivation('admin_reject', { id: selectedActivationId, reviewNote: note });
        });

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
        if (activeTab === 'claims' && !canSeeClaimsUi()) activeTab = 'overview';
        if (activeTab === 'activations' && !canSeeActivationsUi()) activeTab = 'overview';
        if (activeTab === 'xanax_request' && !canSeeXanaxRequestUi()) activeTab = 'overview';
        if (activeTab === 'war_stack' && !(warTabEnabled && canManageWarStackUi())) activeTab = 'overview';
        ensureMounted();
        if (!overlay) return;

        var body = renderOverview();
        if (activeTab === 'rules') body = renderRules();
        if (activeTab === 'plans') body = renderPlans();
        if (activeTab === 'claims') body = renderClaims();
        if (activeTab === 'activations') body = renderActivations();
        if (activeTab === 'xanax_request') body = renderXanaxRequest();
        if (activeTab === 'war_stack') body = renderWarStackTab();
        if (activeTab === 'settings') body = renderSettings();

        overlay.innerHTML = ''
            + '<div class="si-head">'
            + '<div><div class="si-title">Sinners Insurance</div><div class="si-sub">thin classic panel</div></div>'
            + '<button id="si-close-btn" class="si-close" type="button">×</button>'
            + '</div>'
            + '<div class="si-tabs">'
            + '<button class="si-tab ' + (activeTab === 'rules' ? 'active' : '') + '" data-tab="rules">RULES</button>'
            + '<button class="si-tab ' + (activeTab === 'overview' ? 'active' : '') + '" data-tab="overview">Overview</button>'
            + '<button class="si-tab ' + (activeTab === 'plans' ? 'active' : '') + '" data-tab="plans">Plans</button>'
            + (canSeeClaimsUi() ? '<button class="si-tab ' + (activeTab === 'claims' ? 'active' : '') + '" data-tab="claims">Claims' + (alertUnreadClaims ? ' (' + alertUnreadClaims + ')' : '') + '</button>' : '')
            + (canSeeActivationsUi() ? '<button class="si-tab ' + (activeTab === 'activations' ? 'active' : '') + '" data-tab="activations">Activations' + (alertPendingActivations ? ' (' + alertPendingActivations + ')' : '') + '</button>' : '')
            + (warTabEnabled && canManageWarStackUi() ? '<button class=\"si-tab ' + (activeTab === 'war_stack' ? 'active' : '') + '\" data-tab=\"war_stack\">War Stack</button>' : '')
            + (canSeeXanaxRequestUi() ? '<button class="si-tab ' + (activeTab === 'xanax_request' ? 'active' : '') + '" data-tab="xanax_request">Xanax Request</button>' : '')
            + '<button class="si-tab ' + (activeTab === 'settings' ? 'active' : '') + '" data-tab="settings">Settings</button>'
            + '</div>'
            + '<div class="si-body">' + body + '</div>';

        bindEvents();
    }

    function addStyles() {
        if (document.getElementById('si-pda-style-flag')) return;
        GM_addStyle(`
#si-pda-launcher{position:fixed!important;left:10px!important;bottom:10px!important;z-index:2147483647!important;width:118px!important;height:28px!important;display:flex!important;align-items:center!important;justify-content:center!important;}
#si-pda-launcher button{width:118px!important;height:28px!important;border-radius:9px!important;border:1px solid rgba(205,164,74,.5)!important;background:linear-gradient(180deg,rgba(90,12,18,.95),rgba(35,8,10,.98))!important;color:#f5df9d!important;font-size:10px!important;font-weight:800!important;letter-spacing:.1px!important;box-shadow:0 8px 20px rgba(0,0,0,.35)!important;}
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
            launcher.innerHTML = '<button type="button">💊 Sinner\'s Insurance</button>';
            document.body.appendChild(launcher);
            var btn = launcher.querySelector('button');
            if (btn) btn.addEventListener('click', openOverlay);
        }
    }

    function boot() {
        ensureMounted();
        ensureCoverageTimer();
        maybeAutoLogin(false);
        fetchXanaxRequestState();
        fetchAlertsState();
        fetchActivations();
        renderOverlay();
        if (syncSecret) {
            fetchWarTabState();
            fetchFinancialSummary();
            syncClaimsFromBackend();
        }
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
