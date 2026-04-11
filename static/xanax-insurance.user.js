// ==UserScript==
// @name         Sinner's Insurance 7DS PDA Rebuild
// @namespace    fries91-xanax-insurance
// @version      3.1.0
// @description  PDA/mobile-only Sinner's Insurance with War tab, settings login, and payments
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @run-at       document-idle
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function () {
    'use strict';

    var launcher = null;
    var overlay = null;
    var backdrop = null;
    var remountTimer = null;

    var activeTab = readVal('si_active_tab', 'overview');
    var selectedPlan = readVal('si_selected_plan', 'None');
    var sessionRole = readVal('si_session_role', 'guest');
    var sessionName = readVal('si_session_name', 'Guest');

    var claimId = readVal('si_claim_id', '');
    var selectedClaimId = readVal('si_selected_claim_id', '');
    var claimStatus = readVal('si_claim_status', 'Not submitted');
    var claimNote = readVal('si_claim_note', '');
    var claimLoss = readVal('si_claim_loss', '');
    var claimProof = readVal('si_claim_proof', '');
    var claimStack = readVal('si_claim_stack', '');
    var payoutAmount = readVal('si_payout_amount', '');
    var decisionNote = readVal('si_decision_note', '');
    var claimsDb = readVal('si_claims_db', '[]');
    var claimHistory = readVal('si_claim_history', '[]');

    var apiBase = readVal('si_api_base', 'https://xanax-insurance.onrender.com');
    var syncSecret = readVal('si_sync_secret', '');
    var backendStatus = readVal('si_backend_status', 'Not tested');
    var lastSyncAt = readVal('si_last_sync_at', 'Never');
    var adminApiKey = readVal('si_admin_api_key', '');
    var memberApiKey = readVal('si_member_api_key', '');
    var factionIdLock = readVal('si_faction_id_lock', '');
    var authMode = readVal('si_auth_mode', 'local');

    var warEnabled = readVal('si_war_enabled', false);
    var warUpdatedAt = readVal('si_war_updated_at', '');
    var warUpdatedBy = readVal('si_war_updated_by', '');
    var warViewerCanManage = readVal('si_war_can_manage', false);

    var finVerifiedXanax = readVal('si_fin_verified_xanax', 0);
    var finFactionCut = readVal('si_fin_faction_cut', 0);
    var finPool = readVal('si_fin_pool', 0);
    var finReceiptCount = readVal('si_fin_receipts', 0);
    var finMemberPayCount = readVal('si_fin_member_pay', 0);
    var finPayoutCount = readVal('si_fin_payout_count', 0);

    var historyLoading = false;
    var warLoading = false;
    var financeLoading = false;

    var PLANS = [
        {
            name: 'Pride Sin',
            coverage: '6 Xanax',
            payment: '2 Xanax',
            window: '20 mins',
            rule: 'Can start with any amount of energy.'
        },
        {
            name: 'Wrath Sin',
            coverage: 'Stage based',
            payment: '5 / 10 / 15 / 20 Xanax',
            window: '1 hour',
            rule: 'Must follow stage rules and stack type.'
        },
        {
            name: 'Envy Sin',
            coverage: '25 Xanax + 3 E-DVDs',
            payment: '2 Xanax',
            window: '30 mins',
            rule: 'Happy jump style coverage.'
        }
    ];

    function readVal(key, fallback) {
        try {
            if (typeof GM_getValue === 'function') return GM_getValue(key, fallback);
        } catch (e) {}
        return fallback;
    }

    function writeVal(key, value) {
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

    function isAdmin() {
        return sessionRole === 'admin';
    }

    function isMember() {
        return sessionRole === 'member' || sessionRole === 'admin';
    }

    function saveSession() {
        writeVal('si_active_tab', activeTab || 'overview');
        writeVal('si_selected_plan', selectedPlan || 'None');
        writeVal('si_session_role', sessionRole || 'guest');
        writeVal('si_session_name', sessionName || 'Guest');

        writeVal('si_claim_id', claimId || '');
        writeVal('si_selected_claim_id', selectedClaimId || '');
        writeVal('si_claim_status', claimStatus || 'Not submitted');
        writeVal('si_claim_note', claimNote || '');
        writeVal('si_claim_loss', claimLoss || '');
        writeVal('si_claim_proof', claimProof || '');
        writeVal('si_claim_stack', claimStack || '');
        writeVal('si_payout_amount', payoutAmount || '');
        writeVal('si_decision_note', decisionNote || '');
        writeVal('si_claims_db', claimsDb || '[]');
        writeVal('si_claim_history', claimHistory || '[]');

        writeVal('si_api_base', apiBase || '');
        writeVal('si_sync_secret', syncSecret || '');
        writeVal('si_backend_status', backendStatus || 'Not tested');
        writeVal('si_last_sync_at', lastSyncAt || 'Never');
        writeVal('si_admin_api_key', adminApiKey || '');
        writeVal('si_member_api_key', memberApiKey || '');
        writeVal('si_faction_id_lock', factionIdLock || '');
        writeVal('si_auth_mode', authMode || 'local');

        writeVal('si_war_enabled', !!warEnabled);
        writeVal('si_war_updated_at', warUpdatedAt || '');
        writeVal('si_war_updated_by', warUpdatedBy || '');
        writeVal('si_war_can_manage', !!warViewerCanManage);

        writeVal('si_fin_verified_xanax', Number(finVerifiedXanax || 0));
        writeVal('si_fin_faction_cut', Number(finFactionCut || 0));
        writeVal('si_fin_pool', Number(finPool || 0));
        writeVal('si_fin_receipts', Number(finReceiptCount || 0));
        writeVal('si_fin_member_pay', Number(finMemberPayCount || 0));
        writeVal('si_fin_payout_count', Number(finPayoutCount || 0));
    }

    function parseJson(text, fallback) {
        try {
            var parsed = JSON.parse(text || '');
            return parsed;
        } catch (e) {
            return fallback;
        }
    }

    function getClaims() {
        var arr = parseJson(claimsDb || '[]', []);
        return Array.isArray(arr) ? arr : [];
    }

    function saveClaims(arr) {
        claimsDb = JSON.stringify(Array.isArray(arr) ? arr : []);
        saveSession();
    }

    function getHistory() {
        var arr = parseJson(claimHistory || '[]', []);
        return Array.isArray(arr) ? arr : [];
    }

    function saveHistory(arr) {
        claimHistory = JSON.stringify(Array.isArray(arr) ? arr.slice(0, 30) : []);
        saveSession();
    }

    function addHistory(text) {
        var arr = getHistory();
        arr.unshift({ at: new Date().toLocaleString(), text: String(text || '') });
        saveHistory(arr);
    }

    function makeClaimId() {
        return 'SIN-' + Date.now().toString().slice(-8);
    }

    function upsertCurrentClaim() {
        if (!claimId) return;
        var items = getClaims();
        var idx = items.findIndex(function (x) { return x && x.id === claimId; });
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
        if (idx >= 0) items[idx] = Object.assign({}, items[idx], rec);
        else items.unshift(rec);
        selectedClaimId = claimId;
        saveClaims(items.slice(0, 60));
    }

    function getSelectedClaim() {
        var items = getClaims();
        if (selectedClaimId) {
            var found = items.find(function (x) { return x && x.id === selectedClaimId; });
            if (found) return found;
        }
        return items.length ? items[0] : null;
    }

    function syncFromSelectedClaim() {
        var rec = getSelectedClaim();
        if (!rec) return;
        selectedClaimId = rec.id || '';
        claimId = rec.id || '';
        selectedPlan = rec.plan || selectedPlan || 'None';
        claimStatus = rec.status || 'Not submitted';
        claimNote = rec.note || '';
        claimLoss = rec.loss || '';
        claimProof = rec.proof || '';
        claimStack = rec.stack || '';
        payoutAmount = rec.payout || '';
        decisionNote = rec.decision || '';
    }

    function stackMatchesPlan(plan, stackText) {
        var p = String(plan || '').toLowerCase();
        var s = String(stackText || '').toLowerCase();
        if (!s) return false;
        if (p.indexOf('pride') >= 0) return /single|1st|first|one|small/.test(s);
        if (p.indexOf('wrath') >= 0) return /1st|first|2nd|second|3rd|third|4th|fourth|stage/.test(s);
        if (p.indexOf('envy') >= 0) return /jump|happy|full/.test(s);
        return true;
    }

    function getPlanRuleText(plan) {
        var match = PLANS.find(function (x) { return x.name === plan; });
        return match ? match.rule : 'Select a valid plan.';
    }

    function getPayoutGuide(plan) {
        if (plan === 'Pride Sin') return 'Small payout';
        if (plan === 'Wrath Sin') return 'Mid payout';
        if (plan === 'Envy Sin') return 'Premium payout';
        return 'None';
    }

    function getStatusClass(status) {
        var s = String(status || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        return 'status-' + s;
    }

    function getMemberClaimSummary() {
        var items = getClaims();
        var total = items.length;
        var pending = 0, approved = 0, denied = 0, paid = 0;
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
            var m = String(x && x.payout || '').replace(/[^0-9.-]/g, '');
            payouts += Number(m || 0) || 0;
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

    function buildServerAuthPayload() {
        return {
            mode: authMode || 'local',
            admin_api_key: adminApiKey || '',
            api_key: memberApiKey || '',
            faction_id: factionIdLock || ''
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
        }).then(function (r) { return r.json(); });
    }

    function testBackendConnection() {
        return apiRequest('GET', '/api/health', null).then(function (data) {
            backendStatus = data && data.ok ? 'Connected' : 'Health check failed';
            lastSyncAt = new Date().toLocaleString();
            saveSession();
            renderOverlay();
        }).catch(function () {
            backendStatus = 'Connection failed';
            lastSyncAt = new Date().toLocaleString();
            saveSession();
            renderOverlay();
        });
    }

    function syncClaimsFromBackend() {
        return apiRequest('POST', '/api/claims/pull', { secret: syncSecret }).then(function (data) {
            if (data && Array.isArray(data.claims)) {
                saveClaims(data.claims);
                if (!selectedClaimId && data.claims.length) selectedClaimId = data.claims[0].id || '';
                syncFromSelectedClaim();
                backendStatus = 'Claims pulled';
                lastSyncAt = new Date().toLocaleString();
                saveSession();
                renderOverlay();
            }
        }).catch(function () {
            backendStatus = 'Pull failed';
            lastSyncAt = new Date().toLocaleString();
            saveSession();
            renderOverlay();
        });
    }

    function pushCurrentClaimToBackend(actionOverride) {
        if (!claimId) return Promise.resolve(null);
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
                var mapped = data.history.map(function (x) {
                    return {
                        at: x.at || x.createdAt || '',
                        text: x.text || x.note || JSON.stringify(x)
                    };
                });
                saveHistory(mapped);
                renderOverlay();
            }
            return data;
        }).catch(function () {
            historyLoading = false;
            return null;
        });
    }

    function fetchWarState() {
        if (warLoading || !syncSecret) return Promise.resolve(null);
        warLoading = true;
        return apiRequest('POST', '/api/warstack/state', {
            secret: syncSecret,
            auth: buildServerAuthPayload()
        }).then(function (data) {
            warLoading = false;
            var state = data && (data.state || data.warstack);
            if (state) {
                warEnabled = !!state.enabled;
                warUpdatedAt = state.updatedAt || '';
                warUpdatedBy = state.updatedBy || '';
                warViewerCanManage = !!state.viewerCanManage;
                backendStatus = 'War state loaded';
                lastSyncAt = new Date().toLocaleString();
                saveSession();
                renderOverlay();
            }
            return data;
        }).catch(function () {
            warLoading = false;
            backendStatus = 'War state failed';
            lastSyncAt = new Date().toLocaleString();
            saveSession();
            renderOverlay();
            return null;
        });
    }

    function setWarState(enabled) {
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
                warEnabled = !!state.enabled;
                warUpdatedAt = state.updatedAt || '';
                warUpdatedBy = state.updatedBy || '';
                warViewerCanManage = !!state.viewerCanManage;
                backendStatus = 'War state updated';
                lastSyncAt = new Date().toLocaleString();
                saveSession();
                renderOverlay();
            } else {
                window.alert((data && data.error) ? data.error : 'War state update failed.');
            }
        }).catch(function () {
            window.alert('War state update failed.');
        });
    }

    function fetchFinancialSummary() {
        if (financeLoading || !syncSecret) return Promise.resolve(null);
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
            backendStatus = 'Payments failed';
            lastSyncAt = new Date().toLocaleString();
            saveSession();
            renderOverlay();
            return null;
        });
    }

    function backendAdminLogin() {
        orEach(function (x) {
            var st = String(x && x.status || '');
            if (st === 'Pending review' || st === 'Under review') pending += 1;
            if (st === 'Approved') approved += 1;
            if (st === 'Denied') denied += 1;
            if (st === 'Paid') paid += 1;
            var n = String(x && x.member || '').trim();
            if (n) names[n.toLowerCase()] = true;
            var m = String(x && x.payout || '').replace(/[^0-9.-]/g, '');
            payouts += Number(m || 0) || 0;
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

    function buildServerAuthPayload() {
        return {
            mode: authMode || 'local',
            admin_api_key: adminApiKey || '',
            api_key: memberApiKey || '',
            faction_id: factionIdLock || ''
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
        }).then(function (r) { return r.json(); });
    }

    function testBackendConnection() {
        return apiRequest('GET', '/api/health', null).then(function (data) {
            backendStatus = data && data.ok ? 'Connected' : 'Health check failed';
            lastSyncAt = new Date().toLocaleString();
            saveSession();
            renderOverlay();
        }).catch(function () {
            backendStatus = 'Connection failed';
            lastSyncAt = new Date().toLocaleString();
            saveSession();
            renderOverlay();
        });
    }

    function syncClaimsFromBackend() {
        return apiRequest('POST', '/api/claims/pull', { secret: syncSecret }).then(function (data) {
            if (data && Array.isArray(data.claims)) {
                saveClaims(data.claims);
                if (!selectedClaimId && data.claims.length) selectedClaimId = data.claims[0].id || '';
                syncFromSelectedClaim();
                backendStatus = 'Claims pulled';
                lastSyncAt = new Date().toLocaleString();
                saveSession();
                renderOverlay();
            }
        }).catch(function () {
            backendStatus = 'Pull failed';
            lastSyncAt = new Date().toLocaleString();
            saveSession();
            renderOverlay();
        });
    }

    function pushCurrentClaimToBackend(actionOverride) {
        if (!claimId) return Promise.resolve(null);
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
                var mapped = data.history.map(function (x) {
                    return {
                        at: x.at || x.createdAt || '',
                        text: x.text || x.note || JSON.stringify(x)
                    };
                });
                saveHistory(mapped);
                renderOverlay();
            }
            return data;
        }).catch(function () {
            historyLoading = false;
            return null;
        });
    }

    function fetchWarState() {
        if (warLoading || !syncSecret) return Promise.resolve(null);
        warLoading = true;
        return apiRequest('POST', '/api/warstack/state', {
            secret: syncSecret,
            auth: buildServerAuthPayload()
        }).then(function (data) {
            warLoading = false;
            var state = data && (data.state || data.warstack);
            if (state) {
                warEnabled = !!state.enabled;
                warUpdatedAt = state.updatedAt || '';
                warUpdatedBy = state.updatedBy || '';
                warViewerCanManage = !!state.viewerCanManage;
                backendStatus = 'War state loaded';
                lastSyncAt = new Date().toLocaleString();
                saveSession();
                renderOverlay();
            }
            return data;
        }).catch(function () {
            warLoading = false;
            backendStatus = 'War state failed';
            lastSyncAt = new Date().toLocaleString();
            saveSession();
            renderOverlay();
            return null;
        });
    }

    function setWarState(enabled) {
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
                warEnabled = !!state.enabled;
                warUpdatedAt = state.updatedAt || '';
                warUpdatedBy = state.updatedBy || '';
                warViewerCanManage = !!state.viewerCanManage;
                backendStatus = 'War state updated';
                lastSyncAt = new Date().toLocaleString();
                saveSession();
                renderOverlay();
            } else {
                window.alert((data && data.error) ? data.error : 'War state update failed.');
            }
        }).catch(function () {
            window.alert('War state update failed.');
        });
    }

    function fetchFinancialSummary() {
        if (financeLoading || !syncSecret) return Promise.resolve(null);
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
            backendStatus = 'Payments failed';
            lastSyncAt = new Date().toLocaleString();
            saveSession();
            renderOverlay();
            return null;
        });
    }

    function backendAdminLogin() {
        ,
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
        }).then(function (r) { return r.json(); });
    }

    function testBackendConnection() {
        return apiRequest('GET', '/api/health', null).then(function (data) {
            backendStatus = data && data.ok ? 'Connected' : 'Health check failed';
            lastSyncAt = new Date().toLocaleString();
            saveSession();
            renderOverlay();
        }).catch(function () {
            backendStatus = 'Connection failed';
            lastSyncAt = new Date().toLocaleString();
            saveSession();
            renderOverlay();
        });
    }

    function syncClaimsFromBackend() {
        return apiRequest('POST', '/api/claims/pull', { secret: syncSecret }).then(function (data) {
            if (data && Array.isArray(data.claims)) {
                saveClaims(data.claims);
                if (!selectedClaimId && data.claims.length) selectedClaimId = data.claims[0].id || '';
                syncFromSelectedClaim();
                backendStatus = 'Claims pulled';
                lastSyncAt = new Date().toLocaleString();
                saveSession();
                renderOverlay();
            }
        }).catch(function () {
            backendStatus = 'Pull failed';
            lastSyncAt = new Date().toLocaleString();
            saveSession();
            renderOverlay();
        });
    }

    function pushCurrentClaimToBackend(actionOverride) {
        if (!claimId) return Promise.resolve(null);
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
                var mapped = data.history.map(function (x) {
                    return {
                        at: x.at || x.createdAt || '',
                        text: x.text || x.note || JSON.stringify(x)
                    };
                });
                saveHistory(mapped);
                renderOverlay();
            }
            return data;
        }).catch(function () {
            historyLoading = false;
            return null;
        });
    }

    function backendAdminLogin() {
        if (!apiBase || !adminApiKey || !syncSecret) {
            window.alert('Enter API Base URL, Sync Secret, and Admin API Key first.');
            return;
        }
        apiRequest('POST', '/api/auth/admin-key-login', {
            api_key: adminApiKey,
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
            } else {
                window.alert((data && data.error) ? data.error : 'Admin login failed.');
            }
        }).catch(function () {
            window.alert('Admin login failed.');
        });
    }

    function backendMemberFactionLogin() {
        if (!apiBase || !memberApiKey || !factionIdLock || !syncSecret) {
            window.alert('Enter API Base URL, Sync Secret, Member API Key, and Faction ID first.');
            return;
        }
        apiRequest('POST', '/api/auth/faction-login', {
            api_key: memberApiKey,
            faction_id: factionIdLock,
            secret: syncSecret
        }).then(function (data) {
            if (data && data.ok && data.user) {
                sessionName = data.user.name || 'Member';
                sessionRole = data.user.role || 'member';
                authMode = 'backend-faction';
                backendStatus = 'Member login ok';
                lastSyncAt = new Date().toLocaleString();
                saveSession();
                renderOverlay();
            } else {
                window.alert((data && data.error) ? data.error : 'Member login failed.');
            }
        }).catch(function () {
            window.alert('Member login failed.');
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

    function valueOf(selector) {
        var el = overlay && overlay.querySelector(selector);
        return el ? String(el.value || '').trim() : '';
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
                if (btn.getAttribute('data-action') === 'select-plan') selectPlan(name);
                if (btn.getAttribute('data-action') === 'terms-plan') showPlanTerms(name);
            });
        });

        var closeBtn = overlay.querySelector('#si-close-btn');
        if (closeBtn) closeBtn.addEventListener('click', closeOverlay);

        var saveSettingsBtn = overlay.querySelector('#si-save-settings');
        if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', function () {
            apiBase = valueOf('#si-api-base') || apiBase;
            syncSecret = valueOf('#si-sync-secret') || syncSecret;
            adminApiKey = valueOf('#si-admin-api-key') || adminApiKey;
            memberApiKey = valueOf('#si-member-api-key') || memberApiKey;
            factionIdLock = valueOf('#si-faction-id-lock') || factionIdLock;
            saveSession();
            renderOverlay();
        });

        var testBtn = overlay.querySelector('#si-test-backend');
        if (testBtn) testBtn.addEventListener('click', testBackendConnection);

        var pullBtn = overlay.querySelector('#si-pull-claims');
        if (pullBtn) pullBtn.addEventListener('click', syncClaimsFromBackend);

        var adminLoginBtn = overlay.querySelector('#si-admin-login');
        if (adminLoginBtn) adminLoginBtn.addEventListener('click', backendAdminLogin);

        var memberLoginBtn = overlay.querySelector('#si-member-login');
        if (memberLoginBtn) memberLoginBtn.addEventListener('click', backendMemberFactionLogin);

        var localAdminBtn = overlay.querySelector('#si-local-admin');
        if (localAdminBtn) localAdminBtn.addEventListener('click', function () { localLogin('admin'); });

        var localMemberBtn = overlay.querySelector('#si-local-member');
        if (localMemberBtn) localMemberBtn.addEventListener('click', function () { localLogin('member'); });

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

    function renderOverview() {
        var summary = getMemberClaimSummary();
        return ''
            + card('Overview',
                '<div class="si-grid3">'
                + tile(summary.total, 'Claims')
                + tile(summary.pending, 'Open')
                + tile(summary.paid, 'Paid')
                + tile(summary.denied, 'Denied')
                + tile(summary.members, 'Members')
                + tile('$' + Math.round(summary.payouts), 'Payouts')
                + '</div>')
            + card('Current Session',
                '<div class="si-row"><span class="si-label">User</span><span>' + esc(sessionName) + '</span></div>'
                + '<div class="si-row"><span class="si-label">Role</span><span>' + esc(sessionRole) + '</span></div>'
                + '<div class="si-row"><span class="si-label">Selected Plan</span><span>' + esc(selectedPlan) + '</span></div>'
                + '<div class="si-row"><span class="si-label">Backend</span><span>' + esc(backendStatus) + '</span></div>'
                + '<div class="si-row"><span class="si-label">Last Sync</span><span>' + esc(lastSyncAt) + '</span></div>');
    }

    function renderPlans() {
        return PLANS.map(function (p) {
            return '<div class="si-card">'
                + '<div class="si-plan-head"><div class="si-plan-name">' + esc(p.name) + '</div><div class="si-badge">' + (selectedPlan === p.name ? 'Selected' : 'Plan') + '</div></div>'
                + '<div class="si-stat-grid">'
                + '<div class="si-stat"><div class="si-stat-k">Coverage</div><div class="si-stat-v">' + esc(p.coverage) + '</div></div>'
                + '<div class="si-stat"><div class="si-stat-k">Payment</div><div class="si-stat-v">' + esc(p.payment) + '</div></div>'
                + '<div class="si-stat"><div class="si-stat-k">Window</div><div class="si-stat-v">' + esc(p.window) + '</div></div>'
                + '<div class="si-stat"><div class="si-stat-k">Payout</div><div class="si-stat-v">' + esc(getPayoutGuide(p.name)) + '</div></div>'
                + '</div>'
                + '<div class="si-text">' + esc(p.rule) + '</div>'
                + '<div class="si-btnrow">'
                + '<button class="si-btn" data-action="select-plan" data-plan="' + esc(p.name) + '">Select</button>'
                + '<button class="si-btn alt" data-action="terms-plan" data-plan="' + esc(p.name) + '">Terms</button>'
                + '</div>'
                + '</div>';
        }).join('')
        + card('Selected Plan', '<div class="si-text"><strong>' + esc(selectedPlan) + '</strong></div>');
    }

    function renderClaims() {
        syncFromSelectedClaim();
        var items = getClaims();
        var options = items.length ? items.map(function (x) {
            var sel = x.id === selectedClaimId ? ' selected' : '';
            return '<option value="' + esc(x.id || '') + '"' + sel + '>' + esc((x.id || '') + ' | ' + (x.plan || '') + ' | ' + (x.status || '')) + '</option>';
        }).join('') : '<option value="">No claims yet</option>';

        var form = ''
            + '<div class="si-field"><label>Claim</label><select id="si-claim-select" class="si-input">' + options + '</select></div>'
            + '<div class="si-field"><label>Stack Type</label><input id="si-claim-stack" class="si-input" value="' + esc(claimStack) + '" placeholder="Example: first stack / happy jump"></div>'
            + '<div class="si-field"><label>Loss Details</label><input id="si-claim-loss" class="si-input" value="' + esc(claimLoss) + '" placeholder="What was lost?"></div>'
            + '<div class="si-field"><label>Proof</label><input id="si-claim-proof" class="si-input" value="' + esc(claimProof) + '" placeholder="Screenshot note or proof"></div>'
            + '<div class="si-field"><label>Claim Note</label><textarea id="si-claim-note" class="si-textarea" placeholder="Enter claim details">' + esc(claimNote) + '</textarea></div>'
            + '<div class="si-row"><span class="si-label">Status</span><span class="si-status ' + esc(getStatusClass(claimStatus)) + '">' + esc(claimStatus) + '</span></div>';

        var memberButtons = isMember() && !isAdmin()
            ? '<div class="si-btnrow"><button class="si-btn" id="si-submit-claim">Submit Claim</button></div>'
            : '';

        var adminPanel = isAdmin()
            ? card('Admin Review',
                '<div class="si-field"><label>Payout</label><input id="si-payout" class="si-input" value="' + esc(payoutAmount) + '" placeholder="Payout amount"></div>'
                + '<div class="si-field"><label>Decision Note</label><textarea id="si-decision" class="si-textarea" placeholder="Admin note">' + esc(decisionNote) + '</textarea></div>'
                + '<div class="si-admin-grid">'
                + '<button class="si-btn alt" id="si-under-review">Under Review</button>'
                + '<button class="si-btn good" id="si-approve">Approve</button>'
                + '<button class="si-btn bad" id="si-deny">Deny</button>'
                + '<button class="si-btn good" id="si-paid">Paid</button>'
                + '</div>')
            : '';

        var hist = getHistory().map(function (x) {
            return '<div class="si-history-item"><div class="si-history-at">' + esc(x.at || '') + '</div><div>' + esc(x.text || '') + '</div></div>';
        }).join('') || '<div class="si-text">No claim history yet.</div>';

        return card('Claims', form + memberButtons) + adminPanel + card('History', hist);
    }

    function renderSettings() {
        return card('Login',
            '<div class="si-btnstack">'
            + '<button class="si-btn" id="si-member-login">Backend Member Login</button>'
            + '<button class="si-btn" id="si-admin-login">Backend Admin Login</button>'
            + '<button class="si-btn alt" id="si-local-member">Local Member Login</button>'
            + '<button class="si-btn alt" id="si-local-admin">Local Admin Login</button>'
            + '<button class="si-btn alt" id="si-logout">Logout</button>'
            + '</div>')
            + card('Backend Settings',
            '<div class="si-field"><label>API Base URL</label><input id="si-api-base" class="si-input" value="' + esc(apiBase) + '"></div>'
            + '<div class="si-field"><label>Sync Secret</label><input id="si-sync-secret" class="si-input" value="' + esc(syncSecret) + '"></div>'
            + '<div class="si-field"><label>Admin API Key</label><input id="si-admin-api-key" class="si-input" value="' + esc(adminApiKey) + '"></div>'
            + '<div class="si-field"><label>Member API Key</label><input id="si-member-api-key" class="si-input" value="' + esc(memberApiKey) + '"></div>'
            + '<div class="si-field"><label>Faction ID Lock</label><input id="si-faction-id-lock" class="si-input" value="' + esc(factionIdLock) + '"></div>'
            + '<div class="si-btnrow">'
            + '<button class="si-btn" id="si-save-settings">Save</button>'
            + '<button class="si-btn alt" id="si-test-backend">Test</button>'
            + '<button class="si-btn alt" id="si-pull-claims">Pull Claims</button>'
            + '</div>'
            + '<div class="si-row"><span class="si-label">Status</span><span>' + esc(backendStatus) + '</span></div>'
            + '<div class="si-row"><span class="si-label">Last Sync</span><span>' + esc(lastSyncAt) + '</span></div>');
    }

    function tile(value, label) {
        return '<div class="si-tile"><div class="si-tile-num">' + esc(value) + '</div><div class="si-tile-label">' + esc(label) + '</div></div>';
    }

    function card(title, body) {
        return '<div class="si-card"><div class="si-card-title">' + esc(title) + '</div>' + body + '</div>';
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
            + '<div><div class="si-title">Sinner\'s Insurance</div><div class="si-sub">PDA mobile overlay</div></div>'
            + '<button id="si-close-btn" class="si-close">×</button>'
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
#si-pda-launcher{
  position:fixed !important; left:10px !important; bottom:10px !important; z-index:2147483647 !important;
  width:150px !important; height:42px !important; display:flex !important; align-items:center !important; justify-content:center !important;
}
#si-pda-launcher button{
  width:150px !important; height:42px !important; border-radius:12px !important; border:1px solid rgba(205,164,74,.5) !important;
  background:linear-gradient(180deg, rgba(90,12,18,.95), rgba(35,8,10,.98)) !important; color:#f5df9d !important;
  font-size:12px !important; font-weight:800 !important; letter-spacing:.3px !important; box-shadow:0 8px 20px rgba(0,0,0,.35) !important;
}
#si-pda-backdrop{
  position:fixed !important; inset:0 !important; background:rgba(0,0,0,.62) !important; z-index:2147483645 !important; display:none !important;
}
#si-pda-backdrop.open{ display:block !important; }
#si-pda-overlay{
  position:fixed !important; left:8px !important; right:8px !important; top:72px !important; bottom:72px !important;
  z-index:2147483646 !important; display:none !important; flex-direction:column !important; overflow:hidden !important;
  border-radius:16px !important; border:1px solid rgba(201,162,80,.25) !important;
  background:linear-gradient(180deg, rgba(28,10,14,.99), rgba(8,5,8,.99)) !important; color:#f7ead0 !important;
  box-shadow:0 20px 55px rgba(0,0,0,.55) !important;
}
#si-pda-overlay.open{ display:flex !important; }
#si-pda-overlay .si-head{
  display:flex !important; align-items:center !important; justify-content:space-between !important; gap:10px !important;
  padding:14px !important; border-bottom:1px solid rgba(201,162,80,.18) !important;
}
#si-pda-overlay .si-title{ font-size:16px !important; font-weight:900 !important; color:#f2de9f !important; text-transform:uppercase !important; }
#si-pda-overlay .si-sub{ font-size:11px !important; color:rgba(241,223,171,.78) !important; text-transform:uppercase !important; }
#si-pda-overlay .si-close{
  width:40px !important; height:40px !important; border-radius:10px !important; border:1px solid rgba(201,162,80,.22) !important;
  background:linear-gradient(180deg, rgba(72,14,18,.96), rgba(24,7,10,.98)) !important; color:#f2de9f !important; font-size:22px !important;
}
#si-pda-overlay .si-tabs{
  display:grid !important; grid-template-columns:repeat(4,minmax(0,1fr)) !important; gap:6px !important; padding:10px !important 10px 0 !important;
}
#si-pda-overlay .si-tab{
  min-height:38px !important; border-radius:10px !important; border:1px solid rgba(201,162,80,.16) !important;
  background:linear-gradient(180deg, rgba(60,12,16,.85), rgba(24,7,10,.92)) !important; color:#f1dfab !important; font-size:11px !important; font-weight:800 !important;
}
#si-pda-overlay .si-tab.active{ background:linear-gradient(180deg, rgba(124,19,26,.95), rgba(64,10,15,.98)) !important; }
#si-pda-overlay .si-body{ overflow:auto !important; padding:10px !important; display:grid !important; gap:10px !important; }
#si-pda-overlay .si-card{
  border-radius:14px !important; border:1px solid rgba(201,162,80,.14) !important; background:rgba(255,255,255,.03) !important; padding:12px !important;
}
#si-pda-overlay .si-card-title{
  font-size:12px !important; font-weight:900 !important; color:#f0dd9f !important; text-transform:uppercase !important; margin-bottom:10px !important;
}
#si-pda-overlay .si-grid3{ display:grid !important; grid-template-columns:repeat(3,minmax(0,1fr)) !important; gap:8px !important; }
#si-pda-overlay .si-tile{ border-radius:10px !important; padding:10px !important; background:rgba(255,255,255,.02) !important; border:1px solid rgba(201,162,80,.12) !important; text-align:center !important; }
#si-pda-overlay .si-tile-num{ font-size:16px !important; font-weight:900 !important; color:#f7e4a7 !important; }
#si-pda-overlay .si-tile-label{ font-size:10px !important; font-weight:800 !important; color:rgba(241,223,171,.76) !important; text-transform:uppercase !important; }
#si-pda-overlay .si-row{ display:flex !important; justify-content:space-between !important; gap:10px !important; padding:7px 0 !important; border-bottom:1px solid rgba(201,162,80,.08) !important; }
#si-pda-overlay .si-label{ color:#f2de9f !important; font-weight:800 !important; font-size:11px !important; text-transform:uppercase !important; }
#si-pda-overlay .si-text{ font-size:13px !important; line-height:1.45 !important; color:#f8f0dd !important; }
#si-pda-overlay .si-plan-head{ display:flex !important; justify-content:space-between !important; gap:10px !important; align-items:center !important; margin-bottom:10px !important; }
#si-pda-overlay .si-plan-name{ font-size:14px !important; font-weight:900 !important; color:#f2de9f !important; text-transform:uppercase !important; }
#si-pda-overlay .si-badge, #si-pda-overlay .si-status{
  display:inline-flex !important; align-items:center !important; justify-content:center !important; min-height:28px !important; padding:0 10px !important;
  border-radius:999px !important; border:1px solid rgba(201,162,80,.18) !important; background:rgba(119,17,22,.22) !important; color:#f1dfab !important; font-size:11px !important; font-weight:900 !important;
}
#si-pda-overlay .si-stat-grid{ display:grid !important; grid-template-columns:repeat(2,minmax(0,1fr)) !important; gap:8px !important; margin-bottom:10px !important; }
#si-pda-overlay .si-stat{ border-radius:10px !important; padding:8px !important; background:rgba(255,255,255,.02) !important; border:1px solid rgba(201,162,80,.12) !important; }
#si-pda-overlay .si-stat-k{ font-size:10px !important; font-weight:800 !important; color:rgba(241,223,171,.72) !important; text-transform:uppercase !important; margin-bottom:4px !important; }
#si-pda-overlay .si-stat-v{ font-size:12px !important; font-weight:800 !important; color:#f8f0dd !important; }
#si-pda-overlay .si-btnrow, #si-pda-overlay .si-btnstack{ display:flex !important; flex-wrap:wrap !important; gap:8px !important; }
#si-pda-overlay .si-btnstack{ display:grid !important; grid-template-columns:1fr !important; }
#si-pda-overlay .si-btn{
  min-height:40px !important; padding:0 12px !important; border-radius:10px !important; border:1px solid rgba(201,162,80,.24) !important;
  background:linear-gradient(180deg, rgba(124,19,26,.95), rgba(64,10,15,.98)) !important; color:#f7e4a7 !important; font-size:11px !important; font-weight:900 !important; text-transform:uppercase !important;
}
#si-pda-overlay .si-btn.alt{ background:linear-gradient(180deg, rgba(60,12,16,.92), rgba(24,7,10,.96)) !important; }
#si-pda-overlay .si-btn.good{ background:linear-gradient(180deg, rgba(20,112,58,.94), rgba(12,66,34,.98)) !important; }
#si-pda-overlay .si-btn.bad{ background:linear-gradient(180deg, rgba(120,26,32,.94), rgba(70,12,18,.98)) !important; }
#si-pda-overlay .si-field{ display:grid !important; gap:6px !important; margin-bottom:10px !important; }
#si-pda-overlay .si-field label{ font-size:11px !important; font-weight:800 !important; color:#f2de9f !important; text-transform:uppercase !important; }
#si-pda-overlay .si-input, #si-pda-overlay .si-textarea{
  width:100% !important; box-sizing:border-box !important; border-radius:10px !important; border:1px solid rgba(201,162,80,.18) !important;
  background:rgba(255,255,255,.04) !important; color:#f8f0dd !important; padding:11px !important; font-size:14px !important;
}
#si-pda-overlay .si-textarea{ min-height:92px !important; resize:none !important; }
#si-pda-overlay .si-admin-grid{ display:grid !important; grid-template-columns:repeat(2,minmax(0,1fr)) !important; gap:8px !important; }
#si-pda-overlay .si-history-item{ border-radius:10px !important; background:rgba(255,255,255,.02) !important; border:1px solid rgba(201,162,80,.10) !important; padding:10px !important; margin-bottom:8px !important; }
#si-pda-overlay .si-history-at{ font-size:10px !important; color:rgba(241,223,171,.72) !important; margin-bottom:4px !important; }
        `);
        var flag = document.createElement('div');
        flag.id = 'si-pda-style-flag';
        flag.style.display = 'none';
        document.documentElement.appendChild(flag);
    }

    function ensureMounted() {
        addStyles();

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
            launcher.innerHTML = '<button type="button">💊 Sinners Insurance</button>';
            document.body.appendChild(launcher);
            var btn = launcher.querySelector('button');
            if (btn) btn.addEventListener('click', openOverlay);
        }
    }

    function boot() {
        ensureMounted();
        renderOverlay();
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
