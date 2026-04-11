// ==UserScript==
// @name         Sinner's Insurance 7DS
// @namespace    fries91-xanax-insurance
// @version      2.9.1
// @description  Sinner's Insurance 
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @run-at       document-idle
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// ==/UserScript==

(function () {
    'use strict';

    var launcherBar = null;
    var overlay = null;
    var remountTimer = null;
    var activeTab = 'overview';
    var selectedPlan = (typeof GM_getValue === 'function' ? GM_getValue('si_selected_plan', 'None') : 'None');
    var activeTermsPlan = '';
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
    var claimFilterStatus = (typeof GM_getValue === 'function' ? GM_getValue('si_claim_filter_status', 'all') : 'all');
    var claimFilterMember = (typeof GM_getValue === 'function' ? GM_getValue('si_claim_filter_member', '') : '');
    var claimSortMode = (typeof GM_getValue === 'function' ? GM_getValue('si_claim_sort_mode', 'newest') : 'newest');
    var apiBase = (typeof GM_getValue === 'function' ? GM_getValue('si_api_base', 'https://xanax-insurance.onrender.com') : 'https://xanax-insurance.onrender.com');
    var syncSecret = (typeof GM_getValue === 'function' ? GM_getValue('si_sync_secret', '6282') : '6282');
    var backendStatus = (typeof GM_getValue === 'function' ? GM_getValue('si_backend_status', 'Not tested') : 'Not tested');
    var lastSyncAt = (typeof GM_getValue === 'function' ? GM_getValue('si_last_sync_at', 'Never') : 'Never');
    var serverClaimHistory = (typeof GM_getValue === 'function' ? GM_getValue('si_server_claim_history', '[]') : '[]');
    var lastAdminNoticeClaimIds = (typeof GM_getValue === 'function' ? GM_getValue('si_last_admin_notice_claim_ids', '[]') : '[]');
    var autoDetectStatus = (typeof GM_getValue === 'function' ? GM_getValue('si_auto_detect_status', 'Idle') : 'Idle');
    var autoOdFingerprint = (typeof GM_getValue === 'function' ? GM_getValue('si_auto_od_fingerprint', '') : '');
    var autoOdDetectedAt = (typeof GM_getValue === 'function' ? GM_getValue('si_auto_od_detected_at', '') : '');
    var memberAutoDetectTimer = null;
    var armedCountdownTimer = null;
    var adminNotifyEnabled = (typeof GM_getValue === 'function' ? GM_getValue('si_admin_notify_enabled', true) : true);
    var adminNotifyTimer = null;
    var authUser = (typeof GM_getValue === 'function' ? GM_getValue('si_auth_user', '') : '');
    var authPass = (typeof GM_getValue === 'function' ? GM_getValue('si_auth_pass', '') : '');
    var memberApiKey = (typeof GM_getValue === 'function' ? GM_getValue('si_member_api_key', '') : '');
    var factionIdLock = (typeof GM_getValue === 'function' ? GM_getValue('si_faction_id_lock', '49384') : '49384');
    var authMode = (typeof GM_getValue === 'function' ? GM_getValue('si_auth_mode', 'local') : 'local');
    var planActivationAt = (typeof GM_getValue === 'function' ? GM_getValue('si_plan_activation_at', '') : '');
    var planActivationPlan = (typeof GM_getValue === 'function' ? GM_getValue('si_plan_activation_plan', '') : '');
    var planActivationStage = (typeof GM_getValue === 'function' ? GM_getValue('si_plan_activation_stage', '') : '');
    var planActivationEnergy = (typeof GM_getValue === 'function' ? GM_getValue('si_plan_activation_energy', '') : '');
    var planActivationBoosterCd = (typeof GM_getValue === 'function' ? GM_getValue('si_plan_activation_booster_cd', '') : '');
    var planActivationExpiresAt = (typeof GM_getValue === 'function' ? GM_getValue('si_plan_activation_expires_at', '') : '');
    var warStackState = (function () { try { return JSON.parse(typeof GM_getValue === 'function' ? GM_getValue('si_war_stack_state', '{}') : '{}') || {}; } catch (e) { return {}; } })();
    var financialSummary = (function () { try { return JSON.parse(typeof GM_getValue === 'function' ? GM_getValue('si_financial_summary', '{}') : '{}') || {}; } catch (e) { return {}; } })();
    var warStackTimer = null;

    var TAB_LABELS = {
        overview: 'Overview',
        plans: 'Plans',
        claims: 'Claims',
        admin: 'Admin',
        settings: 'Settings',
        warstack: '⚔️War Stack🛡️'
    };


    function isWarStackTabAvailable() {
        return !!(warStackState && warStackState.enabled);
    }

    function getWarStackCountdownMs() {
        return Math.max(0, parseIsoOrLocalTimestamp(warStackState && warStackState.startAt) - Date.now());
    }

    function getWarStackCountdownLabel() {
        if (warStackState && warStackState.enabled) return 'Active';
        return 'Inactive';
    }

    function canArmWarPlan(plan) {
        return String(plan || '') !== 'Greed Sin' || isWarStackTabAvailable();
    }

    function getWarPlanStatusText(plan) {
        if (String(plan || '') !== 'Greed Sin') return 'Standard plan';
        if (isPlanArmedActive('Greed Sin')) return 'Greed Sin active';
        if (warStackState && warStackState.visible) return 'Ready to arm';
        return (warStackState && warStackState.statusText) || 'War Stack is inactive';
    }

    function getWarStackButtonLabel() {
        return TAB_LABELS.warstack || '⚔️War Stack🛡️';
    }

    function getTornFactionRankedWars(apiKey) {
        var url = 'https://api.torn.com/faction/?selections=rankedwars&key=' + encodeURIComponent(apiKey || '') + '&comment=sinners-insurance-warstack&timestamp=' + Date.now();
        return tornApiRequest(url);
    }

    function flattenWarItems(raw) {
        if (!raw) return [];
        if (Array.isArray(raw)) return raw.slice();
        if (typeof raw !== 'object') return [];
        var out = [];
        Object.keys(raw).forEach(function (key) {
            var value = raw[key];
            if (!value) return;
            if (Array.isArray(value)) {
                value.forEach(function (item) { if (item && typeof item === 'object') out.push(item); });
                return;
            }
            if (typeof value === 'object') out.push(value);
        });
        return out;
    }

    function pickWarStartValue(item) {
        if (!item || typeof item !== 'object') return '';
        return item.start || item.start_at || item.start_time || item.startTime || item.war_start || item.start_timestamp || item.starts || item.match_start;
    }

    function pickWarEndValue(item) {
        if (!item || typeof item !== 'object') return '';
        return item.end || item.end_at || item.end_time || item.endTime || item.war_end || item.end_timestamp || item.ends || item.match_end;
    }

    function extractOpponentName(item) {
        if (!item || typeof item !== 'object') return '';
        var candidates = [
            item.opponent_name,
            item.opponent,
            item.enemy_name,
            item.enemy,
            item.target_name,
            item.faction_name,
            item.name
        ];
        if (item.opponent_faction && typeof item.opponent_faction === 'object') {
            candidates.unshift(item.opponent_faction.name || item.opponent_faction.faction_name || '');
        }
        if (item.enemy_faction && typeof item.enemy_faction === 'object') {
            candidates.unshift(item.enemy_faction.name || item.enemy_faction.faction_name || '');
        }
        for (var i = 0; i < candidates.length; i += 1) {
            var value = String(candidates[i] || '').trim();
            if (value) return value;
        }
        return 'Opponent not found';
    }

    function parseRankedWarState(data) {
        var container = data && (data.rankedwars || data.rankedWars || data.wars || data);
        var wars = flattenWarItems(container);
        var now = Date.now();
        var paired = null;
        var live = null;

        wars.forEach(function (item) {
            var startMs = parseIsoOrLocalTimestamp(pickWarStartValue(item));
            var endMs = parseIsoOrLocalTimestamp(pickWarEndValue(item));
            if (!startMs) return;
            if (startMs > now) {
                if (!paired || startMs < paired.startMs) {
                    paired = {
                        visible: true,
                        active: false,
                        opponentName: extractOpponentName(item),
                        startAt: new Date(startMs).toLocaleString(),
                        statusText: 'Paired war found. War Stack is active until the war starts.',
                        source: item,
                        startMs: startMs
                    };
                }
                return;
            }
            if (startMs <= now && (!endMs || endMs > now)) {
                if (!live || startMs > live.startMs) {
                    live = {
                        visible: false,
                        active: true,
                        opponentName: extractOpponentName(item),
                        startAt: new Date(startMs).toLocaleString(),
                        statusText: 'War has started. War Stack tab is now locked.',
                        source: item,
                        startMs: startMs
                    };
                }
            }
        });

        if (paired) return paired;
        if (live) return live;
        return {
            visible: false,
            active: false,
            opponentName: '',
            startAt: '',
            statusText: 'No paired war detected.',
            startMs: 0
        };
    }

    function updateWarStackState(nextState, forceRender) {
        warStackState = {
            enabled: !!(nextState && (nextState.enabled || nextState.visible)),
            visible: !!(nextState && (nextState.visible || nextState.enabled)),
            active: !!(nextState && nextState.active),
            opponentName: String(nextState && nextState.opponentName || ''),
            startAt: String(nextState && nextState.startAt || ''),
            statusText: String(nextState && nextState.statusText || ''),
            updatedAt: String(nextState && nextState.updatedAt || ''),
            updatedBy: String(nextState && nextState.updatedBy || ''),
            checkedAt: new Date().toLocaleString()
        };
        if (activeTab === 'warstack' && !isWarStackTabAvailable()) activeTab = 'overview';
        saveSession();
        if (forceRender && overlay) renderOverlay();
    }

    function refreshWarStackState(forceRender) {
        if (!memberApiKey || !syncSecret || !apiBase) {
            updateWarStackState({
                enabled: false,
                visible: false,
                active: false,
                opponentName: '',
                startAt: '',
                statusText: 'Log in to load War Stack state.'
            }, forceRender);
            return Promise.resolve(null);
        }

        return apiRequest('POST', '/api/warstack/state', {
            secret: syncSecret,
            auth: buildServerAuthPayload()
        }).then(function (data) {
            var serverState = data && data.state ? data.state : {};
            updateWarStackState({
                enabled: !!serverState.enabled,
                visible: !!serverState.enabled,
                active: false,
                opponentName: '',
                startAt: '',
                statusText: serverState.enabled ? 'War Stack is active for the faction.' : 'War Stack is inactive for the faction.',
                updatedAt: String(serverState.updatedAt || ''),
                updatedBy: String(serverState.updatedBy || '')
            }, forceRender);
            return data;
        }).catch(function () {
            updateWarStackState({
                enabled: false,
                visible: false,
                active: false,
                opponentName: '',
                startAt: '',
                statusText: 'War Stack state check failed.'
            }, forceRender);
            return null;
        });
    }

    function setWarStackServerState(enabled) {
        if (!memberApiKey || !syncSecret || !apiBase) {
            window.alert('Log in first to change War Stack state.');
            return Promise.resolve(null);
        }
        return apiRequest('POST', '/api/warstack/set-state', {
            secret: syncSecret,
            auth: buildServerAuthPayload(),
            enabled: !!enabled
        }).then(function (data) {
            if (!data || !data.ok) {
                window.alert((data && data.error) || 'Could not update War Stack state.');
                return data;
            }
            return refreshWarStackState(true).then(function () { return data; });
        }).catch(function () {
            window.alert('Could not update War Stack state.');
            return null;
        });
    }

    function refreshFinancialSummary(forceRender) {
        if (!memberApiKey || !syncSecret || !apiBase) {
            return Promise.resolve(null);
        }
        return apiRequest('POST', '/api/overview/financial-summary', {
            secret: syncSecret,
            auth: buildServerAuthPayload()
        }).then(function (data) {
            if (data && data.ok && data.summary) {
                financialSummary = data.summary || {};
                saveSession();
                if (forceRender && overlay) renderOverlay();
            }
            return data;
        }).catch(function () {
            return null;
        });
    }

    function startWarStackWatch() {
        if (warStackTimer) clearInterval(warStackTimer);
        warStackTimer = null;
        refreshWarStackState(true).catch(function () {});
        refreshFinancialSummary(false).catch(function () {});
        warStackTimer = setInterval(function () {
            refreshWarStackState(true).catch(function () {});
            refreshFinancialSummary(false).catch(function () {});
        }, 60000);
    }

    function getVisibleTabKeys() {
        return isAdmin()
            ? ['overview', 'plans', 'claims', 'admin', 'settings']
            : ['overview', 'plans', 'claims', 'settings'];
    }

    var ADMIN_USER_IDS = ['3679030'];

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
            GM_setValue('si_claim_filter_status', claimFilterStatus || 'all');
            GM_setValue('si_claim_filter_member', claimFilterMember || '');
            GM_setValue('si_claim_sort_mode', claimSortMode || 'newest');
            GM_setValue('si_api_base', apiBase || '');
            GM_setValue('si_sync_secret', syncSecret || '');
            GM_setValue('si_backend_status', backendStatus || 'Not tested');
            GM_setValue('si_last_sync_at', lastSyncAt || 'Never');
            GM_setValue('si_server_claim_history', serverClaimHistory || '[]');
            GM_setValue('si_last_admin_notice_claim_ids', lastAdminNoticeClaimIds || '[]');
            GM_setValue('si_auto_detect_status', autoDetectStatus || 'Idle');
            GM_setValue('si_auto_od_fingerprint', autoOdFingerprint || '');
            GM_setValue('si_auto_od_detected_at', autoOdDetectedAt || '');
            GM_setValue('si_admin_notify_enabled', !!adminNotifyEnabled);
            GM_setValue('si_auth_user', authUser || '');
            GM_setValue('si_auth_pass', authPass || '');
            GM_setValue('si_member_api_key', memberApiKey || '');
            GM_setValue('si_faction_id_lock', factionIdLock || '');
            GM_setValue('si_auth_mode', authMode || 'local');
            GM_setValue('si_plan_activation_at', planActivationAt || '');
            GM_setValue('si_plan_activation_plan', planActivationPlan || '');
            GM_setValue('si_plan_activation_stage', planActivationStage || '');
            GM_setValue('si_plan_activation_energy', planActivationEnergy || '');
            GM_setValue('si_plan_activation_booster_cd', planActivationBoosterCd || '');
            GM_setValue('si_plan_activation_expires_at', planActivationExpiresAt || '');
            GM_setValue('si_war_stack_state', JSON.stringify(warStackState || {}));
            GM_setValue('si_financial_summary', JSON.stringify(financialSummary || {}));
        }
    }

    function isAdmin() {
        return sessionRole === 'admin';
    }

    function isMember() {
        return sessionRole === 'member' || sessionRole === 'admin';
    }

    function parseJsonArraySafe(raw) {
        try {
            var arr = JSON.parse(raw || '[]');
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            return [];
        }
    }

    function sendAdminNotification(title, text) {
        var body = String(text || '');
        try {
            if (typeof GM_notification === 'function') {
                GM_notification({
                    title: String(title || 'Sinner\'s Insurance'),
                    text: body,
                    timeout: 12000
                });
                return;
            }
        } catch (e) {}
        try {
            if (typeof Notification !== 'undefined') {
                if (Notification.permission === 'granted') {
                    new Notification(String(title || 'Sinner\'s Insurance'), { body: body });
                    return;
                }
                if (Notification.permission !== 'denied') {
                    Notification.requestPermission().then(function (permission) {
                        if (permission === 'granted') {
                            new Notification(String(title || 'Sinner\'s Insurance'), { body: body });
                        }
                    });
                    return;
                }
            }
        } catch (e2) {}
        try {
            window.alert((title || 'Sinner\'s Insurance') + '\n\n' + body);
        } catch (e3) {}
    }

    function notifyAdminOfNewClaims(latestClaims) {
        if (!isAdmin() || !adminNotifyEnabled) return;
        var notifiedIds = parseJsonArraySafe(lastAdminNoticeClaimIds).map(function (id) { return String(id || ''); }).filter(Boolean);
        var notifiedMap = {};
        notifiedIds.forEach(function (id) { notifiedMap[id] = true; });
        var incoming = Array.isArray(latestClaims) ? latestClaims : [];
        var fresh = incoming.filter(function (item) {
            if (!item || !item.id) return false;
            var status = String(item.status || '').toLowerCase();
            return !notifiedMap[String(item.id)] && (status === 'pending review' || status === 'under review' || status === 'submitted');
        });
        if (!fresh.length) {
            lastAdminNoticeClaimIds = JSON.stringify(incoming.map(function (item) { return item && item.id ? String(item.id) : ''; }).filter(Boolean).slice(0, 100));
            saveSession();
            return;
        }
        fresh.forEach(function (item) {
            var who = item.member_name || item.member || item.player_name || 'A member';
            var plan = item.plan || 'Unknown plan';
            sendAdminNotification('New Xanax overdose claim', who + ' submitted ' + plan + ' for review.');
        });
        lastAdminNoticeClaimIds = JSON.stringify(incoming.map(function (item) { return item && item.id ? String(item.id) : ''; }).filter(Boolean).slice(0, 100));
        backendStatus = 'New overdose claim notification' + (fresh.length > 1 ? 's' : '') + ': ' + fresh.length;
        saveSession();
    }

    function normalizeFactionId(value) {
        return String(value || '').replace(/[^0-9]/g, '');
    }

    function tornApiRequest(url) {
        if (typeof GM_xmlhttpRequest === 'function') {
            return new Promise(function (resolve, reject) {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    onload: function (res) {
                        try {
                            resolve(JSON.parse(res.responseText || '{}'));
                        } catch (e) {
                            resolve({ error: { code: -1, error: 'Invalid Torn response' } });
                        }
                    },
                    onerror: function () {
                        reject(new Error('Torn API request failed'));
                    }
                });
            });
        }

        return fetch(url).then(function (res) { return res.json(); });
    }

    function getTornIdentity(apiKey) {
        var url = 'https://api.torn.com/user/?selections=profile&key=' + encodeURIComponent(apiKey || '');
        return tornApiRequest(url);
    }

    function getTornBarsAndCooldowns(apiKey) {
        return getTornUserSelection(apiKey, 'basic,bars,cooldowns');
    }

    function getRequiredUserSelections() {
        return 'profile,basic,bars,cooldowns,events,log';
    }

    function getCustomKeyUrl() {
        return 'https://www.torn.com/preferences.php#tab=api?step=addNewKey&title='
            + encodeURIComponent("Sinner's Insurance")
            + '&user=' + encodeURIComponent(getRequiredUserSelections());
    }

    function getPlanWindowMinutes(plan) {
        return 30;
    }

    function getPlanWindowLabel(plan) {
        return '30 mins';
    }

    function getWrathStageConfig(stage) {
        var s = String(stage || '').replace(/[^1-4]/g, '');
        if (s === '2') return { stage: '2', label: 'Stage 2', paymentQty: '10 Xanax', expectedLoss: '500 energy lost', stack: '2nd' };
        if (s === '3') return { stage: '3', label: 'Stage 3', paymentQty: '15 Xanax', expectedLoss: '750 energy lost', stack: '3rd' };
        if (s === '4') return { stage: '4', label: 'Stage 4', paymentQty: '20 Xanax', expectedLoss: '1000 energy lost', stack: '4th' };
        return { stage: '1', label: 'Stage 1', paymentQty: '5 Xanax', expectedLoss: '250 energy lost', stack: '1st' };
    }

    function getArmedPlanDisplayName() {
        if (planActivationPlan === 'Wrath Sin' && planActivationStage) {
            return 'Wrath Sin ' + getWrathStageConfig(planActivationStage).label;
        }
        return planActivationPlan || selectedPlan || 'None';
    }

    function getArmedPaymentDisplay() {
        if (planActivationPlan === 'Wrath Sin' && planActivationStage) {
            return getWrathStageConfig(planActivationStage).paymentQty;
        }
        if (planActivationPlan === 'Pride Sin') return '2 Xanax';
        if (planActivationPlan === 'Greed Sin') return '1 Xanax';
        return '—';
    }

    function getPlanVerificationConfig(plan, stage) {
        var p = String(plan || '').trim();
        if (p === 'Wrath Sin') {
            var wrath = getWrathStageConfig(stage || planActivationStage || '1');
            return {
                paymentItem: 'Xanax',
                paymentQty: String(parseInt(String(wrath.paymentQty || '5').replace(/[^0-9]/g, ''), 10) || 5),
                paymentDisplay: wrath.paymentQty,
                rewardDisplay: wrath.expectedLoss,
                stackText: wrath.stack,
                stage: wrath.stage || '1'
            };
        }
        if (p === 'Pride Sin') {
            return { paymentItem: 'Xanax', paymentQty: '2', paymentDisplay: '2 Xanax', rewardDisplay: '6 Xanax', stackText: 'single', stage: '' };
        }
        if (p === 'Envy Sin') {
            return { paymentItem: 'Xanax', paymentQty: '5', paymentDisplay: '5 Xanax', rewardDisplay: '25 Xanax and 3 E-DVD\'s', stackText: '1000 energy / 0 booster cooldown', stage: '' };
        }
        if (p === 'Greed Sin') {
            return { paymentItem: 'Xanax', paymentQty: '1', paymentDisplay: '1 Xanax', rewardDisplay: '2 Feathery Hotel Coupons', stackText: 'greed', stage: '' };
        }
        return { paymentItem: '', paymentQty: '', paymentDisplay: '—', rewardDisplay: '', stackText: '', stage: '' };
    }

    function parseIsoOrLocalTimestamp(raw) {
        if (!raw) return 0;
        if (typeof raw === 'number') return raw;
        var asNum = String(raw || '').trim();
        if (/^\d+$/.test(asNum)) {
            var n = parseInt(asNum, 10);
            return n > 2000000000000 ? n : (n > 2000000000 ? n * 1000 : n);
        }
        var parsed = Date.parse(String(raw || ''));
        return isNaN(parsed) ? 0 : parsed;
    }

    function formatCooldownSeconds(totalSeconds) {
        var secs = Math.max(0, parseInt(totalSeconds || 0, 10) || 0);
        if (!secs) return 'Ready';
        var hours = Math.floor(secs / 3600);
        var minutes = Math.floor((secs % 3600) / 60);
        var seconds = secs % 60;
        var parts = [];
        if (hours) parts.push(String(hours) + 'h');
        if (minutes) parts.push(String(minutes) + 'm');
        if (seconds || !parts.length) parts.push(String(seconds) + 's');
        return parts.join(' ');
    }

    function isPlanArmedActive(plan, stage) {
        var armedPlan = String(planActivationPlan || '');
        if (!armedPlan || !planActivationAt || !planActivationExpiresAt) return false;
        if (plan && armedPlan !== String(plan)) return false;
        if (String(plan || '') === 'Wrath Sin' && stage && String(planActivationStage || '') !== String(stage)) return false;
        return Date.now() < parseIsoOrLocalTimestamp(planActivationExpiresAt);
    }

    function getArmedCountdownMs() {
        var expiresMs = parseIsoOrLocalTimestamp(planActivationExpiresAt);
        if (!expiresMs) return 0;
        return Math.max(0, expiresMs - Date.now());
    }

    function formatDurationMs(ms) {
        var total = Math.max(0, Math.floor((ms || 0) / 1000));
        var hours = Math.floor(total / 3600);
        var minutes = Math.floor((total % 3600) / 60);
        var seconds = total % 60;
        if (hours) return String(hours) + 'h ' + String(minutes).padStart(2, '0') + 'm ' + String(seconds).padStart(2, '0') + 's';
        return String(minutes) + 'm ' + String(seconds).padStart(2, '0') + 's';
    }

    function clearArmedPlanState(reason, keepDetectStatus) {
        var hadArmedPlan = !!planActivationPlan;
        planActivationAt = '';
        planActivationPlan = '';
        planActivationStage = '';
        planActivationEnergy = '';
        planActivationBoosterCd = '';
        planActivationExpiresAt = '';
        if (!keepDetectStatus) {
            autoDetectStatus = reason || 'Idle';
        }
        saveSession();
        if (hadArmedPlan) renderOverlay();
    }

    function refreshArmedPlanState() {
        if (!planActivationPlan || !planActivationExpiresAt) return false;
        var expiresMs = parseIsoOrLocalTimestamp(planActivationExpiresAt);
        if (!expiresMs) return false;
        if (Date.now() < expiresMs) return true;
        var expiredPlan = getArmedPlanDisplayName();
        clearArmedPlanState('Plan window ended - no OD detected', false);
        addClaimHistoryEntry((sessionName || 'Member') + ' plan window expired for ' + expiredPlan + '.');
        return false;
    }

    function updateArmedCountdownDisplay() {
        var active = refreshArmedPlanState();
        var countdownEls = document.querySelectorAll('#si-7ds-armed-countdown');
        var textValue = active ? formatDurationMs(getArmedCountdownMs()) : 'Expired';
        countdownEls.forEach(function (el) { el.textContent = textValue; });
        var warEls = document.querySelectorAll('#si-7ds-war-start-countdown');
        var warText = getWarStackCountdownLabel();
        warEls.forEach(function (el) { el.textContent = warText; });
    }

    function startArmedCountdownWatch() {
        if (armedCountdownTimer) clearInterval(armedCountdownTimer);
        armedCountdownTimer = setInterval(function () {
            updateArmedCountdownDisplay();
        }, 1000);
        updateArmedCountdownDisplay();
    }

    function armPlanSnapshot(plan, stage) {
        var now = new Date();
        planActivationPlan = plan || selectedPlan || 'None';
        planActivationStage = planActivationPlan === 'Wrath Sin' ? String(stage || '1') : '';
        planActivationAt = now.toLocaleString();
        planActivationEnergy = '';
        planActivationBoosterCd = '';
        planActivationExpiresAt = new Date(now.getTime() + (getPlanWindowMinutes(planActivationPlan) * 60 * 1000)).toLocaleString();
        autoOdFingerprint = '';
        autoDetectStatus = 'Arming ' + (planActivationPlan === 'Wrath Sin' ? getArmedPlanDisplayName() : (planActivationPlan || 'plan')) + '...';
        saveSession();
        renderOverlay();
        startArmedCountdownWatch();

        if (!memberApiKey) {
            autoDetectStatus = 'Plan armed - API key needed for live snapshot';
            saveSession();
            renderOverlay();
            return Promise.resolve(null);
        }

        return getTornBarsAndCooldowns(memberApiKey).then(function (data) {
            if (data && data.error) {
                autoDetectStatus = (planActivationPlan === 'Wrath Sin' ? getArmedPlanDisplayName() : 'Plan') + ' armed - snapshot partial';
                saveSession();
                renderOverlay();
                return data;
            }
            var bars = data && data.bars ? data.bars : {};
            var cooldowns = data && data.cooldowns ? data.cooldowns : {};
            var energy = bars && bars.energy ? bars.energy : {};
            var energyCurrent = energy.current !== undefined ? energy.current : (energy.amount !== undefined ? energy.amount : '');
            var energyMax = energy.maximum !== undefined ? energy.maximum : (energy.max !== undefined ? energy.max : '');
            planActivationEnergy = energyCurrent !== '' ? String(energyCurrent) + (energyMax !== '' ? '/' + String(energyMax) : '') : '';
            var boosterSecs = cooldowns && cooldowns.booster !== undefined ? cooldowns.booster : '';
            planActivationBoosterCd = boosterSecs !== '' ? formatCooldownSeconds(boosterSecs) : '';
            autoDetectStatus = (planActivationPlan === 'Wrath Sin' ? getArmedPlanDisplayName() : 'Plan') + ' armed - waiting for OD in ' + getPlanWindowLabel(planActivationPlan);
            saveSession();
            renderOverlay();
            return data;
        }).catch(function () {
            autoDetectStatus = (planActivationPlan === 'Wrath Sin' ? getArmedPlanDisplayName() : 'Plan') + ' armed - snapshot partial';
            saveSession();
            renderOverlay();
            return null;
        });
    }


    function getTornUserSelection(apiKey, selection) {
        var url = 'https://api.torn.com/user/?selections=' + encodeURIComponent(selection || '') + '&key=' + encodeURIComponent(apiKey || '') + '&comment=sinners-insurance-od&timestamp=' + Date.now();
        return tornApiRequest(url);
    }

    function getTornOdFeed(apiKey) {
        return getTornUserSelection(apiKey, 'events').then(function (data) {
            if (data && !data.error) return data;
            return getTornUserSelection(apiKey, 'log').then(function (logData) {
                return logData && !logData.error ? logData : data;
            }).catch(function () {
                return data;
            });
        });
    }

    function parseActivityTimestamp(rawValue, fallbackObj) {
        var raw = rawValue;
        if ((raw === undefined || raw === null || raw === '') && fallbackObj) {
            raw = fallbackObj.timestamp || fallbackObj.time || fallbackObj.created_at || fallbackObj.created || fallbackObj.date || fallbackObj.started || fallbackObj.ended;
        }
        if (typeof raw === 'number') {
            return raw > 2000000000 ? Math.floor(raw / 1000) : raw;
        }
        if (typeof raw === 'string') {
            if (/^\d+$/.test(raw)) {
                var asInt = parseInt(raw, 10);
                return asInt > 2000000000 ? Math.floor(asInt / 1000) : asInt;
            }
            var asDate = Date.parse(raw);
            if (!isNaN(asDate)) return Math.floor(asDate / 1000);
        }
        return Math.floor(Date.now() / 1000);
    }

    function extractTextFromActivity(item) {
        if (item === null || item === undefined) return '';
        if (typeof item === 'string') return item;
        if (typeof item !== 'object') return String(item);
        var parts = [
            item.event, item.title, item.text, item.description, item.log,
            item.msg, item.message, item.details, item.data, item.reason
        ].filter(function (v) { return v !== undefined && v !== null && v !== ''; });
        return parts.map(function (v) { return typeof v === 'string' ? v : JSON.stringify(v); }).join(' | ');
    }

    function collectActivityEntries(data) {
        var out = [];

        function pushEntry(id, item) {
            if (!item) return;
            var text = extractTextFromActivity(item);
            if (!text) return;
            out.push({
                id: String(id || item.id || item.log || item.event_id || ''),
                timestamp: parseActivityTimestamp(item.timestamp || item.time || item.created_at || item.date, item),
                text: text,
                raw: item
            });
        }

        function scanBucket(bucket) {
            if (!bucket) return;
            if (Array.isArray(bucket)) {
                bucket.forEach(function (item, idx) { pushEntry(idx, item); });
                return;
            }
            if (typeof bucket === 'object') {
                Object.keys(bucket).forEach(function (key) {
                    var item = bucket[key];
                    if (item && typeof item === 'object') {
                        if (item.id === undefined) item.id = key;
                        pushEntry(key, item);
                    } else if (typeof item === 'string') {
                        pushEntry(key, { id: key, text: item });
                    }
                });
            }
        }

        scanBucket(data && data.events);
        scanBucket(data && data.event);
        scanBucket(data && data.log);
        scanBucket(data && data.logs);
        return out;
    }

    function detectLatestXanaxOverdose(entries) {
        var matches = (entries || []).filter(function (entry) {
            var text = String(entry && entry.text || '').toLowerCase();
            return text.indexOf('xanax') >= 0 && (text.indexOf('overdose') >= 0 || text.indexOf('overdosed') >= 0);
        }).sort(function (a, b) {
            return (b.timestamp || 0) - (a.timestamp || 0);
        });
        return matches.length ? matches[0] : null;
    }

    function getAutoStackFromOd(plan, entryText) {
        var text = String(entryText || '').toLowerCase();
        if (plan === 'Pride Sin') return 'single';
        if (plan === 'Wrath Sin') {
            if (planActivationStage) return getWrathStageConfig(planActivationStage).stack;
            if (text.indexOf('1000') >= 0) return '4th';
            if (text.indexOf('750') >= 0) return '3rd';
            if (text.indexOf('500') >= 0) return '2nd';
            return '1st';
        }
        if (plan === 'Envy Sin') return 'full happy jump';
        return '';
    }

    function getAutoLossFromOd(plan, entryText) {
        var text = String(entryText || '');
        if (plan === 'Wrath Sin') {
            if (planActivationStage) return getWrathStageConfig(planActivationStage).expectedLoss;
            if (text.indexOf('1000') >= 0) return '1000 energy lost';
            if (text.indexOf('750') >= 0) return '750 energy lost';
            if (text.indexOf('500') >= 0) return '500 energy lost';
            if (text.indexOf('250') >= 0) return '250 energy lost';
        }
        if (plan === 'Pride Sin') return 'Xanax overdose';
        return 'Xanax overdose';
    }

    function buildAutoProofNote(entry) {
        var when = entry && entry.timestamp ? new Date(entry.timestamp * 1000).toLocaleString() : new Date().toLocaleString();
        return 'Auto-detected from Torn API at ' + when + (entry && entry.id ? ' | Event ' + entry.id : '');
    }

    function applyDetectedXanaxOverdose(entry) {
        if (!entry) return Promise.resolve(null);

        var fingerprint = String((entry.id || '') + '|' + (entry.timestamp || '') + '|' + String(entry.text || '').slice(0, 120));
        if (fingerprint && fingerprint === autoOdFingerprint) {
            autoDetectStatus = 'Watching for next Xanax OD';
            saveSession();
            return Promise.resolve(null);
        }

        autoOdFingerprint = fingerprint;
        autoOdDetectedAt = new Date().toLocaleString();

        if (!selectedPlan || selectedPlan === 'None' || selectedPlan === 'Envy Sin') {
            claimStatus = 'Detected - plan needed';
            claimLoss = getAutoLossFromOd(selectedPlan, entry.text);
            claimProof = buildAutoProofNote(entry);
            claimNote = 'Auto-detected Xanax overdose. Select Pride or Wrath and arm the plan first.';
            claimStack = '';
            addClaimHistoryEntry((sessionName || 'Member') + ' had a Xanax overdose auto-detected but no Xanax plan was selected.');
            autoDetectStatus = 'OD found - select plan';
            saveSession();
            renderOverlay();
            window.alert('Xanax overdose detected. Select Pride or Wrath first.');
            return Promise.resolve(null);
        }

        if (!planActivationAt || !planActivationPlan || planActivationPlan !== selectedPlan) {
            autoDetectStatus = 'OD found - plan was not armed';
            claimStatus = 'Detected - plan not armed';
            claimLoss = getAutoLossFromOd(selectedPlan, entry.text);
            claimProof = buildAutoProofNote(entry);
            claimNote = 'Auto-detected Xanax overdose, but the selected plan was not armed before the OD.';
            claimStack = getAutoStackFromOd(selectedPlan, entry.text);
            saveSession();
            renderOverlay();
            return Promise.resolve(null);
        }

        if (selectedPlan === 'Wrath Sin' && planActivationStage) {
            var expected = getWrathStageConfig(planActivationStage);
            var detectedStack = getAutoStackFromOd('Wrath Sin', entry.text);
            if (detectedStack !== expected.stack) {
                autoDetectStatus = 'OD found - wrong Wrath stage';
                claimStatus = 'Detected - wrong stage';
                claimLoss = getAutoLossFromOd(selectedPlan, entry.text);
                claimProof = buildAutoProofNote(entry);
                claimNote = 'Auto-detected Xanax overdose did not match the armed Wrath stage. Armed ' + expected.label + ' but detected ' + detectedStack + '.';
                claimStack = detectedStack;
                saveSession();
                renderOverlay();
                return Promise.resolve(null);
            }
        }

        var armedAtMs = parseIsoOrLocalTimestamp(planActivationAt);
        var odAtMs = (entry.timestamp || 0) * 1000;
        var windowMs = getPlanWindowMinutes(selectedPlan) * 60 * 1000;
        if (!armedAtMs || !windowMs || odAtMs < armedAtMs || odAtMs > (armedAtMs + windowMs)) {
            autoDetectStatus = 'OD found - outside ' + getPlanWindowLabel(selectedPlan) + ' window';
            claimStatus = 'Detected - outside window';
            claimLoss = getAutoLossFromOd(selectedPlan, entry.text);
            claimProof = buildAutoProofNote(entry);
            claimNote = 'Auto-detected Xanax overdose was outside the armed ' + getPlanWindowLabel(selectedPlan) + ' window.';
            claimStack = getAutoStackFromOd(selectedPlan, entry.text);
            addClaimHistoryEntry((sessionName || 'Member') + ' had a Xanax overdose detected outside the ' + getPlanWindowLabel(selectedPlan) + ' window for ' + selectedPlan + '.');
            saveSession();
            renderOverlay();
            return Promise.resolve(null);
        }

        claimId = makeClaimId();
        selectedClaimId = claimId;
        claimStatus = 'Pending review';
        claimStack = getAutoStackFromOd(selectedPlan, entry.text);
        claimLoss = getAutoLossFromOd(selectedPlan, entry.text);
        claimProof = buildAutoProofNote(entry) + ' | Armed ' + planActivationAt + ' | Energy ' + (planActivationEnergy || 'unknown') + ' | Booster CD ' + (planActivationBoosterCd || 'unknown') + (planActivationStage ? ' | Wrath stage ' + planActivationStage : '');
        claimNote = 'Auto-detected via Torn API within ' + getPlanWindowLabel(selectedPlan) + ': ' + String(entry.text || '').replace(/\s+/g, ' ').slice(0, 180) + ' | Armed plan ' + getArmedPlanDisplayName() + ' at ' + planActivationAt + (planActivationPlan === 'Wrath Sin' && planActivationStage ? ' | Required payment ' + getWrathStageConfig(planActivationStage).paymentQty : '') + '.';
        addClaimHistoryEntry((sessionName || 'Member') + ' had a Xanax overdose auto-detected within the ' + getPlanWindowLabel(selectedPlan) + ' window for ' + selectedPlan + ' and claim ' + claimId + ' was created automatically.');
        upsertCurrentClaimRecord();
        clearArmedPlanState('OD detected in active window', true);
        autoDetectStatus = 'OD detected in window and claim queued';
        saveSession();
        renderOverlay();

        if (apiBase && syncSecret) {
            return syncClaimToBackend().then(function () {
                autoDetectStatus = 'OD detected in window and claim synced';
                saveSession();
                renderOverlay();
                return true;
            }).catch(function () {
                autoDetectStatus = 'OD detected in window - sync pending';
                saveSession();
                renderOverlay();
                return null;
            });
        }
        return Promise.resolve(null);
    }

    function runMemberAutoDetection() {
        if (!isMember() || !memberApiKey) return Promise.resolve(null);
        if (!refreshArmedPlanState()) return Promise.resolve(null);
        autoDetectStatus = 'Checking Torn for Xanax OD...';
        saveSession();
        return getTornOdFeed(memberApiKey).then(function (data) {
            if (data && data.error) {
                autoDetectStatus = 'OD check failed: ' + String((data.error && data.error.error) || 'API error');
                saveSession();
                renderOverlay();
                return null;
            }
            var entries = collectActivityEntries(data || {});
            var latest = detectLatestXanaxOverdose(entries);
            if (!latest) {
                autoDetectStatus = 'Watching for next Xanax OD';
                saveSession();
                renderOverlay();
                return null;
            }
            return applyDetectedXanaxOverdose(latest);
        }).catch(function () {
            autoDetectStatus = 'OD check failed';
            saveSession();
            renderOverlay();
            return null;
        });
    }

    function detectRoleFromProfile(profileData) {
        var playerId = String((profileData && (profileData.player_id || profileData.playerID || profileData.id)) || '');
        var name = String((profileData && (profileData.name || profileData.username)) || 'Member');
        var faction = profileData && profileData.faction ? profileData.faction : {};
        var factionId = normalizeFactionId(faction && (faction.faction_id || faction.ID || faction.id));
        var factionPosition = String(faction && faction.position || '').toLowerCase();
        var lockedFaction = normalizeFactionId(factionIdLock || '');
        var isFactionMember = !!factionId;
        var isLockedIn = !lockedFaction || (factionId && factionId === lockedFaction);
        var isAdminUser = ADMIN_USER_IDS.indexOf(playerId) >= 0;
        var isFactionStaff = factionPosition === 'leader' || factionPosition === 'co-leader' || factionPosition === 'coleader';
        var role = isAdminUser || (isFactionStaff && isLockedIn) ? 'admin' : 'member';

        if (!isFactionMember) {
            return { ok: false, error: 'This API key is not in a faction.' };
        }
        if (!isLockedIn) {
            return { ok: false, error: 'This API key is not in the locked faction.' };
        }

        return {
            ok: true,
            role: role,
            name: name,
            playerId: playerId,
            factionId: factionId,
            factionPosition: factionPosition
        };
    }

    function loginWithApiKey() {
        var keyEl = overlay && overlay.querySelector('#si-login-api-key');
        var factionEl = overlay && overlay.querySelector('#si-faction-id-lock');
        var apiKey = keyEl ? String(keyEl.value || '').trim() : String(memberApiKey || '').trim();
        var lockedFaction = factionEl ? String(factionEl.value || '').trim() : String(factionIdLock || '').trim();

        if (!apiKey) {
            window.alert('Enter a Torn API key first.');
            return Promise.resolve(null);
        }

        memberApiKey = apiKey;
        factionIdLock = lockedFaction;
        backendStatus = 'Checking API key...';
        lastSyncAt = new Date().toLocaleString();
        saveSession();
        renderOverlay();

        return getTornIdentity(apiKey).then(function (data) {
            if (data && data.error) {
                backendStatus = 'API login failed';
                lastSyncAt = new Date().toLocaleString();
                saveSession();
                renderOverlay();
                window.alert(data.error.error || 'Torn API login failed.');
                return data;
            }

            var detected = detectRoleFromProfile(data || {});
            if (!detected.ok) {
                sessionRole = 'guest';
                sessionName = 'Guest';
                backendStatus = 'API login blocked';
                lastSyncAt = new Date().toLocaleString();
                saveSession();
                renderOverlay();
                window.alert(detected.error || 'API login blocked.');
                return detected;
            }

            sessionRole = detected.role || 'member';
            sessionName = detected.name || 'Member';
            authMode = 'torn-api';
            backendStatus = 'API login ok';
            lastSyncAt = new Date().toLocaleString();
            saveSession();
            renderOverlay();
            startAdminClaimNotifications();
            startMemberAutoDetection();
            startWarStackWatch();
            refreshFinancialSummary(false).catch(function () {});
            return detected;
        }).catch(function () {
            backendStatus = 'API login failed';
            lastSyncAt = new Date().toLocaleString();
            saveSession();
            renderOverlay();
            window.alert('Could not verify this Torn API key.');
            return null;
        });
    }

    function logoutSession() {
        sessionRole = 'guest';
        sessionName = 'Guest';
        financialSummary = {};
        warStackState = { enabled: false, visible: false, active: false, statusText: 'Inactive' };
        authMode = memberApiKey ? 'torn-api' : 'local';
        saveSession();
        renderOverlay();
        startAdminClaimNotifications();
        startMemberAutoDetection();
        startWarStackWatch();
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
        if (!stackMatchesPlan(selectedPlan, claimStack)) {
            window.alert('Stack type does not match the selected plan rule: ' + getPlanRuleText(selectedPlan));
            return;
        }
        if (!claimId) claimId = makeClaimId();
        selectedClaimId = claimId;
        claimStatus = 'Pending review';
        upsertCurrentClaimRecord();
        addClaimHistoryEntry((sessionName || 'Member') + ' submitted claim ' + claimId + ' for ' + (selectedPlan || 'No plan') + '.');
        saveSession();
        pushCurrentClaimToBackend();
        activeTab = 'claims';
        renderOverlay();
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

            if (mode === 'oldest') {
                return String(a && a.id || '').localeCompare(String(b && b.id || ''));
            }
            if (mode === 'member_az') {
                var byMember = String(a && a.member || '').localeCompare(String(b && b.member || ''));
                if (byMember !== 0) return byMember;
                return String(b && b.id || '').localeCompare(String(a && a.id || ''));
            }
            if (mode === 'status') {
                var byStatus = getStatusSortRank(a && a.status).valueOf() - getStatusSortRank(b && b.status).valueOf();
                if (byStatus !== 0) return byStatus;
                return String(b && b.id || '').localeCompare(String(a && a.id || ''));
            }
            return String(b && b.id || '').localeCompare(String(a && a.id || ''));
        });
        return arr;
    }

    function getFilteredClaimsDbItems() {
        var items = getClaimsDbItems();
        var filtered = items.filter(function (item) {
            if (!item) return false;
            var statusOk = claimFilterStatus === 'all' || String(item.status || '') === String(claimFilterStatus || '');
            var memberNeedle = String(claimFilterMember || '').trim().toLowerCase();
            var memberHay = String(item.member || '').toLowerCase();
            var memberOk = !memberNeedle || memberHay.indexOf(memberNeedle) >= 0;
            return statusOk && memberOk;
        });

        filtered = sortClaimsItems(filtered);

        if (isMember() && !isAdmin()) {
            return filtered.filter(function (item) {
                return String(item && item.member || '').toLowerCase() === String(sessionName || '').toLowerCase();
            });
        }

        return filtered;
    }

    function updateClaimFilters() {
        var statusEl = overlay && overlay.querySelector('#si-claim-filter-status');
        var memberEl = overlay && overlay.querySelector('#si-claim-filter-member');
        var sortEl = overlay && overlay.querySelector('#si-claim-sort-mode');
        if (statusEl) claimFilterStatus = statusEl.value || 'all';
        if (memberEl) claimFilterMember = (memberEl.value || '').trim();
        if (sortEl) claimSortMode = sortEl.value || 'newest';
        saveSession();

        var filtered = getFilteredClaimsDbItems();
        if (filtered.length) {
            var stillVisible = filtered.some(function (item) { return item && item.id === selectedClaimId; });
            if (!stillVisible) {
                selectedClaimId = filtered[0].id || '';
                syncCurrentFromSelectedClaim();
                saveSession();
            }
        }
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
        var verification = getPlanVerificationConfig(selectedPlan, planActivationStage);
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
            requiredPaymentItem: verification.paymentItem || '',
            requiredPaymentQty: verification.paymentQty || '',
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
        fetchSelectedClaimHistory();
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
        pushCurrentClaimToBackend();
        activeTab = 'claims';
        renderOverlay();
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
                            var json = JSON.parse(res.responseText || '{}');
                            resolve(json);
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

    function testBackendConnection() {
        return apiRequest('GET', '/api/health', null).then(function (data) {
            backendStatus = data && data.ok ? 'Connected' : 'Health check failed';
            lastSyncAt = new Date().toLocaleString();
            saveSession();
            renderOverlay();
            return data;
        }).catch(function (err) {
            backendStatus = 'Connection failed';
            lastSyncAt = new Date().toLocaleString();
            saveSession();
            renderOverlay();
            throw err;
        });
    }

    function syncClaimsFromBackend() {
        return apiRequest('POST', '/api/claims/pull', { secret: syncSecret }).then(function (data) {
            if (data && Array.isArray(data.claims)) {
                claimsDb = JSON.stringify(data.claims);
                notifyAdminOfNewClaims(data.claims);
                if (!selectedClaimId && data.claims.length) selectedClaimId = data.claims[0].id || '';
                syncCurrentFromSelectedClaim();
                backendStatus = 'Claims pulled';
                lastSyncAt = new Date().toLocaleString();
                saveSession();
                refreshFinancialSummary(false).catch(function () {});
                renderOverlay();
            }
            return data;
        }).catch(function (err) {
            backendStatus = 'Pull failed';
            lastSyncAt = new Date().toLocaleString();
            saveSession();
            renderOverlay();
            throw err;
        });
    }

    function buildServerAuthPayload() {
        return {
            mode: authMode || 'local',
            username: authUser || '',
            passcode: authPass || '',
            api_key: memberApiKey || '',
            faction_id: factionIdLock || ''
        };
    }

    function pushCurrentClaimToBackend() {
        if (!claimId) return Promise.resolve(null);

        var action = isAdmin()
            ? 'admin_update'
            : (isMember() ? 'member_submit' : 'guest');

        var verification = getPlanVerificationConfig(selectedPlan, planActivationStage);
        var payload = {
            secret: syncSecret,
            action: action,
            auth: buildServerAuthPayload(),
            claim: {
                id: claimId || '',
                plan: selectedPlan || 'None',
                status: claimStatus || 'Not submitted',
                note: claimNote || '',
                loss: claimLoss || '',
                proof: claimProof || '',
                stack: claimStack || '',
                payout: payoutAmount || '',
                decision: decisionNote || '',
                member: sessionName || 'Guest',
                requiredPaymentItem: verification.paymentItem || '',
                requiredPaymentQty: verification.paymentQty || '',
                updatedAt: new Date().toLocaleString()
            }
        };

        return apiRequest('POST', '/api/claims/push', payload).then(function (data) {
            backendStatus = data && data.ok ? 'Claim pushed' : ((data && data.error) ? data.error : 'Push failed');
            lastSyncAt = new Date().toLocaleString();
            if (data && data.claim) {
                claimStatus = data.claim.status || claimStatus;
                payoutAmount = data.claim.payout || payoutAmount;
                decisionNote = data.claim.decision || decisionNote;
                selectedPlan = data.claim.plan || selectedPlan;
                claimNote = data.claim.note || claimNote;
                claimLoss = data.claim.loss || claimLoss;
                claimProof = data.claim.proof || claimProof;
                claimStack = data.claim.stack || claimStack;
                upsertCurrentClaimRecord();
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

    function saveSyncSettingsFromOverlay() {
        var apiEl = overlay && overlay.querySelector('#si-api-base');
        var secEl = overlay && overlay.querySelector('#si-sync-secret');
        if (apiEl) apiBase = (apiEl.value || '').trim();
        if (secEl) syncSecret = (secEl.value || '').trim();
        saveSession();
        renderOverlay();
    }


    function saveBackendAuthFromOverlay() {
        var userEl = overlay && overlay.querySelector('#si-auth-user');
        var passEl = overlay && overlay.querySelector('#si-auth-pass');
        var keyEl = overlay && overlay.querySelector('#si-member-api-key');
        var factionEl = overlay && overlay.querySelector('#si-faction-id-lock');
        if (userEl) authUser = (userEl.value || '').trim();
        if (passEl) authPass = (passEl.value || '').trim();
        if (keyEl) memberApiKey = (keyEl.value || '').trim();
        if (factionEl) factionIdLock = (factionEl.value || '').trim();
        saveSession();
        renderOverlay();
    }

    function backendAdminLogin() {
        saveBackendAuthFromOverlay();
        var adminApiKey = String(authPass || memberApiKey || '').trim();
        if (!apiBase || !adminApiKey) {
            window.alert('Fill in API Base URL and an admin Torn API key first.');
            return Promise.resolve(null);
        }
        return apiRequest('POST', '/api/auth/admin-key-login', {
            api_key: adminApiKey,
            secret: syncSecret
        }).then(function (data) {
            if (data && data.ok && data.user) {
                sessionName = data.user.name || data.user.username || 'Admin';
                sessionRole = data.user.role || 'admin';
                authMode = 'backend-admin';
                backendStatus = 'Backend admin login ok';
                lastSyncAt = new Date().toLocaleString();
                saveSession();
                renderOverlay();
                startAdminClaimNotifications();
                startMemberAutoDetection();
                return data;
            }
            window.alert((data && data.error) ? data.error : 'Backend admin login failed.');
            return data;
        }).catch(function () {
            backendStatus = 'Backend admin login failed';
            lastSyncAt = new Date().toLocaleString();
            saveSession();
            renderOverlay();
            return null;
        });
    }

    function backendMemberFactionLogin() {
        saveBackendAuthFromOverlay();
        if (!apiBase || !memberApiKey || !factionIdLock) {
            window.alert('Fill in API Base URL, Member API Key, and Faction ID lock first.');
            return Promise.resolve(null);
        }
        return apiRequest('POST', '/api/auth/faction-login', {
            api_key: memberApiKey,
            faction_id: factionIdLock,
            secret: syncSecret
        }).then(function (data) {
            if (data && data.ok && data.user) {
                sessionName = data.user.name || data.user.username || 'Member';
                sessionRole = data.user.role || 'member';
                authMode = 'backend-faction';
                backendStatus = 'Faction member login ok';
                lastSyncAt = new Date().toLocaleString();
                saveSession();
                renderOverlay();
                return data;
            }
            window.alert((data && data.error) ? data.error : 'Faction member login failed.');
            return data;
        }).catch(function () {
            backendStatus = 'Faction member login failed';
            lastSyncAt = new Date().toLocaleString();
            saveSession();
            renderOverlay();
            return null;
        });
    }

    function backendWhoAmI() {
        saveBackendAuthFromOverlay();
        if (!apiBase) return Promise.resolve(null);

        if (authMode === 'backend-faction') {
            if (!memberApiKey || !factionIdLock) return Promise.resolve(null);
            return apiRequest('POST', '/api/auth/faction-login', {
                api_key: memberApiKey,
                faction_id: factionIdLock,
                secret: syncSecret
            }).then(function (data) {
                if (data && data.ok && data.user) {
                    sessionName = data.user.name || data.user.username || 'Member';
                    sessionRole = data.user.role || 'member';
                    saveSession();
                    renderOverlay();
                }
                return data;
            }).catch(function () { return null; });
        }

        var adminApiKey = String(authPass || memberApiKey || '').trim();
        if (!adminApiKey) return Promise.resolve(null);
        return apiRequest('POST', '/api/auth/admin-key-login', {
            api_key: adminApiKey,
            secret: syncSecret
        }).then(function (data) {
            if (data && data.ok && data.user) {
                sessionName = data.user.name || data.user.username || 'Admin';
                sessionRole = data.user.role || 'admin';
                saveSession();
                renderOverlay();
            }
            return data;
        }).catch(function () { return null; });
    }

    function parseMoneyLoose(value) {
        var s = String(value || '').replace(/[^0-9.]/g, '');
        var n = parseFloat(s);
        return isNaN(n) ? 0 : n;
    }

    function inferPlanPaymentQty(item) {
        if (!item) return 0;
        var plan = String(item.plan || '').trim();
        var stack = String(item.stack || '').trim().toLowerCase();
        var note = String(item.note || '').toLowerCase();

        if (plan === 'Pride Sin') return 2;
        if (plan === 'Greed Sin') return 1;
        if (plan === 'Envy Sin') return 5;
        if (plan === 'Wrath Sin') {
            if (stack.indexOf('4') >= 0 || stack.indexOf('fourth') >= 0 || stack.indexOf('4th') >= 0 || note.indexOf('20 xanax') >= 0) return 20;
            if (stack.indexOf('3') >= 0 || stack.indexOf('third') >= 0 || stack.indexOf('3rd') >= 0 || note.indexOf('15 xanax') >= 0) return 15;
            if (stack.indexOf('2') >= 0 || stack.indexOf('second') >= 0 || stack.indexOf('2nd') >= 0 || note.indexOf('10 xanax') >= 0) return 10;
            return 5;
        }
        return 0;
    }

    function getOverviewStats() {
        var items = getClaimsDbItems();
        var verifiedItems = items.filter(function (i) {
            var status = String(i && i.status || '');
            return ['Paid', 'Under review', 'Pending review'].indexOf(status) >= 0;
        });
        var localTotalXanaxReceived = verifiedItems.reduce(function (sum, i) {
            return sum + inferPlanPaymentQty(i);
        }, 0);
        var localFactionShare = localTotalXanaxReceived * 0.15;
        var backendTotal = Number(financialSummary && financialSummary.verified_xanax_in);
        var backendFaction = Number(financialSummary && financialSummary.faction_cut_xanax);
        var backendPool = Number(financialSummary && financialSummary.insurance_pool_xanax);
        return {
            total: items.length,
            open: items.filter(function (i) { return ['Pending review', 'Under review'].indexOf(String(i && i.status || '')) >= 0; }).length,
            paid: items.filter(function (i) { return String(i && i.status || '') === 'Paid'; }).length,
            denied: items.filter(function (i) { return String(i && i.status || '') === 'Denied'; }).length,
            payouts: items.reduce(function (sum, i) { return sum + parseMoneyLoose(i && i.payout); }, 0),
            members: Array.from(new Set(items.map(function (i) { return String(i && i.member || '').trim(); }).filter(Boolean))).length,
            totalXanaxReceived: isFinite(backendTotal) ? backendTotal : localTotalXanaxReceived,
            factionShare: isFinite(backendFaction) ? backendFaction : localFactionShare,
            insurancePool: isFinite(backendPool) ? backendPool : (localTotalXanaxReceived - localFactionShare),
            summarySource: isFinite(backendTotal) ? 'backend' : 'local'
        };
    }

    function getPlanRuleText(plan) {
        var p = String(plan || '');
        if (p === 'Pride Sin') return 'single xanax / 1st use only';
        if (p === 'Wrath Sin') return '1st, 2nd, 3rd, 4th stack only';
        if (p === 'Envy Sin') return 'start with 1000 energy and 0 booster cooldown';
        if (p === 'Greed Sin') return 'war stack / 0 to 150 energy';
        return 'select a plan first';
    }

    function stackMatchesPlan(plan, stackText) {
        var t = String(stackText || '').toLowerCase();
        if (!plan || plan === 'None') return false;
        if (plan === 'Pride Sin') {
            return t.indexOf('single') >= 0 || t.indexOf('1st') >= 0 || t.indexOf('first') >= 0 || t === '1';
        }
        if (plan === 'Wrath Sin') {
            return t.indexOf('1st') >= 0 || t.indexOf('2nd') >= 0 || t.indexOf('3rd') >= 0 || t.indexOf('4th') >= 0 || t.indexOf('first') >= 0 || t.indexOf('second') >= 0 || t.indexOf('third') >= 0 || t.indexOf('fourth') >= 0;
        }
        if (plan === 'Envy Sin') {
            return t.indexOf('full') >= 0 || t.indexOf('happy jump') >= 0;
        }
        if (plan === 'Greed Sin') {
            return t.indexOf('greed') >= 0 || t.indexOf('war') >= 0 || t.indexOf('stack') >= 0 || t.indexOf('0-150') >= 0 || t.indexOf('0 to 150') >= 0 || /^150?$/.test(t);
        }
        return false;
    }

    function getPayoutGuide(plan) {
        var p = String(plan || '');
        if (p === 'Pride Sin') return 'Guide: small single-use payout';
        if (p === 'Wrath Sin') return 'Guide: medium stacked-use payout';
        if (p === 'Envy Sin') return 'Guide: 30 minute Envy window';
        if (p === 'Greed Sin') return 'Guide: 2 Feathery Hotel Coupons reward';
        return 'Guide: no plan selected';
    }


    function getAdminQueueSummary() {
        var items = getClaimsDbItems();
        return {
            total: items.length,
            pending: items.filter(function (i) { return String(i && i.status || '') === 'Pending review'; }).length,
            review: items.filter(function (i) { return String(i && i.status || '') === 'Under review'; }).length,
            approved: items.filter(function (i) { return String(i && i.status || '') === 'Approved'; }).length,
            denied: items.filter(function (i) { return String(i && i.status || '') === 'Denied'; }).length,
            paid: items.filter(function (i) { return String(i && i.status || '') === 'Paid'; }).length
        };
    }

    function saveAdminReviewDraft() {
        if (!isAdmin()) {
            window.alert('Admin login required.');
            return;
        }
        if (!claimId) {
            window.alert('Select a claim first.');
            return;
        }
        upsertCurrentClaimRecord();
        addClaimHistoryEntry((sessionName || 'Admin') + ' saved admin review notes for claim ' + claimId + '.');
        renderOverlay();
    }

    function selectNextOpenClaim() {
        var items = getFilteredClaimsDbItems();
        if (!items.length) {
            window.alert('No visible claims found.');
            return;
        }
        var openItems = items.filter(function (item) {
            var s = String(item && item.status || '');
            return s === 'Pending review' || s === 'Under review' || s === 'Approved';
        });
        var pool = openItems.length ? openItems : items;
        var currentIndex = pool.findIndex(function (item) { return item && item.id === selectedClaimId; });
        var nextItem = pool[(currentIndex + 1) % pool.length] || pool[0];
        if (!nextItem) {
            window.alert('No next claim found.');
            return;
        }
        selectClaimById(nextItem.id || '');
    }

    function getMemberClaimSummary() {
        var items = getClaimsDbItems().filter(function (item) {
            return String(item && item.member || '').toLowerCase() === String(sessionName || '').toLowerCase();
        });
        return {
            total: items.length,
            pending: items.filter(function (i) { return String(i.status || '') === 'Pending review'; }).length,
            review: items.filter(function (i) { return String(i.status || '') === 'Under review'; }).length,
            approved: items.filter(function (i) { return String(i.status || '') === 'Approved'; }).length,
            denied: items.filter(function (i) { return String(i.status || '') === 'Denied'; }).length,
            paid: items.filter(function (i) { return String(i.status || '') === 'Paid'; }).length,
        };
    }

    function getStatusClass(status) {
        var v = String(status || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        return 'status-' + v.replace(/^-+|-+$/g, '');
    }

    function getServerClaimHistoryItems() {
        try {
            var arr = JSON.parse(serverClaimHistory || '[]');
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            return [];
        }
    }

    function fetchSelectedClaimHistory() {
        if (!claimId) return Promise.resolve(null);
        return apiRequest('POST', '/api/claims/history', {
            secret: syncSecret,
            auth: buildServerAuthPayload(),
            claim_id: claimId
        }).then(function (data) {
            if (data && data.ok && Array.isArray(data.history)) {
                serverClaimHistory = JSON.stringify(data.history);
                backendStatus = 'History loaded';
                lastSyncAt = new Date().toLocaleString();
                saveSession();
                renderOverlay();
            }
            return data;
        }).catch(function () {
            backendStatus = 'History load failed';
            lastSyncAt = new Date().toLocaleString();
            saveSession();
            renderOverlay();
            return null;
        });
    }

    function addServerHistoryToCurrentRender(localHtml) {
        var items = getServerClaimHistoryItems();
        if (!items.length) return localHtml;
        return items.map(function (item) {
            return '<div class="si-7ds-history-item">'
                + '<div class="si-7ds-history-time">' + esc(item.createdAt || '') + '</div>'
                + '<div class="si-7ds-history-text">' + esc(item.text || '') + '</div>'
            + '</div>';
        }).join('');
    }

    function bulkSetVisibleClaimsStatus(nextStatus) {
        if (!isAdmin()) {
            window.alert('Admin login required.');
            return;
        }
        var items = getFilteredClaimsDbItems();
        if (!items.length) {
            window.alert('No visible claims to update.');
            return;
        }
        items.forEach(function (item) {
            if (!item || !item.id) return;
            selectedClaimId = item.id;
            syncCurrentFromSelectedClaim();
            claimStatus = nextStatus;
            upsertCurrentClaimRecord();
        });
        saveSession();
        renderOverlay();
        window.alert('Updated ' + String(items.length) + ' visible claims to ' + nextStatus + '.');
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
  grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
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
#si-7ds-overlay .si-7ds-tabrow-war {
  display: flex !important;
  justify-content: center !important;
  padding-top: 10px !important;
}
#si-7ds-overlay .si-7ds-tabrow-war .si-7ds-tab {
  width: min(240px, 100%) !important;
  min-width: 0 !important;
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
#si-7ds-overlay .si-backend-status {
  border-radius: 12px !important;
  border: 1px solid rgba(201,162,80,.16) !important;
  background: rgba(255,255,255,.02) !important;
  padding: 10px !important;
  display: grid !important;
  gap: 6px !important;
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
#si-7ds-overlay .si-7ds-btn.armed {
  background: linear-gradient(180deg, rgba(26, 122, 55, .96), rgba(14, 78, 34, .98)) !important;
  border: 1px solid rgba(95,226,130,.55) !important;
  color: #ecfff1 !important;
  box-shadow: 0 0 0 1px rgba(255,255,255,.04) inset, 0 0 16px rgba(62,196,100,.22) !important;
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
#si-7ds-overlay .si-7ds-filter-grid {
  display: grid !important;
  grid-template-columns: 1fr 1fr !important;
  gap: 10px !important;
}
#si-7ds-overlay .si-7ds-status-badge {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  min-height: 28px !important;
  padding: 0 12px !important;
  border-radius: 999px !important;
  font-size: 11px !important;
  font-weight: 900 !important;
  letter-spacing: .6px !important;
  text-transform: uppercase !important;
  border: 1px solid rgba(201,162,80,.18) !important;
  background: rgba(119,17,22,.22) !important;
  color: #f1dfab !important;
}
#si-7ds-overlay .si-7ds-status-badge.status-pending-review {
  background: rgba(114, 82, 15, .28) !important;
}
#si-7ds-overlay .si-7ds-status-badge.status-under-review {
  background: rgba(79, 54, 115, .30) !important;
}
#si-7ds-overlay .si-7ds-status-badge.status-approved {
  background: rgba(20, 92, 45, .30) !important;
}
#si-7ds-overlay .si-7ds-status-badge.status-denied {
  background: rgba(120, 26, 32, .32) !important;
}
#si-7ds-overlay .si-7ds-status-badge.status-paid {
  background: rgba(14, 97, 93, .32) !important;
}
#si-7ds-overlay .si-7ds-admin-actions-grid {
  display: grid !important;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  gap: 8px !important;
}
#si-7ds-overlay .si-7ds-btn.confirm {
  background: linear-gradient(180deg, rgba(20, 112, 58, .94), rgba(12, 66, 34, .98)) !important;
}
#si-7ds-overlay .si-7ds-admin-note-box {
  border-radius: 10px !important;
  border: 1px solid rgba(201,162,80,.14) !important;
  background: rgba(255,255,255,.02) !important;
  padding: 10px !important;
}
#si-7ds-overlay .si-7ds-summary-grid {
  display: grid !important;
  grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  gap: 8px !important;
}
#si-7ds-overlay .si-7ds-summary-tile {
  border-radius: 10px !important;
  border: 1px solid rgba(201,162,80,.14) !important;
  background: rgba(255,255,255,.02) !important;
  padding: 10px !important;
  text-align: center !important;
}
#si-7ds-overlay .si-7ds-summary-num {
  font-size: 16px !important;
  font-weight: 900 !important;
  color: #f7e4a7 !important;
  line-height: 1.1 !important;
}
#si-7ds-overlay .si-7ds-summary-label {
  margin-top: 4px !important;
  font-size: 10px !important;
  font-weight: 800 !important;
  color: rgba(241,223,171,.76) !important;
  text-transform: uppercase !important;
  letter-spacing: .7px !important;
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
  #si-7ds-overlay .si-7ds-tabrow-war {
    padding-top: 8px !important;
  }
  #si-7ds-overlay .si-7ds-tabrow-war .si-7ds-tab {
    width: 100% !important;
    max-width: 220px !important;
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
        var keys = getVisibleTabKeys();
        if (keys.indexOf(activeTab) < 0 && activeTab !== 'warstack') activeTab = 'overview';
        return '<div class="si-7ds-tabrow">'
            + keys.map(function (key) {
                return '<button type="button" class="si-7ds-tab' + (activeTab === key ? ' active' : '') + '" data-tab="' + key + '">' + TAB_LABELS[key] + '</button>';
            }).join('')
            + '</div>';
    }

    function renderWarStackRow() {
        if (!isWarStackTabAvailable()) return '';
        return '<div class="si-7ds-tabrow si-7ds-tabrow-war">'
            + '<button type="button" class="si-7ds-tab' + (activeTab === 'warstack' ? ' active' : '') + '" data-tab="warstack">' + getWarStackButtonLabel() + '</button>'
            + '</div>';
    }

    function renderTabContent() {
        if (activeTab === 'overview') {
            var overviewStats = getOverviewStats();
            return ''
                + '<div class="si-7ds-card">'
                +   '<div class="si-7ds-card-title">Overview</div>'
                +   '<div class="si-7ds-summary-grid">'
                +     '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + String(overviewStats.total) + '</div><div class="si-7ds-summary-label">Claims</div></div>'
                +     '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + String(overviewStats.open) + '</div><div class="si-7ds-summary-label">Open</div></div>'
                +     '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + String(overviewStats.paid) + '</div><div class="si-7ds-summary-label">Paid</div></div>'
                +     '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + String(overviewStats.denied) + '</div><div class="si-7ds-summary-label">Denied</div></div>'
                +     '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + String(overviewStats.members) + '</div><div class="si-7ds-summary-label">Members</div></div>'
                +     '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">$' + String(Math.round(overviewStats.payouts)) + '</div><div class="si-7ds-summary-label">Payouts</div></div>'
                +     '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + String(Math.round(overviewStats.totalXanaxReceived * 100) / 100) + '</div><div class="si-7ds-summary-label">Verified Xanax In</div></div>'
                +     '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + String(Math.round(overviewStats.factionShare * 100) / 100) + '</div><div class="si-7ds-summary-label">Faction 15% Cut</div></div>'
                +     '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + String(Math.round(overviewStats.insurancePool * 100) / 100) + '</div><div class="si-7ds-summary-label">Insurance Pool 85%</div></div>'
                +   '</div>'
                +   '<div class="si-7ds-text" style="margin-top:12px;">15% of verified Xanax plan payments goes to faction. Source: ' + (overviewStats.summarySource === 'backend' ? 'Render backend verified receipts.' : 'Local synced claim estimate.') + '</div>'
                + '</div>'
                + (isAdmin() ? ''
                + '<div class="si-7ds-card">'
                +   '<div class="si-7ds-card-title">War Stack Control</div>'
                +   '<div class="si-7ds-text">Faction-wide War Stack state: <strong>' + (isWarStackTabAvailable() ? 'Active' : 'Inactive') + '</strong></div>'
                +   '<div class="si-7ds-text">' + esc((warStackState && warStackState.statusText) || 'No shared state loaded yet.') + '</div>'
                +   '<div class="si-7ds-plan-actions">'
                +     '<button type="button" class="si-7ds-btn" data-action="warstack-enable">Activate</button>'
                +     '<button type="button" class="si-7ds-btn alt" data-action="warstack-disable">Deactivate</button>'
                +   '</div>'
                + '</div>' : '');
        }

        if (activeTab === 'plans') {
            return ''
                + '<div class="si-7ds-plan-box">'
                +   '<div class="si-7ds-plan-top">'
                +     '<div><div class="si-7ds-plan-name">Pride Sin</div><div class="si-7ds-plan-tier">Basic coverage</div></div>'
                +     '<span class="si-7ds-pill">Pride plan</span>'
                +   '</div>'
                +   '<div class="si-7ds-plan-grid">'
                +     '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Coverage</div><div class="si-7ds-plan-stat-value">6 Xanax</div></div>'
                +     '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Payment</div><div class="si-7ds-plan-stat-value">2 Xanax</div></div>'
                +     '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Window</div><div class="si-7ds-plan-stat-value">30 mins</div></div>'
                +     '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Terms</div><div class="si-7ds-plan-stat-value">Any energy start</div></div>'
                +   '</div>'
                +   '<div class="si-7ds-plan-actions">'
                +     '<button type="button" class="si-7ds-btn" data-action="select-plan" data-plan="Pride Sin">Select</button>'
                +     '<button type="button" class="si-7ds-btn ' + (isPlanArmedActive('Pride Sin') ? 'armed' : 'alt') + '" data-action="arm-plan" data-plan="Pride Sin">' + (isPlanArmedActive('Pride Sin') ? 'Pride Active' : 'Activate Pride') + '</button>'
                +     '<button type="button" class="si-7ds-btn alt" data-action="open-terms" data-plan="Pride Sin">Terms</button>'
                +   '</div>'
                + '</div>'

                + '<div class="si-7ds-plan-box">'
                +   '<div class="si-7ds-plan-top">'
                +     '<div><div class="si-7ds-plan-name">Wrath Sin</div><div class="si-7ds-plan-tier">Standard coverage</div></div>'
                +     '<span class="si-7ds-pill">Stage plan</span>'
                +   '</div>'
                +   '<div class="si-7ds-plan-grid">'
                +     '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Payment</div><div class="si-7ds-plan-stat-value">2 per stage</div></div>'
                +     '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Window</div><div class="si-7ds-plan-stat-value">30 mins / stage</div></div>'
                +     '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Coverage</div><div class="si-7ds-plan-stat-value">5 / 10 / 15 / 20</div></div>'
                +     '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Terms</div><div class="si-7ds-plan-stat-value">Start with 0 energy</div></div>'
                +   '</div>'
                +   '<div class="si-7ds-plan-actions">'
                +     '<button type="button" class="si-7ds-btn" data-action="select-plan" data-plan="Wrath Sin">Select</button>'
                +     '<button type="button" class="si-7ds-btn ' + (isPlanArmedActive('Wrath Sin', '1') ? 'armed' : 'alt') + '" data-action="arm-plan" data-plan="Wrath Sin" data-stage="1">Stage 1 Arm (5x)</button>'
                +     '<button type="button" class="si-7ds-btn ' + (isPlanArmedActive('Wrath Sin', '2') ? 'armed' : 'alt') + '" data-action="arm-plan" data-plan="Wrath Sin" data-stage="2">Stage 2 Arm (10x)</button>'
                +     '<button type="button" class="si-7ds-btn ' + (isPlanArmedActive('Wrath Sin', '3') ? 'armed' : 'alt') + '" data-action="arm-plan" data-plan="Wrath Sin" data-stage="3">Stage 3 Arm (15x)</button>'
                +     '<button type="button" class="si-7ds-btn ' + (isPlanArmedActive('Wrath Sin', '4') ? 'armed' : 'alt') + '" data-action="arm-plan" data-plan="Wrath Sin" data-stage="4">Stage 4 Arm (20x)</button>'
                +     '<button type="button" class="si-7ds-btn alt" data-action="open-terms" data-plan="Wrath Sin">Terms</button>'
                +   '</div>'
                + '</div>'

                + '<div class="si-7ds-plan-box">'
                +   '<div class="si-7ds-plan-top">'
                +     '<div><div class="si-7ds-plan-name">Envy Sin</div><div class="si-7ds-plan-tier">Premium coverage</div></div>'
                +     '<span class="si-7ds-pill">Full jump</span>'
                +   '</div>'
                +   '<div class="si-7ds-plan-grid">'
                +     '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Payment</div><div class="si-7ds-plan-stat-value">5 Xanax</div></div>'
                +     '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Window</div><div class="si-7ds-plan-stat-value">30 mins</div></div>'
                +     '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Coverage</div><div class="si-7ds-plan-stat-value">25 Xanax and 3 E-DVD\'s</div></div>'
                +     '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Terms</div><div class="si-7ds-plan-stat-value">1000 energy and 0 booster cooldown</div></div>'
                +   '</div>'
                +   '<div class="si-7ds-plan-actions">'
                +     '<button type="button" class="si-7ds-btn" data-action="select-plan" data-plan="Envy Sin">Select</button>'
                +     '<button type="button" class="si-7ds-btn ' + (isPlanArmedActive('Envy Sin') ? 'armed' : 'alt') + '" data-action="arm-plan" data-plan="Envy Sin">' + (isPlanArmedActive('Envy Sin') ? 'Envy Active' : 'Activate Envy') + '</button>'
                +     '<button type="button" class="si-7ds-btn alt" data-action="open-terms" data-plan="Envy Sin">Terms</button>'
                +   '</div>'
                + '</div>'

                + '<div class="si-7ds-selected-banner">Selected plan: <strong>' + selectedPlan + '</strong></div>'
                + '<div class="si-7ds-card">'
                +   '<div class="si-7ds-card-title">Plan Arm Status</div>'
                +   '<div class="si-7ds-summary-grid">'
                +     '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + esc(getArmedPlanDisplayName()) + '</div><div class="si-7ds-summary-label">Armed plan</div></div>'
                +     '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + esc(planActivationAt || '—') + '</div><div class="si-7ds-summary-label">Armed at</div></div>'
                +     '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + esc(planActivationExpiresAt || '—') + '</div><div class="si-7ds-summary-label">Expires</div></div>'
                +     '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + esc(planActivationStage || '—') + '</div><div class="si-7ds-summary-label">Wrath stage</div></div>'
                +   '</div>'
                +   '<div class="si-7ds-text"><strong>Window remaining:</strong> <span id="si-7ds-armed-countdown">' + esc(isPlanArmedActive() ? formatDurationMs(getArmedCountdownMs()) : 'Expired') + '</span></div>'
                +   '<div class="si-7ds-text"><strong>Energy at arm:</strong> ' + esc(planActivationEnergy || '—') + '</div>'
                +   '<div class="si-7ds-text"><strong>Booster CD at arm:</strong> ' + esc(planActivationBoosterCd || '—') + '</div>'
                +   '<div class="si-7ds-text"><strong>Required payment:</strong> ' + esc(getArmedPaymentDisplay()) + '</div>'
                +   '<div class="si-7ds-text"><strong>Auto detect:</strong> ' + esc(autoDetectStatus || 'Idle') + (autoOdDetectedAt ? ' | Last hit: ' + esc(autoOdDetectedAt) : '') + '</div>'
                +   '<div class="si-7ds-plan-actions">'
                +     '<button type="button" class="si-7ds-btn alt" data-action="stop-armed-plan">Stop Plan</button>'
                +   '</div>'
                + '</div>';
        }

        if (activeTab === 'warstack') {
            return ''
                + '<div class="si-7ds-card">'
                +   '<div class="si-7ds-card-title">War Stack Plans</div>'
                +   '<div class="si-7ds-text">This tab is controlled by the shared War Stack toggle from Overview. Turn it on any time to arm War Stack plans and keep the same claim verification flow.</div>'
                +   '<div class="si-7ds-text"><strong>War Stack:</strong> ' + esc((warStackState && warStackState.statusText) || 'Inactive') + '</div>'
                +   '<div class="si-7ds-text"><strong>State:</strong> <span id="si-7ds-war-start-countdown">' + esc(getWarStackCountdownLabel()) + '</span></div>'
                +   '<div class="si-7ds-text"><strong>Updated:</strong> ' + esc((warStackState && warStackState.updatedAt) || (warStackState && warStackState.checkedAt) || 'Unknown') + '</div>'
                + '</div>'
                + '<div class="si-7ds-plan-box">'
                +   '<div class="si-7ds-plan-top">'
                +     '<div><div class="si-7ds-plan-name">Greed Sin</div><div class="si-7ds-plan-tier">War stack coverage</div></div>'
                +     '<span class="si-7ds-pill">War only</span>'
                +   '</div>'
                +   '<div class="si-7ds-plan-grid">'
                +     '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Payment</div><div class="si-7ds-plan-stat-value">1 Xanax</div></div>'
                +     '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Terms</div><div class="si-7ds-plan-stat-value">0-150 energy</div></div>'
                +     '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Reward</div><div class="si-7ds-plan-stat-value">2 Feathery Hotel Coupons</div></div>'
                +     '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Window</div><div class="si-7ds-plan-stat-value">30 mins</div></div>'
                +   '</div>'
                +   '<div class="si-7ds-plan-actions">'
                +     '<button type="button" class="si-7ds-btn" data-action="select-plan" data-plan="Greed Sin">Select</button>'
                +     '<button type="button" class="si-7ds-btn ' + (isPlanArmedActive('Greed Sin') ? 'armed' : 'alt') + '" data-action="arm-plan" data-plan="Greed Sin">' + (isPlanArmedActive('Greed Sin') ? 'Greed Active' : 'Activate Greed') + '</button>'
                +     '<button type="button" class="si-7ds-btn alt" data-action="open-terms" data-plan="Greed Sin">Terms</button>'
                +   '</div>'
                + '</div>'
                + '<div class="si-7ds-selected-banner">Selected war plan: <strong>' + esc(selectedPlan || 'None') + '</strong></div>'
                + '<div class="si-7ds-card">'
                +   '<div class="si-7ds-card-title">War Plan Verification</div>'
                +   '<div class="si-7ds-text"><strong>Required payment:</strong> ' + esc(getPlanVerificationConfig(selectedPlan || 'Greed Sin', '').paymentDisplay || '1 Xanax') + '</div>'
                +   '<div class="si-7ds-text"><strong>Reward:</strong> 2 Feathery Hotel Coupons</div>'
                +   '<div class="si-7ds-text"><strong>Arm status:</strong> ' + esc(getWarPlanStatusText('Greed Sin')) + '</div>'
                +   '<div class="si-7ds-text"><strong>Window remaining:</strong> <span id="si-7ds-armed-countdown">' + esc(isPlanArmedActive('Greed Sin') ? formatDurationMs(getArmedCountdownMs()) : 'Expired') + '</span></div>'
                +   '<div class="si-7ds-text"><strong>Energy at arm:</strong> ' + esc(planActivationEnergy || 'Not captured yet') + '</div>'
                +   '<div class="si-7ds-text"><strong>Booster CD at arm:</strong> ' + esc(planActivationBoosterCd || 'Not captured yet') + '</div>'
                +   '<div class="si-7ds-text"><strong>Auto detect:</strong> ' + esc(autoDetectStatus || 'Idle') + (autoOdDetectedAt ? ' | Last hit: ' + esc(autoOdDetectedAt) : '') + '</div>'
                +   '<div class="si-7ds-plan-actions">'
                +     '<button type="button" class="si-7ds-btn alt" data-action="stop-armed-plan">Stop Plan</button>'
                +   '</div>'
                + '</div>';
        }

        if (activeTab === 'claims') {
            syncCurrentFromSelectedClaim();
            var claimOptions = getFilteredClaimsDbItems().length
                ? getFilteredClaimsDbItems().map(function (item) {
                    var label = (item.id || 'No ID')
                        + ' | ' + (item.member || 'Unknown member')
                        + ' | ' + (item.plan || 'No plan')
                        + ' | ' + (item.status || 'No status');
                    var sel = (item.id === selectedClaimId || (!selectedClaimId && item.id === claimId)) ? ' selected' : '';
                    return '<option value="' + esc(item.id || '') + '"' + sel + '>' + esc(label) + '</option>';
                }).join('')
                : '<option value="">No matching claims</option>';

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
                        ? '<strong>Admin review mode:</strong> member fields are read-only.'
                        : '<strong>Member login required:</strong> sign in as a member to edit fields.')
                  + '</div></div>';

            var memberActions = isMember() && !isAdmin()
                ? '<button type="button" class="si-7ds-btn" data-action="submit-claim">Submit Claim</button>'
                : '';

            var adminPanel = isAdmin()
                ? '<div class="si-7ds-card">'
                    + '<div class="si-7ds-card-title">Admin Review</div>'
                    + '<div class="si-7ds-admin-panel">'
                      + '<div class="si-7ds-pillrow">'
                        + '<span class="si-7ds-pill">Admin mode</span>'
                        + '<span class="si-7ds-pill">Claim ' + esc(claimId || 'none') + '</span>'
                        + '<span class="si-7ds-pill">' + esc(claimStatus || 'Not submitted') + '</span>'
                      + '</div>'
                      + '<div class="si-7ds-summary-grid">'
                        + '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + esc((getSelectedClaimRecord() && getSelectedClaimRecord().member) || '—') + '</div><div class="si-7ds-summary-label">Member</div></div>'
                        + '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + esc(selectedPlan || 'None') + '</div><div class="si-7ds-summary-label">Plan</div></div>'
                        + '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + esc((getSelectedClaimRecord() && getSelectedClaimRecord().updatedAt) || '—') + '</div><div class="si-7ds-summary-label">Updated</div></div>'
                      + '</div>'
                      + '<div class="si-7ds-note-box">'
                        + '<div class="si-7ds-text"><strong>Stack:</strong> ' + esc(claimStack || 'Not set') + '</div>'
                        + '<div class="si-7ds-text"><strong>Loss:</strong> ' + esc(claimLoss || 'Not set') + '</div>'
                        + '<div class="si-7ds-text"><strong>Proof:</strong> ' + esc(claimProof || 'Not set') + '</div>'
                        + '<div class="si-7ds-text"><strong>Member note:</strong> ' + esc(claimNote || 'None') + '</div>'
                      + '</div>'
                      + '<div class="si-7ds-field">'
                        + '<label class="si-7ds-label" for="si-payout-amount">Payout Amount</label>'
                        + '<input id="si-payout-amount" class="si-7ds-input" type="text" placeholder="Example: 5 Xanax or 3 E-DVDs" value="' + esc(payoutAmount) + '">'
                      + '</div>'
                      + '<div class="si-7ds-text"><strong>Payout guide:</strong> ' + esc(getPayoutGuide(selectedPlan)) + '</div>'
                      + '<div class="si-7ds-admin-note-box">'
                        + '<div class="si-7ds-field">'
                          + '<label class="si-7ds-label" for="si-decision-note">Decision Note</label>'
                          + '<textarea id="si-decision-note" class="si-7ds-textarea" placeholder="Admin decision notes">' + esc(decisionNote) + '</textarea>'
                        + '</div>'
                      + '</div>'
                      + '<div class="si-7ds-admin-actions-grid">'
                        + '<button type="button" class="si-7ds-btn alt" data-action="save-admin-draft">Save Review Draft</button>'
                        + '<button type="button" class="si-7ds-btn alt" data-action="next-open-claim">Next Open</button>'
                        + '<button type="button" class="si-7ds-btn alt" data-action="review-claim">Mark Review</button>'
                        + '<button type="button" class="si-7ds-btn alt" data-action="approve-claim">Approve</button>'
                        + '<button type="button" class="si-7ds-btn alt" data-action="deny-claim">Deny</button>'
                        + '<button type="button" class="si-7ds-btn confirm" data-action="pay-claim">Confirm Payout</button>'
                      + '</div>'
                      + '<div class="si-7ds-text"><strong>Current payout:</strong> ' + esc(payoutAmount || 'Not set') + '</div>'
                      + '<div class="si-7ds-admin-actions-grid">'
                        + '<button type="button" class="si-7ds-btn alt" data-action="bulk-review">Bulk Review Visible</button>'
                        + '<button type="button" class="si-7ds-btn alt" data-action="bulk-approve">Bulk Approve Visible</button>'
                        + '<button type="button" class="si-7ds-btn alt" data-action="bulk-deny">Bulk Deny Visible</button>'
                        + '<button type="button" class="si-7ds-btn confirm" data-action="bulk-pay">Bulk Pay Visible</button>'
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
                + ((isMember() && !isAdmin())
                    ? '<div class="si-7ds-card">'
                        + '<div class="si-7ds-card-title">Member Dashboard</div>'
                        + '<div class="si-7ds-summary-grid">'
                          + '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + String(getMemberClaimSummary().total) + '</div><div class="si-7ds-summary-label">Total</div></div>'
                          + '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + String(getMemberClaimSummary().pending + getMemberClaimSummary().review) + '</div><div class="si-7ds-summary-label">Open</div></div>'
                          + '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + String(getMemberClaimSummary().paid) + '</div><div class="si-7ds-summary-label">Paid</div></div>'
                        + '</div>'
                      + '</div>'
                    : '')
                + '<div class="si-7ds-card">'
                +   '<div class="si-7ds-card-title">Claims</div>'
                +   '<div class="si-7ds-field">'
                +     '<select id="si-claim-select" class="si-7ds-select">' + claimOptions + '</select>'
                +   '</div>'
                + '</div>'
                + '<div class="si-7ds-card">'
                +   '<div class="si-7ds-card-title">Claim Summary</div>'
                +   '<div class="si-7ds-text"><strong>ID:</strong> ' + esc(claimId || 'Not assigned yet') + '</div>'
                +   '<div class="si-7ds-text"><strong>Plan:</strong> ' + esc(selectedPlan || 'None') + '</div>'
                +   '<div class="si-7ds-text"><strong>Member:</strong> ' + esc((getSelectedClaimRecord() && getSelectedClaimRecord().member) || sessionName || 'Guest') + '</div>'
                +   '<div class="si-7ds-pillrow"><span class="si-7ds-status-badge ' + getStatusClass(claimStatus) + '">' + esc(claimStatus || 'Not submitted') + '</span></div>'
                +   '<div class="si-7ds-text"><strong>Rule:</strong> ' + esc(getPlanRuleText(selectedPlan)) + '</div>'
                + '</div>'
                + '<div class="si-7ds-claim-box">'
                +   memberForm
                +   '<div class="si-7ds-plan-actions">' + memberActions + '</div>'
                + '</div>'
                + '<div class="si-7ds-card">'
                +   '<div class="si-7ds-card-title">History</div>'
                +   '<div class="si-7ds-list">' + addServerHistoryToCurrentRender(historyItems) + '</div>'
                +   '<div class="si-7ds-plan-actions">'
                +     '<button type="button" class="si-7ds-btn alt" data-action="refresh-history">Refresh</button>'
                +   '</div>'
                + '</div>';
        }

        if (activeTab === 'admin') {
            syncCurrentFromSelectedClaim();
            var adminClaimOptions = getFilteredClaimsDbItems().length
                ? getFilteredClaimsDbItems().map(function (item) {
                    var label = (item.id || 'No ID')
                        + ' | ' + (item.member || 'Unknown member')
                        + ' | ' + (item.plan || 'No plan')
                        + ' | ' + (item.status || 'No status');
                    var sel = (item.id === selectedClaimId || (!selectedClaimId && item.id === claimId)) ? ' selected' : '';
                    return '<option value="' + esc(item.id || '') + '"' + sel + '>' + esc(label) + '</option>';
                }).join('')
                : '<option value="">No matching claims</option>';

            var adminPanel = isAdmin()
                ? '<div class="si-7ds-card">'
                    + '<div class="si-7ds-card-title">Admin Review</div>'
                    + '<div class="si-7ds-admin-panel">'
                      + '<div class="si-7ds-pillrow">'
                        + '<span class="si-7ds-pill">Admin mode</span>'
                        + '<span class="si-7ds-pill">Claim ' + esc(claimId || 'none') + '</span>'
                        + '<span class="si-7ds-pill">' + esc(claimStatus || 'Not submitted') + '</span>'
                      + '</div>'
                      + '<div class="si-7ds-summary-grid">'
                        + '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + esc((getSelectedClaimRecord() && getSelectedClaimRecord().member) || '—') + '</div><div class="si-7ds-summary-label">Member</div></div>'
                        + '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + esc(selectedPlan || 'None') + '</div><div class="si-7ds-summary-label">Plan</div></div>'
                        + '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + esc((getSelectedClaimRecord() && getSelectedClaimRecord().updatedAt) || '—') + '</div><div class="si-7ds-summary-label">Updated</div></div>'
                      + '</div>'
                      + '<div class="si-7ds-note-box">'
                        + '<div class="si-7ds-text"><strong>Stack:</strong> ' + esc(claimStack || 'Not set') + '</div>'
                        + '<div class="si-7ds-text"><strong>Loss:</strong> ' + esc(claimLoss || 'Not set') + '</div>'
                        + '<div class="si-7ds-text"><strong>Proof:</strong> ' + esc(claimProof || 'Not set') + '</div>'
                        + '<div class="si-7ds-text"><strong>Member note:</strong> ' + esc(claimNote || 'None') + '</div>'
                      + '</div>'
                      + '<div class="si-7ds-field">'
                        + '<label class="si-7ds-label" for="si-payout-amount">Payout Amount</label>'
                        + '<input id="si-payout-amount" class="si-7ds-input" type="text" placeholder="Example: 5 Xanax or 3 E-DVDs" value="' + esc(payoutAmount) + '">'
                      + '</div>'
                      + '<div class="si-7ds-text"><strong>Payout guide:</strong> ' + esc(getPayoutGuide(selectedPlan)) + '</div>'
                      + '<div class="si-7ds-admin-note-box">'
                        + '<div class="si-7ds-field">'
                          + '<label class="si-7ds-label" for="si-decision-note">Decision Note</label>'
                          + '<textarea id="si-decision-note" class="si-7ds-textarea" placeholder="Admin decision notes">' + esc(decisionNote) + '</textarea>'
                        + '</div>'
                      + '</div>'
                      + '<div class="si-7ds-admin-actions-grid">'
                        + '<button type="button" class="si-7ds-btn alt" data-action="save-admin-draft">Save Review Draft</button>'
                        + '<button type="button" class="si-7ds-btn alt" data-action="next-open-claim">Next Open</button>'
                        + '<button type="button" class="si-7ds-btn alt" data-action="review-claim">Mark Review</button>'
                        + '<button type="button" class="si-7ds-btn alt" data-action="approve-claim">Approve</button>'
                        + '<button type="button" class="si-7ds-btn alt" data-action="deny-claim">Deny</button>'
                        + '<button type="button" class="si-7ds-btn confirm" data-action="pay-claim">Confirm Payout</button>'
                      + '</div>'
                      + '<div class="si-7ds-text"><strong>Current payout:</strong> ' + esc(payoutAmount || 'Not set') + '</div>'
                      + '<div class="si-7ds-admin-actions-grid">'
                        + '<button type="button" class="si-7ds-btn alt" data-action="bulk-review">Bulk Review Visible</button>'
                        + '<button type="button" class="si-7ds-btn alt" data-action="bulk-approve">Bulk Approve Visible</button>'
                        + '<button type="button" class="si-7ds-btn alt" data-action="bulk-deny">Bulk Deny Visible</button>'
                        + '<button type="button" class="si-7ds-btn confirm" data-action="bulk-pay">Bulk Pay Visible</button>'
                      + '</div>'
                    + '</div>'
                  + '</div>'
                : '';

            return isAdmin() ? ''
                + '<div class="si-7ds-card">'
                +   '<div class="si-7ds-card-title">Admin Queue</div>'
                +   '<div class="si-7ds-summary-grid">'
                +     '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + String(getAdminQueueSummary().pending) + '</div><div class="si-7ds-summary-label">Pending</div></div>'
                +     '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + String(getAdminQueueSummary().review) + '</div><div class="si-7ds-summary-label">Review</div></div>'
                +     '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + String(getAdminQueueSummary().approved) + '</div><div class="si-7ds-summary-label">Approved</div></div>'
                +     '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + String(getAdminQueueSummary().paid) + '</div><div class="si-7ds-summary-label">Paid</div></div>'
                +   '</div>'
                + '</div>'
                + '<div class="si-7ds-card">'
                +   '<div class="si-7ds-card-title">Claim Filters</div>'
                +   '<div class="si-7ds-filter-grid">'
                +     '<div class="si-7ds-field">'
                +       '<label class="si-7ds-label" for="si-claim-filter-status">Status</label>'
                +       '<select id="si-claim-filter-status" class="si-7ds-select">'
                +         '<option value="all"' + (claimFilterStatus === 'all' ? ' selected' : '') + '>All</option>'
                +         '<option value="Pending review"' + (claimFilterStatus === 'Pending review' ? ' selected' : '') + '>Pending</option>'
                +         '<option value="Under review"' + (claimFilterStatus === 'Under review' ? ' selected' : '') + '>Review</option>'
                +         '<option value="Approved"' + (claimFilterStatus === 'Approved' ? ' selected' : '') + '>Approved</option>'
                +         '<option value="Denied"' + (claimFilterStatus === 'Denied' ? ' selected' : '') + '>Denied</option>'
                +         '<option value="Paid"' + (claimFilterStatus === 'Paid' ? ' selected' : '') + '>Paid</option>'
                +       '</select>'
                +     '</div>'
                +     '<div class="si-7ds-field">'
                +       '<label class="si-7ds-label" for="si-claim-filter-member">Member</label>'
                +       '<input id="si-claim-filter-member" class="si-7ds-input" type="text" value="' + esc(claimFilterMember || '') + '" placeholder="Search member">'
                +     '</div>'
                +     '<div class="si-7ds-field">'
                +       '<label class="si-7ds-label" for="si-claim-sort-mode">Sort</label>'
                +       '<select id="si-claim-sort-mode" class="si-7ds-select">'
                +         '<option value="newest"' + (claimSortMode === 'newest' ? ' selected' : '') + '>Newest</option>'
                +         '<option value="oldest"' + (claimSortMode === 'oldest' ? ' selected' : '') + '>Oldest</option>'
                +         '<option value="member_az"' + (claimSortMode === 'member_az' ? ' selected' : '') + '>Member A-Z</option>'
                +         '<option value="status"' + (claimSortMode === 'status' ? ' selected' : '') + '>Status</option>'
                +       '</select>'
                +     '</div>'
                +     '<div class="si-7ds-field">'
                +       '<label class="si-7ds-label">Visible</label>'
                +       '<div class="si-7ds-text">' + String(getFilteredClaimsDbItems().length) + '</div>'
                +     '</div>'
                +   '</div>'
                + '</div>'
                + '<div class="si-7ds-card">'
                +   '<div class="si-7ds-card-title">Claim Selector</div>'
                +   '<div class="si-7ds-field">'
                +     '<select id="si-claim-select" class="si-7ds-select">' + adminClaimOptions + '</select>'
                +   '</div>'
                + '</div>'
                + adminPanel
                + '<div class="si-7ds-card">'
                +   '<div class="si-7ds-card-title">Backend Sync Settings</div>'
                +   '<div class="si-7ds-field">'
                +     '<label class="si-7ds-label" for="si-api-base">API Base URL</label>'
                +     '<input id="si-api-base" class="si-7ds-input" type="text" value="' + esc(apiBase || '') + '" placeholder="https://xanax-insurance.onrender.com">'
                +   '</div>'
                +   '<div class="si-7ds-field">'
                +     '<label class="si-7ds-label" for="si-sync-secret">Sync Secret</label>'
                +     '<input id="si-sync-secret" class="si-7ds-input" type="text" value="' + esc(syncSecret || '6282') + '" placeholder="6282">'
                +   '</div>'
                +   '<div class="si-backend-status">'
                +     '<div class="si-7ds-text"><strong>Status:</strong> ' + esc(backendStatus || 'Not tested') + '</div>'
                +     '<div class="si-7ds-text"><strong>Last sync:</strong> ' + esc(lastSyncAt || 'Never') + '</div>'
                +   '</div>'
                +   '<div class="si-7ds-plan-actions">'
                +     '<button type="button" class="si-7ds-btn" data-action="save-sync-settings">Save Sync Settings</button>'
                +     '<button type="button" class="si-7ds-btn alt" data-action="test-backend">Test Backend</button>'
                +     '<button type="button" class="si-7ds-btn alt" data-action="pull-claims">Pull Claims</button>'
                +     '<button type="button" class="si-7ds-btn alt" data-action="clear-history">Clear Local</button>'
                +   '</div>'
                + '</div>'
                : '';
        }

        return ''
            + '<div class="si-7ds-card">'
            +   '<div class="si-7ds-card-title">Member Login</div>'
            +   '<div class="si-7ds-field">'
            +     '<label class="si-7ds-label" for="si-login-api-key">Torn API Key</label>'
            +     '<input id="si-login-api-key" class="si-7ds-input" type="text" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" value="' + esc(memberApiKey || '') + '" placeholder="Paste your Torn API key here">'
            +   '</div>'
            +   '<div class="si-7ds-plan-actions">'
            +     '<button type="button" class="si-7ds-btn" data-action="login-api">Login With API Key</button>'
            +     '<button type="button" class="si-7ds-btn alt" data-action="logout-session">Logout</button>'
            +   '</div>'
            + '</div>'
            + '<div class="si-7ds-card">'
            +   '<div class="si-7ds-card-title">Login Status</div>'
            +   '<div class="si-backend-status">'
            +     '<div class="si-7ds-text"><strong>User:</strong> ' + esc(sessionName || 'Guest') + '</div>'
            +     '<div class="si-7ds-text"><strong>Role:</strong> ' + esc(sessionRole || 'guest') + '</div>'
            +     '<div class="si-7ds-text"><strong>Mode:</strong> ' + esc(authMode || 'local') + '</div>'
            +     '<div class="si-7ds-text"><strong>OD Watch:</strong> ' + esc(autoDetectStatus || 'Idle') + (autoOdDetectedAt ? ' | Last hit: ' + esc(autoOdDetectedAt) : '') + '</div>'
            +   '</div>'
            + '</div>'
            + '<div class="si-7ds-card">'
            +   '<div class="si-7ds-card-title">What Sinner\'s Insurance Does For You</div>'
            +   '<div class="si-7ds-list">'
            +     '<div class="si-7ds-list-item">Protects eligible OD losses during active plan windows.</div>'
            +     '<div class="si-7ds-list-item">Lets you arm Pride, Wrath, Envy, or Greed coverage right from the overlay.</div>'
            +     '<div class="si-7ds-list-item">Shows your login status and tracks OD watch while your plan is active.</div>'
            +   '</div>'
            + '</div>'
            + '<div class="si-7ds-card">'
            +   '<div class="si-7ds-card-title">Quick Help</div>'
            +   '<div class="si-7ds-list">'
            +     '<div class="si-7ds-list-item"><strong>1.</strong> Paste your Torn API key.</div>'
            +     '<div class="si-7ds-list-item"><strong>2.</strong> Tap Login With API Key.</div>'
            +     '<div class="si-7ds-list-item"><strong>3.</strong> Open Plans and activate the coverage you want.</div>'
            +     '<div class="si-7ds-list-item"><strong>4.</strong> Leave the script running while your protection window is active.</div>'
            +   '</div>'
            + '</div>';
    }

    function closeTermsModal() {
        activeTermsPlan = '';
        var existing = document.getElementById('si-terms-backdrop');
        if (existing) existing.remove();
    }

    function openTermsModal(plan) {
        activeTermsPlan = plan || '';
        closeTermsModal();

        var backdrop = document.createElement('div');
        backdrop.id = 'si-terms-backdrop';

        var bodyText = 'Terms not set yet.';
        if (plan === 'Pride Sin') {
            bodyText = '(Can start with any amount of energy!)';
        }
        if (plan === 'Wrath Sin') {
            bodyText = '(Start with 0 energy. Can combine with Envy plan)';
        }
        if (plan === 'Envy Sin') {
            bodyText = '(Start with 1000 energy and 0 booster cooldown.)';
        }

        backdrop.innerHTML = ''
            + '<div id="si-terms-modal">'
            +   '<div id="si-terms-head">'
            +     '<div id="si-terms-title">' + esc(plan || 'Terms') + ' Terms</div>'
            +     '<button type="button" id="si-terms-close">×</button>'
            +   '</div>'
            +   '<div id="si-terms-body">'
            +     '<div id="si-terms-card">'
            +       '<div id="si-terms-text">' + esc(bodyText) + '</div>'
            +     '</div>'
            +   '</div>'
            + '</div>';

        document.body.appendChild(backdrop);

        var closeBtn = backdrop.querySelector('#si-terms-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', function () {
                closeTermsModal();
            });
        }

        backdrop.addEventListener('click', function (e) {
            if (e.target === backdrop) {
                closeTermsModal();
            }
        });
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

        overlay.querySelectorAll('[data-action="arm-plan"]').forEach(function (btn) {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', function () {
                selectedPlan = btn.getAttribute('data-plan') || selectedPlan || 'None';
                saveSession();
                if (!canArmWarPlan(selectedPlan)) {
                    window.alert('Greed Sin can only be armed while War Stack is active.');
                    refreshWarStackState(true);
                    return;
                }
                armPlanSnapshot(selectedPlan, btn.getAttribute('data-stage') || '');
            });
        });

        overlay.querySelectorAll('[data-action="stop-armed-plan"]').forEach(function (btn) {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', function () {
                var stoppedPlan = getArmedPlanDisplayName() || planActivationPlan || selectedPlan || 'plan';
                clearArmedPlanState('Plan stopped manually', false);
                addClaimHistoryEntry((sessionName || 'Member') + ' stopped the armed window for ' + stoppedPlan + '.');
            });
        });

        overlay.querySelectorAll('[data-action="login-api"]').forEach(function (btn) {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', function () { loginWithApiKey(); });
        });

        overlay.querySelectorAll('[data-action="refresh-role"]').forEach(function (btn) {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', function () { loginWithApiKey(); });
        });

        overlay.querySelectorAll('[data-action="open-api-key-page"]').forEach(function (btn) {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', function () { window.open(getCustomKeyUrl(), '_blank'); });
        });

        overlay.querySelectorAll('[data-action="refresh-warstack"]').forEach(function (btn) {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', function () { refreshWarStackState(true); });
        });

        overlay.querySelectorAll('[data-action="warstack-enable"]').forEach(function (btn) {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', function () { setWarStackServerState(true); });
        });

        overlay.querySelectorAll('[data-action="warstack-disable"]').forEach(function (btn) {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', function () { setWarStackServerState(false); });
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

        overlay.querySelectorAll('[data-action="save-admin-draft"]').forEach(function (btn) {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', function () { saveAdminReviewDraft(); });
        });

        overlay.querySelectorAll('[data-action="next-open-claim"]').forEach(function (btn) {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', function () { selectNextOpenClaim(); });
        });

        overlay.querySelectorAll('[data-action="open-terms"]').forEach(function (btn) {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', function () { openTermsModal(btn.getAttribute('data-plan') || 'Terms'); });
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

        overlay.querySelectorAll('[data-action="bulk-review"]').forEach(function (btn) {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', function () { bulkSetVisibleClaimsStatus('Under review'); });
        });

        overlay.querySelectorAll('[data-action="bulk-approve"]').forEach(function (btn) {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', function () { bulkSetVisibleClaimsStatus('Approved'); });
        });

        overlay.querySelectorAll('[data-action="bulk-deny"]').forEach(function (btn) {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', function () { bulkSetVisibleClaimsStatus('Denied'); });
        });

        overlay.querySelectorAll('[data-action="bulk-pay"]').forEach(function (btn) {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', function () { bulkSetVisibleClaimsStatus('Paid'); });
        });

        overlay.querySelectorAll('[data-action="save-sync-settings"]').forEach(function (btn) {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', function () { saveSyncSettingsFromOverlay(); });
        });

        overlay.querySelectorAll('[data-action="test-backend"]').forEach(function (btn) {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', function () { testBackendConnection(); });
        });

        overlay.querySelectorAll('[data-action="pull-claims"]').forEach(function (btn) {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', function () { syncClaimsFromBackend(); });
        });

        overlay.querySelectorAll('[data-action="push-claim"]').forEach(function (btn) {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', function () { pushCurrentClaimToBackend(); });
        });

        overlay.querySelectorAll('[data-action="save-backend-auth"]').forEach(function (btn) {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', function () { saveBackendAuthFromOverlay(); });
        });

        overlay.querySelectorAll('[data-action="backend-member-login"]').forEach(function (btn) {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', function () { backendMemberFactionLogin(); });
        });

        overlay.querySelectorAll('[data-action="backend-admin-login"]').forEach(function (btn) {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', function () { backendAdminLogin(); });
        });

        overlay.querySelectorAll('[data-action="backend-whoami"]').forEach(function (btn) {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', function () { backendWhoAmI(); });
        });
    }

    function renderOverlay() {
        refreshArmedPlanState();
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
            + renderWarStackRow()
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

    function startAdminClaimNotifications() {
        if (adminNotifyTimer) clearInterval(adminNotifyTimer);
        adminNotifyTimer = null;
        if (!isAdmin()) return;
        adminNotifyTimer = setInterval(function () {
            if (!apiBase || !syncSecret) return;
            syncClaimsFromBackend().catch(function () {});
        }, 60000);
    }


    function startMemberAutoDetection() {
        if (memberAutoDetectTimer) clearInterval(memberAutoDetectTimer);
        memberAutoDetectTimer = null;
        if (!isMember() || !memberApiKey) return;
        runMemberAutoDetection().catch(function () {});
        memberAutoDetectTimer = setInterval(function () {
            runMemberAutoDetection().catch(function () {});
        }, 45000);
    }

    function boot() {
        syncCurrentFromSelectedClaim();
        mount();
        fetchSelectedClaimHistory();
        startRemountWatch();
        startArmedCountdownWatch();
        startAdminClaimNotifications();
        startMemberAutoDetection();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();

