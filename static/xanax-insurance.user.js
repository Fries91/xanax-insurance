// ==UserScript==
// @name         Sinner's Insurance 7DS
// @namespace    fries91-xanax-insurance
// @version      2.8.7
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
    var syncSecret = (typeof GM_getValue === 'function' ? GM_getValue('si_sync_secret', '6282') : '');
    var backendStatus = (typeof GM_getValue === 'function' ? GM_getValue('si_backend_status', 'Not tested') : 'Not tested');
    var lastSyncAt = (typeof GM_getValue === 'function' ? GM_getValue('si_last_sync_at', 'Never') : 'Never');
    var serverClaimHistory = (typeof GM_getValue === 'function' ? GM_getValue('si_server_claim_history', '[]') : '[]');
    var lastAdminNoticeClaimIds = (typeof GM_getValue === 'function' ? GM_getValue('si_last_admin_notice_claim_ids', '[]') : '[]');
    var autoDetectStatus = (typeof GM_getValue === 'function' ? GM_getValue('si_auto_detect_status', 'Idle') : 'Idle');
    var autoOdFingerprint = (typeof GM_getValue === 'function' ? GM_getValue('si_auto_od_fingerprint', '') : '');
    var autoOdDetectedAt = (typeof GM_getValue === 'function' ? GM_getValue('si_auto_od_detected_at', '') : '');
    var memberAutoDetectTimer = null;
    var adminNotifyEnabled = (typeof GM_getValue === 'function' ? GM_getValue('si_admin_notify_enabled', true) : true);
    var adminNotifyTimer = null;
    var authUser = (typeof GM_getValue === 'function' ? GM_getValue('si_auth_user', '') : '');
    var authPass = (typeof GM_getValue === 'function' ? GM_getValue('si_auth_pass', '') : '');
    var memberApiKey = (typeof GM_getValue === 'function' ? GM_getValue('si_member_api_key', '') : '');
    var factionIdLock = (typeof GM_getValue === 'function' ? GM_getValue('si_faction_id_lock', '49384') : '');
    var authMode = (typeof GM_getValue === 'function' ? GM_getValue('si_auth_mode', 'local') : 'local');
    var planActivationAt = (typeof GM_getValue === 'function' ? GM_getValue('si_plan_activation_at', '') : '');
    var planActivationPlan = (typeof GM_getValue === 'function' ? GM_getValue('si_plan_activation_plan', '') : '');
    var planActivationEnergy = (typeof GM_getValue === 'function' ? GM_getValue('si_plan_activation_energy', '') : '');
    var planActivationBoosterCd = (typeof GM_getValue === 'function' ? GM_getValue('si_plan_activation_booster_cd', '') : '');
    var planActivationExpiresAt = (typeof GM_getValue === 'function' ? GM_getValue('si_plan_activation_expires_at', '') : '');
    var adminUnreadClaimIds = (typeof GM_getValue === 'function' ? GM_getValue('si_admin_unread_claim_ids', '[]') : '[]');
    var adminAlertSoundEnabled = (typeof GM_getValue === 'function' ? GM_getValue('si_admin_alert_sound_enabled', true) : true);
    var adminAlertVibrateEnabled = (typeof GM_getValue === 'function' ? GM_getValue('si_admin_alert_vibrate_enabled', true) : true);

    var TAB_LABELS = {
        overview: 'Overview',
        plans: 'Plans',
        claims: 'Claims',
        settings: 'Settings'
    };

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
            GM_setValue('si_plan_activation_energy', planActivationEnergy || '');
            GM_setValue('si_plan_activation_booster_cd', planActivationBoosterCd || '');
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
        var url = 'https://api.torn.com/user/?selections=profile,basic&key=' + encodeURIComponent(apiKey || '') + '&comment=sinners-insurance-login&timestamp=' + Date.now();
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
            + encodeURIComponent('Sinner\'s Insurance')
            + '&user=' + encodeURIComponent(getRequiredUserSelections());
    }

    function getPlanWindowMinutes(plan) {
        if (plan === 'Pride Sin') return 60;
        if (plan === 'Wrath Sin') return 2880;
        if (plan === 'Envy Sin') return 2880;
        return 60;
    }

    function getPlanWindowLabel(plan) {
        if (plan === 'Pride Sin') return '1 hour';
        if (plan === 'Wrath Sin') return '48 hours';
        if (plan === 'Envy Sin') return '48 hours';
        return '1 hour';
    }


    function armPlanSnapshot(plan) {
        var now = new Date();
        planActivationPlan = plan || selectedPlan || 'None';
        planActivationAt = now.toLocaleString();
        planActivationEnergy = '';
        planActivationBoosterCd = '';
        autoDetectStatus = 'Arming ' + (planActivationPlan || 'plan') + '...';
        saveSession();
        renderOverlay();

        if (!memberApiKey) {
            autoDetectStatus = 'Plan armed - API key needed for live snapshot';
            saveSession();
            renderOverlay();
            return Promise.resolve(null);
        }

        return getTornBarsAndCooldowns(memberApiKey).then(function (data) {
            if (data && data.error) {
                autoDetectStatus = 'Plan armed - snapshot partial';
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
            autoDetectStatus = 'Plan armed - waiting for OD in ' + getPlanWindowLabel(planActivationPlan);
            saveSession();
            renderOverlay();
            return data;
        }).catch(function () {
            autoDetectStatus = 'Plan armed - snapshot partial';
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
        claimProof = buildAutoProofNote(entry) + ' | Armed ' + planActivationAt + ' | Energy ' + (planActivationEnergy || 'unknown') + ' | Booster CD ' + (planActivationBoosterCd || 'unknown');
        claimNote = 'Auto-detected via Torn API within ' + getPlanWindowLabel(selectedPlan) + ': ' + String(entry.text || '').replace(/\s+/g, ' ').slice(0, 180) + ' | Armed plan ' + selectedPlan + ' at ' + planActivationAt + '.';
        addClaimHistoryEntry((sessionName || 'Member') + ' had a Xanax overdose auto-detected within the ' + getPlanWindowLabel(selectedPlan) + ' window for ' + selectedPlan + ' and claim ' + claimId + ' was created automatically.');
        upsertCurrentClaimRecord();
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
        authMode = memberApiKey ? 'torn-api' : 'local';
        saveSession();
        renderOverlay();
        startAdminClaimNotifications();
        startMemberAutoDetection();
    }


    function syncClaimToBackend() {
        return pushCurrentClaimToBackend();
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
                updatedAt: new Date().toLocaleString(),
                armedAt: planActivationAt || '',
                armedPlan: planActivationPlan || '',
                armedEnergy: planActivationEnergy || '',
                armedBoosterCd: planActivationBoosterCd || ''
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
        if (!apiBase || !memberApiKey) {
            window.alert('Fill in API Base URL and your admin Torn API key first.');
            return Promise.resolve(null);
        }
        return apiRequest('POST', '/api/auth/admin-key-login', {
            api_key: memberApiKey,
            secret: syncSecret
        }).then(function (data) {
            if (data && data.ok && data.user) {
                sessionName = data.user.name || data.user.username || 'Admin';
                sessionRole = data.user.role || 'admin';
                authMode = 'backend-admin-key';
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
        if (!apiBase || !syncSecret) return Promise.resolve(null);

        if (authMode === 'backend-admin-key') {
            if (!memberApiKey) return Promise.resolve(null);
            return apiRequest('POST', '/api/auth/admin-key-login', {
                api_key: memberApiKey,
                secret: syncSecret
            }).then(function (data) {
                if (data && data.ok && data.user) {
                    sessionName = data.user.name || data.user.username || 'Admin';
                    sessionRole = data.user.role || 'admin';
                    backendStatus = 'Backend admin login ok';
                    lastSyncAt = new Date().toLocaleString();
                    saveSession();
                    renderOverlay();
                }
                return data;
            }).catch(function () { return null; });
        }

        if (!memberApiKey || !factionIdLock) return Promise.resolve(null);
        return apiRequest('POST', '/api/auth/faction-login', {
            api_key: memberApiKey,
            faction_id: factionIdLock,
            secret: syncSecret
        }).then(function (data) {
            if (data && data.ok && data.user) {
                sessionName = data.user.name || data.user.username || 'Member';
                sessionRole = data.user.role || 'member';
                backendStatus = 'Faction member login ok';
                lastSyncAt = new Date().toLocaleString();
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

    function getOverviewStats() {
        var items = getClaimsDbItems();
        return {
            total: items.length,
            open: items.filter(function (i) { return ['Pending review', 'Under review'].indexOf(String(i && i.status || '')) >= 0; }).length,
            paid: items.filter(function (i) { return String(i && i.status || '') === 'Paid'; }).length,
            denied: items.filter(function (i) { return String(i && i.status || '') === 'Denied'; }).length,
            payouts: items.reduce(function (sum, i) { return sum + parseMoneyLoose(i && i.payout); }, 0),
            members: Array.from(new Set(items.map(function (i) { return String(i && i.member || '').trim(); }).filter(Boolean))).length
        };
    }

    function getPlanRuleText(plan) {
        var p = String(plan || '');
        if (p === 'Pride Sin') return 'single xanax / 1st use only';
        if (p === 'Wrath Sin') return '1st, 2nd, 3rd, 4th stack only';
        if (p === 'Envy Sin') return 'full happy jump only';
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
        return false;
    }

    function getPayoutGuide(plan) {
        var p = String(plan || '');
        if (p === 'Pride Sin') return 'Guide: small single-use payout';
        if (p === 'Wrath Sin') return 'Guide: medium stacked-use payout';
        if (p === 'Envy Sin') return 'Guide: premium full-jump payout';
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
  right: calc(env(safe-area-inset-right, 0px) + 10px) !important;
  top: calc(env(safe-area-inset-top, 0px) + 116px) !important;
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
                +   '<div class="si-7ds-card-title">Overview</div>'
                +   '<div class="si-7ds-summary-grid">'
                +     '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + String(getOverviewStats().total) + '</div><div class="si-7ds-summary-label">Claims</div></div>'
                +     '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + String(getOverviewStats().open) + '</div><div class="si-7ds-summary-label">Open</div></div>'
                +     '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + String(getOverviewStats().paid) + '</div><div class="si-7ds-summary-label">Paid</div></div>'
                +     '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + String(getOverviewStats().denied) + '</div><div class="si-7ds-summary-label">Denied</div></div>'
                +     '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + String(getOverviewStats().members) + '</div><div class="si-7ds-summary-label">Members</div></div>'
                +     '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">$' + String(Math.round(getOverviewStats().payouts)) + '</div><div class="si-7ds-summary-label">Payouts</div></div>'
                +   '</div>'
                + '</div>';
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
                +     '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Window</div><div class="si-7ds-plan-stat-value">1 hour</div></div>'
                +     '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Terms</div><div class="si-7ds-plan-stat-value">Any energy start</div></div>'
                +   '</div>'
                +   '<div class="si-7ds-plan-actions">'
                +     '<button type="button" class="si-7ds-btn" data-action="select-plan" data-plan="Pride Sin">Select</button>'
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
                +     '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Window</div><div class="si-7ds-plan-stat-value">48 hours</div></div>'
                +     '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Coverage</div><div class="si-7ds-plan-stat-value">5 / 10 / 15 / 20</div></div>'
                +     '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Terms</div><div class="si-7ds-plan-stat-value">Start with 0 energy</div></div>'
                +   '</div>'
                +   '<div class="si-7ds-plan-actions">'
                +     '<button type="button" class="si-7ds-btn" data-action="select-plan" data-plan="Wrath Sin">Select</button>'
                +     '<button type="button" class="si-7ds-btn alt" data-action="open-terms" data-plan="Wrath Sin">Terms</button>'
                +   '</div>'
                + '</div>'

                + '<div class="si-7ds-plan-box">'
                +   '<div class="si-7ds-plan-top">'
                +     '<div><div class="si-7ds-plan-name">Envy Sin</div><div class="si-7ds-plan-tier">Premium coverage</div></div>'
                +     '<span class="si-7ds-pill">Full jump</span>'
                +   '</div>'
                +   '<div class="si-7ds-plan-grid">'
                +     '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Rule</div><div class="si-7ds-plan-stat-value">Happy jump</div></div>'
                +     '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Guide</div><div class="si-7ds-plan-stat-value">Premium payout</div></div>'
                +   '</div>'
                +   '<div class="si-7ds-plan-actions">'
                +     '<button type="button" class="si-7ds-btn" data-action="select-plan" data-plan="Envy Sin">Select</button>'
                +     '<button type="button" class="si-7ds-btn alt" data-action="open-terms" data-plan="Envy Sin">Terms</button>'
                +   '</div>'
                + '</div>'

                + '<div class="si-7ds-selected-banner">Selected plan: <strong>' + selectedPlan + '</strong></div>'
                + '<div class="si-7ds-selected-banner">Armed snapshot: <strong>' + esc(getArmedPlanSummary()) + '</strong></div>';
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
                + (isAdmin()
                    ? '<div class="si-7ds-card">'
                        + '<div class="si-7ds-card-title">Admin Queue</div>'
                        + '<div class="si-7ds-summary-grid">'
                          + '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + String(getAdminQueueSummary().pending) + '</div><div class="si-7ds-summary-label">Pending</div></div>'
                          + '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + String(getAdminQueueSummary().review) + '</div><div class="si-7ds-summary-label">Review</div></div>'
                          + '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + String(getAdminQueueSummary().approved) + '</div><div class="si-7ds-summary-label">Approved</div></div>'
                          + '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + String(getAdminQueueSummary().paid) + '</div><div class="si-7ds-summary-label">Paid</div></div>'
                        + '</div>'
                      + '</div>'
                    : '')
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
                +       + '</select>'
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
                +       + '</select>'
                +     '</div>'
                +     '<div class="si-7ds-field">'
                +       '<label class="si-7ds-label">Visible</label>'
                +       '<div class="si-7ds-text">' + String(getFilteredClaimsDbItems().length) + '</div>'
                +     '</div>'
                +   '</div>'
                + '</div>'
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
                + adminPanel
                + '<div class="si-7ds-card">'
                +   '<div class="si-7ds-card-title">History</div>'
                +   '<div class="si-7ds-list">' + addServerHistoryToCurrentRender(historyItems) + '</div>'
                +   '<div class="si-7ds-plan-actions">'
                +     '<button type="button" class="si-7ds-btn alt" data-action="refresh-history">Refresh</button>'
                +     + (isAdmin() ? '<button type="button" class="si-7ds-btn alt" data-action="clear-history">Clear Local</button>' : '')
                +   '</div>'
                + '</div>';
        }

        return ''

            +   '<div class="si-7ds-text">This tab is the control room for launcher settings, account access, and admin/member login state.</div>'
            + '</div>'
            + '<div class="si-7ds-card">'
            +   '<div class="si-7ds-card-title">API Key Login</div>'
            +   '<div class="si-7ds-field">'
            +     '<label class="si-7ds-label" for="si-faction-id-lock">Faction ID Lock</label>'
            +     '<input id="si-faction-id-lock" class="si-7ds-input" type="text" value="' + esc(factionIdLock || '') + '" placeholder="Your faction ID">'
            +   '</div>'
            +   '<div class="si-7ds-field">'
            +     '<label class="si-7ds-label" for="si-login-api-key">Torn API Key</label>'
            +     '<input id="si-login-api-key" class="si-7ds-input" type="text" value="' + esc(memberApiKey || '') + '" placeholder="Paste your Torn API key">'
            +   '</div>'
            +   '<div class="si-7ds-text"><strong>Required user selections:</strong> ' + esc(getRequiredUserSelections()) + '</div>'
            +   '<div class="si-7ds-text"><a href="' + esc(getCustomKeyUrl()) + '" target="_blank" rel="noopener noreferrer">Create a custom Torn key for Sinner\'s Insurance</a></div>'
            +   '<div class="si-backend-status">'
            +     '<div class="si-7ds-text"><strong>Detected user:</strong> ' + esc(sessionName || 'Guest') + '</div>'
            +     '<div class="si-7ds-text"><strong>Detected role:</strong> ' + esc(sessionRole || 'guest') + '</div>'
            +     '<div class="si-7ds-text"><strong>Auth mode:</strong> ' + esc(authMode || 'local') + '</div>'
            +     '<div class="si-7ds-text"><strong>Auto OD detect:</strong> ' + esc(autoDetectStatus || 'Idle') + (autoOdDetectedAt ? ' | Last hit: ' + esc(autoOdDetectedAt) : '') + '</div>'
            +   '</div>'
            +   '<div class="si-7ds-plan-actions">'
            +     '<button type="button" class="si-7ds-btn" data-action="login-api">Login With API Key</button>'
            +     '<button type="button" class="si-7ds-btn alt" data-action="refresh-role">Refresh Role</button>'
            +     '<button type="button" class="si-7ds-btn alt" data-action="logout-session">Logout</button>'
            +   '</div>'
            +   '<div class="si-7ds-text">Members only see member tools. Admin-only claim controls stay hidden unless this API key resolves as admin.</div>'
            + '</div>'
            + '<div class="si-7ds-card">'
            +   '<div class="si-7ds-card-title">Current Setup</div>'
            +   '<div class="si-7ds-setting-row"><div class="si-7ds-setting-label">Launcher</div><div class="si-7ds-setting-value">Top-right locked</div></div>'
            +   '<div class="si-7ds-setting-row"><div class="si-7ds-setting-label">Theme</div><div class="si-7ds-setting-value">7 Deadly Sins crimson/gold</div></div>'
            +   '<div class="si-7ds-setting-row"><div class="si-7ds-setting-label">Overlay</div><div class="si-7ds-setting-value">4 tabs active</div></div>'
            +   '<div class="si-7ds-setting-row"><div class="si-7ds-setting-label">Plans</div><div class="si-7ds-setting-value">Pride / Wrath / Envy</div></div>'
            + '</div>'
            + ((!isMember() || isAdmin())
                ? '<div class="si-7ds-card">'
                    + '<div class="si-7ds-card-title">Backend Sync Settings</div>'
                    + '<div class="si-7ds-field">'
                    +   '<label class="si-7ds-label" for="si-api-base">API Base URL</label>'
                    +   '<input id="si-api-base" class="si-7ds-input" type="text" value="' + esc(apiBase || '') + '" placeholder="https://xanax-insurance.onrender.com">'
                    + '</div>'
                    + '<div class="si-7ds-field">'
                    +   '<label class="si-7ds-label" for="si-sync-secret">Sync Secret</label>'
                    +   '<input id="si-sync-secret" class="si-7ds-input" type="text" value="' + esc(syncSecret || '') + '" placeholder="Set your shared secret">'
                    + '</div>'
                    + '<div class="si-backend-status">'
                    +   '<div class="si-7ds-text"><strong>Status:</strong> ' + esc(backendStatus || 'Not tested') + '</div>'
                    +   '<div class="si-7ds-text"><strong>Last sync:</strong> ' + esc(lastSyncAt || 'Never') + '</div>'
                    + '</div>'
                    + '<div class="si-7ds-plan-actions">'
                    +   '<button type="button" class="si-7ds-btn" data-action="save-sync-settings">Save Sync Settings</button>'
                    +   '<button type="button" class="si-7ds-btn alt" data-action="test-backend">Test Backend</button>'
                    +   '<button type="button" class="si-7ds-btn alt" data-action="pull-claims">Pull Claims</button>'
                    + '</div>'
                  + '</div>'
                : '')
            + '<div class="si-7ds-card">'
            +   '<div class="si-7ds-card-title">Builder Notes</div>'
            +   '<div class="si-7ds-text">API key login now detects member vs admin automatically and keeps admin-only controls hidden from standard members.</div>'
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
            bodyText = '(Full stack, 0 booster CD, take 4 E-DVD\'s, then take Ecstasy! Combinable with Wrath for Xanax coverage.)';
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
                armPlanSnapshot(selectedPlan).then(function () {
                    saveSession();
                    renderOverlay();
                }).catch(function () {
                    saveSession();
                    renderOverlay();
                });
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

        if (!window.__si7dsObserver) {
            window.__si7dsObserver = new MutationObserver(function () {
                ensureMounted();
            });
            try {
                window.__si7dsObserver.observe(document.documentElement || document.body, {
                    childList: true,
                    subtree: true
                });
            } catch (e) {}
        }

        if (!window.__si7dsHistoryPatch) {
            window.__si7dsHistoryPatch = true;
            ['pushState', 'replaceState'].forEach(function (method) {
                try {
                    var original = history[method];
                    if (typeof original === 'function') {
                        history[method] = function () {
                            var out = original.apply(this, arguments);
                            setTimeout(ensureMounted, 50);
                            setTimeout(ensureMounted, 500);
                            return out;
                        };
                    }
                } catch (e) {}
            });
            window.addEventListener('popstate', function () {
                setTimeout(ensureMounted, 50);
                setTimeout(ensureMounted, 500);
            });
            document.addEventListener('visibilitychange', function () {
                if (!document.hidden) ensureMounted();
            });
        }
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

    function cooldownSecondsFromAny(value) {
        if (value === undefined || value === null || value === '') return 0;
        if (typeof value === 'number') return Math.max(0, value);
        var raw = String(value || '').trim().toLowerCase();
        if (!raw || raw === 'ready' || raw === '0' || raw === '0s') return 0;
        if (/^\d+$/.test(raw)) return parseInt(raw, 10) || 0;
        var total = 0;
        var matched = false;
        raw.replace(/(\d+)\s*([hms])/g, function (_, num, unit) {
            matched = true;
            var n = parseInt(num, 10) || 0;
            if (unit === 'h') total += n * 3600;
            if (unit === 'm') total += n * 60;
            if (unit === 's') total += n;
            return _;
        });
        return matched ? total : 0;
    }

    function parseEnergyCurrent(value) {
        var m = String(value || '').match(/(\d+)/);
        return m ? parseInt(m[1], 10) || 0 : 0;
    }

    function parseEnergyMax(value) {
        var m = String(value || '').match(/\/\s*(\d+)/);
        return m ? parseInt(m[1], 10) || 0 : 0;
    }

    function getPlanExpiryMs(plan, armedAt) {
        var armed = parseIsoOrLocalTimestamp(armedAt || planActivationAt);
        if (!armed) return 0;
        return armed + (getPlanWindowMinutes(plan || planActivationPlan || selectedPlan) * 60 * 1000);
    }

    function getPlanRuleState(plan) {
        var p = String(plan || selectedPlan || '');
        if (!p || p === 'None') return { ok: false, code: 'no-plan', text: 'No plan selected' };
        if (!planActivationAt || !planActivationPlan || planActivationPlan !== p) {
            return { ok: false, code: 'not-armed', text: 'Plan not armed yet' };
        }
        var now = Date.now();
        var expiryMs = getPlanExpiryMs(p, planActivationAt);
        if (!expiryMs || now > expiryMs) {
            return { ok: false, code: 'expired', text: 'Armed window expired' };
        }
        var energyCurrent = parseEnergyCurrent(planActivationEnergy);
        var energyMax = parseEnergyMax(planActivationEnergy);
        var boosterSecs = cooldownSecondsFromAny(planActivationBoosterCd);

        if (p === 'Wrath Sin') {
            if (energyCurrent !== 0) {
                return { ok: false, code: 'wrath-energy', text: 'Wrath needs 0 energy at arm time' };
            }
        }
        if (p === 'Envy Sin') {
            if (!energyMax || energyCurrent < energyMax) {
                return { ok: false, code: 'envy-stack', text: 'Envy needs full energy stack at arm time' };
            }
            if (boosterSecs > 0) {
                return { ok: false, code: 'envy-cd', text: 'Envy needs 0 booster cooldown at arm time' };
            }
        }
        if (p === 'Pride Sin') {
            return { ok: true, code: 'ok', text: 'Pride armed - any energy start allowed' };
        }
        return { ok: true, code: 'ok', text: p.replace(/\s+/g, ' ') + ' armed and valid' };
    }

    function getArmedPlanSummary() {
        if (!planActivationPlan || !planActivationAt) return 'No plan armed';
        var expiry = planActivationExpiresAt || (getPlanExpiryMs(planActivationPlan, planActivationAt) ? new Date(getPlanExpiryMs(planActivationPlan, planActivationAt)).toLocaleString() : '');
        var parts = [
            planActivationPlan,
            'armed ' + planActivationAt
        ];
        if (expiry) parts.push('expires ' + expiry);
        if (planActivationEnergy) parts.push('energy ' + planActivationEnergy);
        if (planActivationBoosterCd) parts.push('booster ' + planActivationBoosterCd);
        return parts.join(' | ');
    }

    function getMemberStatusCardHtml() {
        var expiry = planActivationExpiresAt || (getPlanExpiryMs(planActivationPlan, planActivationAt) ? new Date(getPlanExpiryMs(planActivationPlan, planActivationAt)).toLocaleString() : '—');
        var rule = getPlanRuleState(planActivationPlan || selectedPlan);
        return ''
            + '<div class="si-7ds-card" id="si-member-status-card">'
            +   '<div class="si-7ds-card-title">Member Claim Status</div>'
            +   '<div class="si-7ds-summary-grid">'
            +     '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + esc(planActivationPlan || selectedPlan || 'None') + '</div><div class="si-7ds-summary-label">Armed plan</div></div>'
            +     '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + esc(planActivationAt || '—') + '</div><div class="si-7ds-summary-label">Armed at</div></div>'
            +     '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + esc(expiry || '—') + '</div><div class="si-7ds-summary-label">Expires at</div></div>'
            +   '</div>'
            +   '<div class="si-7ds-text"><strong>Energy at arm:</strong> ' + esc(planActivationEnergy || '—') + '</div>'
            +   '<div class="si-7ds-text"><strong>Booster CD at arm:</strong> ' + esc(planActivationBoosterCd || '—') + '</div>'
            +   '<div class="si-7ds-text"><strong>Rule check:</strong> ' + esc(rule.text || '—') + '</div>'
            +   '<div class="si-7ds-text"><strong>OD detect:</strong> ' + esc(autoDetectStatus || 'Idle') + (autoOdDetectedAt ? ' | Last hit: ' + esc(autoOdDetectedAt) : '') + '</div>'
            +   '<div class="si-7ds-pillrow"><span class="si-7ds-status-badge ' + getStatusClass(claimStatus) + '">' + esc(claimStatus || 'Not submitted') + '</span></div>'
            + '</div>';
    }

    function getAdminUnreadIds() {
        return parseJsonArraySafe(adminUnreadClaimIds).map(function (id) { return String(id || ''); }).filter(Boolean);
    }

    function setAdminUnreadIds(arr) {
        var cleaned = Array.from(new Set((arr || []).map(function (id) { return String(id || ''); }).filter(Boolean))).slice(0, 100);
        adminUnreadClaimIds = JSON.stringify(cleaned);
        saveSession();
        return cleaned;
    }

    function getAdminUnreadCount() {
        return getAdminUnreadIds().length;
    }

    function playAdminAlertCue() {
        try {
            if (adminAlertVibrateEnabled && navigator && typeof navigator.vibrate === 'function') {
                navigator.vibrate([180, 100, 180]);
            }
        } catch (e) {}
        try {
            if (adminAlertSoundEnabled && window.AudioContext) {
                var ctx = new window.AudioContext();
                var o = ctx.createOscillator();
                var g = ctx.createGain();
                o.type = 'sine';
                o.frequency.value = 880;
                g.gain.value = 0.04;
                o.connect(g);
                g.connect(ctx.destination);
                o.start();
                setTimeout(function () {
                    try { o.stop(); ctx.close(); } catch (e2) {}
                }, 180);
            }
        } catch (e3) {}
    }

    function markAdminNotificationsRead(mode) {
        if (!isAdmin()) return;
        if (mode === 'selected' && selectedClaimId) {
            setAdminUnreadIds(getAdminUnreadIds().filter(function (id) { return id !== String(selectedClaimId || ''); }));
        } else {
            setAdminUnreadIds([]);
        }
        backendStatus = 'Admin alerts marked as read';
        lastSyncAt = new Date().toLocaleString();
        renderOverlay();
    }

    function openNewestUnreadClaim() {
        if (!isAdmin()) return;
        var unread = getAdminUnreadIds();
        var items = sortClaimsItems(getClaimsDbItems());
        var target = null;
        if (unread.length) {
            target = items.find(function (item) { return item && unread.indexOf(String(item.id || '')) >= 0; }) || null;
        }
        if (!target) {
            target = items.find(function (item) {
                var s = String(item && item.status || '');
                return s === 'Pending review' || s === 'Under review';
            }) || items[0] || null;
        }
        if (!target) {
            window.alert('No claim found.');
            return;
        }
        activeTab = 'claims';
        selectClaimById(target.id || '');
    }

    function applyPolishStyles() {
        if (document.getElementById('si-7ds-polish-style')) return;
        var style = document.createElement('style');
        style.id = 'si-7ds-polish-style';
        style.textContent = ''
            + '#si-7ds-overlay .si-7ds-tab.has-badge{position:relative!important;padding-right:28px!important;}'
            + '#si-7ds-overlay .si-7ds-tab-badge{position:absolute!important;top:5px!important;right:8px!important;min-width:16px!important;height:16px!important;border-radius:999px!important;background:#b91c1c!important;color:#fff!important;font-size:10px!important;line-height:16px!important;text-align:center!important;padding:0 4px!important;font-weight:700!important;}'
            + '#si-7ds-overlay .si-7ds-inline-actions{display:flex!important;gap:8px!important;flex-wrap:wrap!important;margin-top:10px!important;}'
            + '#si-7ds-overlay .si-7ds-checkrow{display:flex!important;gap:12px!important;flex-wrap:wrap!important;align-items:center!important;margin-top:8px!important;}'
            + '#si-7ds-overlay .si-7ds-checkrow label{display:inline-flex!important;gap:6px!important;align-items:center!important;font-size:12px!important;color:#e7dcc0!important;}';
        document.head.appendChild(style);
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
            GM_setValue('si_plan_activation_energy', planActivationEnergy || '');
            GM_setValue('si_plan_activation_booster_cd', planActivationBoosterCd || '');
            GM_setValue('si_plan_activation_expires_at', planActivationExpiresAt || '');
            GM_setValue('si_admin_unread_claim_ids', adminUnreadClaimIds || '[]');
            GM_setValue('si_admin_alert_sound_enabled', !!adminAlertSoundEnabled);
            GM_setValue('si_admin_alert_vibrate_enabled', !!adminAlertVibrateEnabled);
        }
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
        if (fresh.length) {
            var unread = getAdminUnreadIds().concat(fresh.map(function (item) { return String(item.id || ''); }));
            setAdminUnreadIds(unread);
            fresh.forEach(function (item) {
                var who = item.member_name || item.member || item.player_name || 'A member';
                var plan = item.plan || 'Unknown plan';
                sendAdminNotification('New Xanax overdose claim', who + ' submitted ' + plan + ' for review.');
            });
            playAdminAlertCue();
            backendStatus = 'New overdose claim notification' + (fresh.length > 1 ? 's' : '') + ': ' + fresh.length;
        }
        lastAdminNoticeClaimIds = JSON.stringify(incoming.map(function (item) { return item && item.id ? String(item.id) : ''; }).filter(Boolean).slice(0, 100));
        saveSession();
    }

    function armPlanSnapshot(plan) {
        var now = new Date();
        planActivationPlan = plan || selectedPlan || 'None';
        planActivationAt = now.toLocaleString();
        planActivationExpiresAt = new Date(now.getTime() + (getPlanWindowMinutes(planActivationPlan) * 60 * 1000)).toLocaleString();
        planActivationEnergy = '';
        planActivationBoosterCd = '';
        autoDetectStatus = 'Arming ' + (planActivationPlan || 'plan') + '...';
        saveSession();
        renderOverlay();

        function handleArmResult(energyCurrent, energyMax, boosterSecs) {
            planActivationEnergy = energyCurrent !== '' ? String(energyCurrent) + (energyMax !== '' ? '/' + String(energyMax) : '') : '';
            planActivationBoosterCd = formatCooldownSeconds(boosterSecs);
            var rule = getPlanRuleState(planActivationPlan);
            if (!rule.ok) {
                autoDetectStatus = rule.text;
                saveSession();
                renderOverlay();
                window.alert(rule.text);
                return null;
            }
            autoDetectStatus = 'Plan armed - waiting for OD in ' + getPlanWindowLabel(planActivationPlan);
            saveSession();
            renderOverlay();
            return true;
        }

        if (!memberApiKey) {
            autoDetectStatus = 'Plan armed - API key needed for live snapshot';
            saveSession();
            renderOverlay();
            return Promise.resolve(null);
        }

        return getTornBarsAndCooldowns(memberApiKey).then(function (data) {
            if (data && data.error) {
                autoDetectStatus = 'Plan armed - snapshot partial';
                saveSession();
                renderOverlay();
                return data;
            }
            var bars = data && data.bars ? data.bars : {};
            var cooldowns = data && data.cooldowns ? data.cooldowns : {};
            var energy = bars && bars.energy ? bars.energy : {};
            var energyCurrent = energy.current !== undefined ? energy.current : (energy.amount !== undefined ? energy.amount : '');
            var energyMax = energy.maximum !== undefined ? energy.maximum : (energy.max !== undefined ? energy.max : '');
            var boosterSecs = cooldowns && cooldowns.booster !== undefined ? cooldowns.booster : 0;
            return handleArmResult(energyCurrent, energyMax, boosterSecs);
        }).catch(function () {
            autoDetectStatus = 'Plan armed - snapshot partial';
            saveSession();
            renderOverlay();
            return null;
        });
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
            return Promise.resolve(null);
        }

        var rule = getPlanRuleState(selectedPlan);
        if (!rule.ok) {
            autoDetectStatus = 'OD found - ' + rule.text;
            claimStatus = 'Detected - rule mismatch';
            claimLoss = getAutoLossFromOd(selectedPlan, entry.text);
            claimProof = buildAutoProofNote(entry);
            claimNote = 'Auto-detected Xanax overdose, but the armed plan was not valid: ' + rule.text + '.';
            claimStack = getAutoStackFromOd(selectedPlan, entry.text);
            saveSession();
            renderOverlay();
            return Promise.resolve(null);
        }

        var armedAtMs = parseIsoOrLocalTimestamp(planActivationAt);
        var odAtMs = (entry.timestamp || 0) * 1000;
        var expiryMs = getPlanExpiryMs(selectedPlan, planActivationAt);
        if (!armedAtMs || !expiryMs || odAtMs < armedAtMs || odAtMs > expiryMs) {
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
        claimProof = buildAutoProofNote(entry) + ' | Armed ' + planActivationAt + ' | Energy ' + (planActivationEnergy || 'unknown') + ' | Booster CD ' + (planActivationBoosterCd || 'unknown');
        claimNote = 'Auto-detected via Torn API within ' + getPlanWindowLabel(selectedPlan) + ': ' + String(entry.text || '').replace(/\s+/g, ' ').slice(0, 180) + ' | Armed plan ' + selectedPlan + ' at ' + planActivationAt + '.';
        addClaimHistoryEntry((sessionName || 'Member') + ' had a Xanax overdose auto-detected within the ' + getPlanWindowLabel(selectedPlan) + ' window for ' + selectedPlan + ' and claim ' + claimId + ' was created automatically.');
        upsertCurrentClaimRecord();
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


    function syncClaimToBackend() {
        return pushCurrentClaimToBackend();
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
        var rule = getPlanRuleState(selectedPlan);
        if (!rule.ok) {
            window.alert(rule.text);
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

    function getPlanRuleText(plan) {
        var p = String(plan || '');
        if (p === 'Pride Sin') return 'any energy start allowed';
        if (p === 'Wrath Sin') return 'must arm at 0 energy';
        if (p === 'Envy Sin') return 'must arm at full energy with 0 booster cooldown';
        return 'select a plan first';
    }

    function renderTabRow() {
        return '<div class="si-7ds-tabrow">'
            + Object.keys(TAB_LABELS).map(function (key) {
                var unreadBadge = (isAdmin() && key === 'claims' && getAdminUnreadCount() > 0)
                    ? '<span class="si-7ds-tab-badge">' + String(getAdminUnreadCount()) + '</span>'
                    : '';
                return '<button type="button" class="si-7ds-tab' + (activeTab === key ? ' active' : '') + (unreadBadge ? ' has-badge' : '') + '" data-tab="' + key + '">' + TAB_LABELS[key] + unreadBadge + '</button>';
            }).join('')
            + '</div>';
    }

    function enhanceOverlayDom() {
        if (!overlay) return;
        applyPolishStyles();

        if (activeTab === 'plans') {
            Array.prototype.slice.call(overlay.querySelectorAll('.si-7ds-plan-box')).forEach(function (box) {
                var name = box.querySelector('.si-7ds-plan-name');
                var grid = box.querySelector('.si-7ds-plan-grid');
                if (!name || !grid) return;
                var planName = String(name.textContent || '').trim();
                if (planName === 'Envy Sin' && !grid.dataset.enhancedEnvy) {
                    grid.dataset.enhancedEnvy = '1';
                    grid.innerHTML = ''
                        + '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Coverage</div><div class="si-7ds-plan-stat-value">25 Xanax / 3 E-DVD’s</div></div>'
                        + '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Payment</div><div class="si-7ds-plan-stat-value">5 Xanax</div></div>'
                        + '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Window</div><div class="si-7ds-plan-stat-value">48 hours</div></div>'
                        + '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Terms</div><div class="si-7ds-plan-stat-value">Full stack / 0 booster CD</div></div>';
                }
            });
        }

        if (activeTab === 'claims') {
            var claimBox = overlay.querySelector('.si-7ds-claim-box');
            if (claimBox && !overlay.querySelector('#si-member-status-card')) {
                claimBox.insertAdjacentHTML('beforebegin', getMemberStatusCardHtml());
            }

            if (isAdmin() && !overlay.querySelector('#si-admin-alert-bar')) {
                var adminPanel = overlay.querySelector('.si-7ds-admin-panel');
                if (adminPanel) {
                    var unread = getAdminUnreadCount();
                    var barHtml = ''
                        + '<div id="si-admin-alert-bar" class="si-7ds-note-box">'
                        +   '<div class="si-7ds-text"><strong>Unread alerts:</strong> ' + String(unread) + '</div>'
                        +   '<div class="si-7ds-inline-actions">'
                        +     '<button type="button" class="si-7ds-btn alt" data-action="open-newest-unread">Open Newest Alert</button>'
                        +     '<button type="button" class="si-7ds-btn alt" data-action="mark-selected-read">Mark Selected Read</button>'
                        +     '<button type="button" class="si-7ds-btn alt" data-action="mark-alerts-read">Mark All Read</button>'
                        +   '</div>'
                        + '</div>';
                    adminPanel.insertAdjacentHTML('afterbegin', barHtml);
                }
            }
        }

        if (activeTab === 'settings' && isAdmin() && !overlay.querySelector('#si-admin-alert-settings')) {
            var builderNotes = Array.prototype.slice.call(overlay.querySelectorAll('.si-7ds-card')).find(function (card) {
                var title = card.querySelector('.si-7ds-card-title');
                return title && String(title.textContent || '').trim() === 'Builder Notes';
            });
            var targetCard = builderNotes || overlay.querySelector('.si-7ds-card:last-child');
            if (targetCard) {
                targetCard.insertAdjacentHTML('beforebegin', ''
                    + '<div class="si-7ds-card" id="si-admin-alert-settings">'
                    +   '<div class="si-7ds-card-title">Admin Alert Settings</div>'
                    +   '<div class="si-7ds-text"><strong>Unread alerts:</strong> ' + String(getAdminUnreadCount()) + '</div>'
                    +   '<div class="si-7ds-checkrow">'
                    +     '<label><input type="checkbox" id="si-admin-alert-sound"' + (adminAlertSoundEnabled ? ' checked' : '') + '> Sound alert</label>'
                    +     '<label><input type="checkbox" id="si-admin-alert-vibrate"' + (adminAlertVibrateEnabled ? ' checked' : '') + '> Vibrate alert</label>'
                    +   '</div>'
                    +   '<div class="si-7ds-inline-actions">'
                    +     '<button type="button" class="si-7ds-btn alt" data-action="open-newest-unread">Open Newest Alert</button>'
                    +     '<button type="button" class="si-7ds-btn alt" data-action="mark-alerts-read">Mark All Read</button>'
                    +   '</div>'
                    + '</div>');
            }
        }
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
                armPlanSnapshot(selectedPlan).then(function () {
                    saveSession();
                    renderOverlay();
                }).catch(function () {
                    saveSession();
                    renderOverlay();
                });
            });
        });

        [['login-api', function () { loginWithApiKey(); }],
         ['refresh-role', function () { loginWithApiKey(); }],
         ['logout-session', function () { logoutSession(); }],
         ['submit-claim', function () { submitClaim(); }],
         ['review-claim', function () { adminSetClaimStatus('Under review'); }],
         ['approve-claim', function () { adminSetClaimStatus('Approved'); }],
         ['deny-claim', function () { adminSetClaimStatus('Denied'); }],
         ['pay-claim', function () { adminSetClaimStatus('Paid'); }],
         ['save-admin-draft', function () { saveAdminReviewDraft(); }],
         ['next-open-claim', function () { selectNextOpenClaim(); }],
         ['open-newest-unread', function () { openNewestUnreadClaim(); }],
         ['mark-selected-read', function () { markAdminNotificationsRead('selected'); }],
         ['mark-alerts-read', function () { markAdminNotificationsRead('all'); }],
         ['open-terms', null],
         ['clear-history', function () { clearClaimHistory(); }],
         ['bulk-review', function () { bulkSetVisibleClaimsStatus('Under review'); }],
         ['bulk-approve', function () { bulkSetVisibleClaimsStatus('Approved'); }],
         ['bulk-deny', function () { bulkSetVisibleClaimsStatus('Denied'); }],
         ['bulk-pay', function () { bulkSetVisibleClaimsStatus('Paid'); }],
         ['save-sync-settings', function () { saveSyncSettingsFromOverlay(); }],
         ['test-backend', function () { testBackendConnection(); }],
         ['pull-claims', function () { syncClaimsFromBackend(); }],
         ['push-claim', function () { pushCurrentClaimToBackend(); }],
         ['save-backend-auth', function () { saveBackendAuthFromOverlay(); }],
         ['backend-member-login', function () { backendMemberFactionLogin(); }],
         ['backend-admin-login', function () { backendAdminLogin(); }],
         ['backend-whoami', function () { backendWhoAmI(); }],
         ['refresh-history', function () { fetchSelectedClaimHistory(); }]].forEach(function (pair) {
            overlay.querySelectorAll('[data-action="' + pair[0] + '"]').forEach(function (btn) {
                if (btn.dataset.bound) return;
                btn.dataset.bound = '1';
                btn.addEventListener('click', function () {
                    if (pair[0] === 'open-terms') {
                        openTermsModal(btn.getAttribute('data-plan') || 'Terms');
                    } else if (pair[1]) {
                        pair[1]();
                    }
                });
            });
        });

        [['si-claim-stack','stack'],['si-claim-loss','loss'],['si-claim-proof','proof'],['si-claim-note','note'],['si-payout-amount','payout'],['si-decision-note','decision']].forEach(function (pair) {
            var el = overlay.querySelector('#' + pair[0]);
            if (!el || el.dataset.bound) return;
            el.dataset.bound = '1';
            el.addEventListener('input', function () { updateClaimField(pair[1], el.value); });
        });

        ['#si-claim-filter-status', '#si-claim-filter-member', '#si-claim-sort-mode'].forEach(function (sel) {
            var el = overlay.querySelector(sel);
            if (!el || el.dataset.bound) return;
            el.dataset.bound = '1';
            var evt = sel === '#si-claim-filter-member' ? 'input' : 'change';
            el.addEventListener(evt, function () { updateClaimFilters(); });
        });

        var claimSelect = overlay.querySelector('#si-claim-select');
        if (claimSelect && !claimSelect.dataset.bound) {
            claimSelect.dataset.bound = '1';
            claimSelect.addEventListener('change', function () { selectClaimById(claimSelect.value); });
        }

        var soundCb = overlay.querySelector('#si-admin-alert-sound');
        if (soundCb && !soundCb.dataset.bound) {
            soundCb.dataset.bound = '1';
            soundCb.addEventListener('change', function () {
                adminAlertSoundEnabled = !!soundCb.checked;
                saveSession();
            });
        }

        var vibrateCb = overlay.querySelector('#si-admin-alert-vibrate');
        if (vibrateCb && !vibrateCb.dataset.bound) {
            vibrateCb.dataset.bound = '1';
            vibrateCb.addEventListener('change', function () {
                adminAlertVibrateEnabled = !!vibrateCb.checked;
                saveSession();
            });
        }
    }

    function renderOverlay() {
        if (!overlay) return;
        applyPolishStyles();
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
        enhanceOverlayDom();
        bindOverlayEvents();
    }


    function boot() {
        syncCurrentFromSelectedClaim();
        mount();
        fetchSelectedClaimHistory();
        startRemountWatch();
        startAdminClaimNotifications();
        startMemberAutoDetection();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
    // ---- v2.8.8 payment + stage verification extension ----
    var wrathSelectedStage = (typeof GM_getValue === 'function' ? GM_getValue('si_wrath_stage_ext', '') : '');
    var paymentRequiredText = (typeof GM_getValue === 'function' ? GM_getValue('si_payment_required_text_ext', '') : '');
    var paymentVerifiedAt = (typeof GM_getValue === 'function' ? GM_getValue('si_payment_verified_at_ext', '') : '');
    var paymentVerifiedText = (typeof GM_getValue === 'function' ? GM_getValue('si_payment_verified_text_ext', '') : '');
    var paymentVerificationStatus = (typeof GM_getValue === 'function' ? GM_getValue('si_payment_verification_status_ext', 'Not armed') : 'Not armed');
    var paymentFingerprint = (typeof GM_getValue === 'function' ? GM_getValue('si_payment_fingerprint_ext', '') : '');

    var _saveSessionBase = saveSession;
    saveSession = function () {
        _saveSessionBase();
        if (typeof GM_setValue === 'function') {
            GM_setValue('si_wrath_stage_ext', wrathSelectedStage || '');
            GM_setValue('si_payment_required_text_ext', paymentRequiredText || '');
            GM_setValue('si_payment_verified_at_ext', paymentVerifiedAt || '');
            GM_setValue('si_payment_verified_text_ext', paymentVerifiedText || '');
            GM_setValue('si_payment_verification_status_ext', paymentVerificationStatus || 'Not armed');
            GM_setValue('si_payment_fingerprint_ext', paymentFingerprint || '');
        }
    };

    function getWrathStageRequirement(stage) {
        var s = String(stage || wrathSelectedStage || '').toLowerCase().trim();
        if (s === 'stage 1' || s === '1' || s === '1st' || s === 'first') return { key: 'stage 1', label: 'Stage 1', energy: 0, stack: '1st', coverage: '5 Xanax' };
        if (s === 'stage 2' || s === '2' || s === '2nd' || s === 'second') return { key: 'stage 2', label: 'Stage 2', energy: 250, stack: '2nd', coverage: '10 Xanax' };
        if (s === 'stage 3' || s === '3' || s === '3rd' || s === 'third') return { key: 'stage 3', label: 'Stage 3', energy: 500, stack: '3rd', coverage: '15 Xanax' };
        if (s === 'stage 4' || s === '4' || s === '4th' || s === 'fourth') return { key: 'stage 4', label: 'Stage 4', energy: 750, stack: '4th', coverage: '20 Xanax' };
        return null;
    }

    function getWrathStageDisplay(stage) {
        var cfg = getWrathStageRequirement(stage);
        return cfg ? (cfg.label + ' • start ' + cfg.energy + ' energy • coverage ' + cfg.coverage) : 'Not selected';
    }

    function getPlanPaymentRequirement(plan) {
        var p = String(plan || selectedPlan || '');
        if (p === 'Pride Sin') return { text: '2 Xanax', qty: 2, item: 'xanax' };
        if (p === 'Wrath Sin') return { text: '2 Xanax', qty: 2, item: 'xanax' };
        if (p === 'Envy Sin') return { text: '5 Xanax', qty: 5, item: 'xanax' };
        return { text: '', qty: 0, item: '' };
    }

    function extHasKeyword(text, list) {
        var raw = String(text || '').toLowerCase();
        return (list || []).some(function (word) { return raw.indexOf(String(word || '').toLowerCase()) >= 0; });
    }

    function detectLatestPlanPayment(entries, plan, armedAtMs) {
        var requirement = getPlanPaymentRequirement(plan);
        if (!requirement.qty || !requirement.item) return null;
        var hints = (ADMIN_USER_IDS || []).concat(['fries91']);
        var matches = (entries || []).filter(function (entry) {
            var ts = (entry && entry.timestamp ? entry.timestamp * 1000 : 0);
            if (armedAtMs && ts && ts < armedAtMs) return false;
            var text = String(entry && entry.text || '').toLowerCase();
            if (!text) return false;
            var hasAction = extHasKeyword(text, [' sent ', ' send ', ' gave ', ' transfer', ' traded ', ' trade ', ' mail']);
            var hasItem = text.indexOf(requirement.item) >= 0;
            var hasQty = text.indexOf(String(requirement.qty)) >= 0 || (requirement.qty === 2 && (text.indexOf('two') >= 0 || text.indexOf('pair') >= 0));
            var hasWho = extHasKeyword(text, hints);
            return hasAction && hasItem && hasQty && hasWho;
        }).sort(function (a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
        return matches.length ? matches[0] : null;
    }

    var _getPlanRuleTextBase = getPlanRuleText;
    getPlanRuleText = function (plan) {
        var p = String(plan || '');
        if (p === 'Wrath Sin') {
            var cfg = getWrathStageRequirement(wrathSelectedStage);
            return cfg ? (cfg.label + ' must arm at ' + cfg.energy + ' energy') : 'choose a Wrath stage first';
        }
        if (p === 'Envy Sin') return 'must arm at 1000 energy with 0 booster cooldown';
        return _getPlanRuleTextBase(plan);
    };

    getPlanRuleState = function (plan) {
        var p = String(plan || selectedPlan || '');
        if (!p || p === 'None') return { ok: false, code: 'no-plan', text: 'No plan selected' };
        if (!planActivationAt || !planActivationPlan || planActivationPlan !== p) return { ok: false, code: 'not-armed', text: 'Plan not armed yet' };
        var expiryMs = getPlanExpiryMs(p, planActivationAt);
        if (!expiryMs || Date.now() > expiryMs) return { ok: false, code: 'expired', text: 'Armed window expired' };
        var energyCurrent = parseEnergyCurrent(planActivationEnergy);
        var boosterSecs = cooldownSecondsFromAny(planActivationBoosterCd);
        if (p === 'Wrath Sin') {
            var wrathCfg = getWrathStageRequirement(wrathSelectedStage);
            if (!wrathCfg) return { ok: false, code: 'wrath-stage', text: 'Choose a Wrath stage before arming' };
            if (energyCurrent !== wrathCfg.energy) return { ok: false, code: 'wrath-energy', text: wrathCfg.label + ' needs ' + wrathCfg.energy + ' energy at arm time' };
            return { ok: true, code: 'ok', text: 'Wrath ' + wrathCfg.label + ' armed - ' + wrathCfg.energy + ' energy start confirmed' };
        }
        if (p === 'Envy Sin') {
            if (energyCurrent !== 1000) return { ok: false, code: 'envy-energy', text: 'Envy needs 1000 energy at arm time' };
            if (boosterSecs > 0) return { ok: false, code: 'envy-cd', text: 'Envy needs 0 booster cooldown at arm time' };
            return { ok: true, code: 'ok', text: 'Envy armed - 1000 energy and 0 booster cooldown confirmed' };
        }
        return _getPlanRuleTextBase(p) ? { ok: true, code: 'ok', text: _getPlanRuleTextBase(p) } : { ok: true, code: 'ok', text: p + ' armed and valid' };
    };

    var _armPlanSnapshotBase = armPlanSnapshot;
    armPlanSnapshot = function (plan) {
        paymentRequiredText = getPlanPaymentRequirement(plan || selectedPlan).text || '';
        paymentVerifiedAt = '';
        paymentVerifiedText = '';
        paymentFingerprint = '';
        paymentVerificationStatus = paymentRequiredText ? ('Waiting for payment to admin: ' + paymentRequiredText) : 'No payment rule';
        return _armPlanSnapshotBase(plan).then(function (data) {
            saveSession();
            return data;
        });
    };

    function armWrathStage(stage) {
        var cfg = getWrathStageRequirement(stage);
        if (!cfg) return Promise.resolve(null);
        wrathSelectedStage = cfg.label;
        selectedPlan = 'Wrath Sin';
        claimStack = cfg.stack;
        claimLoss = cfg.energy + ' energy lost';
        autoDetectStatus = 'Arming Wrath ' + cfg.label + '...';
        return armPlanSnapshot('Wrath Sin');
    }

    applyDetectedXanaxOverdose = function (entry) {
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
            autoDetectStatus = 'OD found - select plan';
            saveSession();
            renderOverlay();
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
        var ruleState = getPlanRuleState(selectedPlan);
        if (!ruleState.ok) {
            autoDetectStatus = 'OD found - rule check failed';
            claimStatus = 'Detected - rules failed';
            claimLoss = getAutoLossFromOd(selectedPlan, entry.text);
            claimProof = buildAutoProofNote(entry);
            claimNote = 'Auto-detected Xanax overdose, but plan verification failed: ' + ruleState.text + '.';
            claimStack = getAutoStackFromOd(selectedPlan, entry.text);
            saveSession();
            renderOverlay();
            return Promise.resolve(null);
        }
        if (!paymentVerifiedAt) {
            autoDetectStatus = 'OD found - payment to admin not verified';
            claimStatus = 'Detected - payment missing';
            claimLoss = getAutoLossFromOd(selectedPlan, entry.text);
            claimProof = buildAutoProofNote(entry);
            claimNote = 'Auto-detected Xanax overdose, but required payment to admin was not verified after plan activation.';
            claimStack = getAutoStackFromOd(selectedPlan, entry.text);
            saveSession();
            renderOverlay();
            return Promise.resolve(null);
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
            saveSession();
            renderOverlay();
            return Promise.resolve(null);
        }
        claimId = makeClaimId();
        selectedClaimId = claimId;
        claimStatus = 'Pending review';
        claimStack = getAutoStackFromOd(selectedPlan, entry.text);
        claimLoss = getAutoLossFromOd(selectedPlan, entry.text);
        claimProof = buildAutoProofNote(entry) + ' | Armed ' + planActivationAt + ' | Energy ' + (planActivationEnergy || 'unknown') + ' | Booster CD ' + (planActivationBoosterCd || 'unknown') + ' | Payment verified ' + paymentVerifiedAt + (paymentVerifiedText ? ' | ' + paymentVerifiedText : '') + ' | Terms verified: ' + ruleState.text;
        claimNote = 'Auto-detected via Torn API within ' + getPlanWindowLabel(selectedPlan) + ': ' + String(entry.text || '').replace(/\s+/g, ' ').slice(0, 180) + ' | Armed plan ' + selectedPlan + (selectedPlan === 'Wrath Sin' && wrathSelectedStage ? (' ' + wrathSelectedStage) : '') + ' at ' + planActivationAt + '. Payment verified at ' + paymentVerifiedAt + '. Terms check: ' + ruleState.text + '.';
        addClaimHistoryEntry((sessionName || 'Member') + ' had a Xanax overdose auto-detected within the ' + getPlanWindowLabel(selectedPlan) + ' window for ' + selectedPlan + ', payment was verified, and claim ' + claimId + ' was created automatically.');
        upsertCurrentClaimRecord();
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
    };

    runMemberAutoDetection = function () {
        if (!isMember() || !memberApiKey) return Promise.resolve(null);
        autoDetectStatus = 'Checking Torn for payment + Xanax OD...';
        saveSession();
        return getTornOdFeed(memberApiKey).then(function (data) {
            if (data && data.error) {
                autoDetectStatus = 'OD check failed: ' + String((data.error && data.error.error) || 'API error');
                saveSession();
                renderOverlay();
                return null;
            }
            var entries = collectActivityEntries(data || {});
            if (planActivationAt && planActivationPlan && !paymentVerifiedAt) {
                var armedAtMs = parseIsoOrLocalTimestamp(planActivationAt);
                var paymentHit = detectLatestPlanPayment(entries, planActivationPlan, armedAtMs);
                if (paymentHit) {
                    var paymentFp = String((paymentHit.id || '') + '|' + (paymentHit.timestamp || '') + '|' + String(paymentHit.text || '').slice(0, 140));
                    if (paymentFp !== paymentFingerprint) {
                        paymentFingerprint = paymentFp;
                        paymentVerifiedAt = paymentHit.timestamp ? new Date(paymentHit.timestamp * 1000).toLocaleString() : new Date().toLocaleString();
                        paymentVerifiedText = 'Matched ' + (paymentRequiredText || getPlanPaymentRequirement(planActivationPlan).text || 'required payment') + ' to admin from Torn log';
                        paymentVerificationStatus = 'Verified at ' + paymentVerifiedAt;
                        addClaimHistoryEntry((sessionName || 'Member') + ' payment verified for ' + (planActivationPlan || 'plan') + ' at ' + paymentVerifiedAt + '.');
                    }
                } else if (paymentRequiredText) {
                    paymentVerificationStatus = 'Waiting for payment to admin: ' + paymentRequiredText;
                }
            }
            var latest = detectLatestXanaxOverdose(entries);
            if (!latest) {
                autoDetectStatus = paymentVerifiedAt ? 'Payment verified - watching for next Xanax OD' : 'Watching for payment and next Xanax OD';
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
    };

    var _upsertCurrentClaimRecordBase = upsertCurrentClaimRecord;
    upsertCurrentClaimRecord = function () {
        _upsertCurrentClaimRecordBase();
        if (!claimId) return;
        var items = getClaimsDbItems();
        var idx = items.findIndex(function (item) { return item && item.id === claimId; });
        if (idx < 0) return;
        items[idx].armedAt = planActivationAt || '';
        items[idx].armedPlan = (planActivationPlan || '') + (planActivationPlan === 'Wrath Sin' && wrathSelectedStage ? (' - ' + wrathSelectedStage) : '');
        items[idx].armedEnergy = planActivationEnergy || '';
        items[idx].armedBoosterCd = planActivationBoosterCd || '';
        items[idx].expiresAt = planActivationExpiresAt || '';
        items[idx].paymentRequired = paymentRequiredText || '';
        items[idx].paymentVerifiedAt = paymentVerifiedAt || '';
        items[idx].paymentVerifiedText = paymentVerifiedText || '';
        items[idx].ruleCheck = (getPlanRuleState(planActivationPlan || selectedPlan).text || '');
        items[idx].detectStatus = autoDetectStatus || '';
        saveClaimsDbItems(items);
    };

    var _syncCurrentFromSelectedClaimBase = syncCurrentFromSelectedClaim;
    syncCurrentFromSelectedClaim = function () {
        _syncCurrentFromSelectedClaimBase();
        var rec = getSelectedClaimRecord();
        if (!rec) return;
        if (rec.armedAt) planActivationAt = rec.armedAt;
        if (rec.armedPlan) planActivationPlan = String(rec.armedPlan).indexOf('Wrath Sin') === 0 ? 'Wrath Sin' : rec.armedPlan;
        if (rec.armedEnergy) planActivationEnergy = rec.armedEnergy;
        if (rec.armedBoosterCd) planActivationBoosterCd = rec.armedBoosterCd;
        if (rec.expiresAt) planActivationExpiresAt = rec.expiresAt;
        if (rec.paymentRequired) paymentRequiredText = rec.paymentRequired;
        if (rec.paymentVerifiedAt) paymentVerifiedAt = rec.paymentVerifiedAt;
        if (rec.paymentVerifiedText) paymentVerifiedText = rec.paymentVerifiedText;
    };

    var _pushCurrentClaimToBackendBase = pushCurrentClaimToBackend;
    pushCurrentClaimToBackend = function () {
        upsertCurrentClaimRecord();
        return _pushCurrentClaimToBackendBase();
    };

    openTermsModal = function (plan) {
        activeTermsPlan = plan || 'Terms';
        var bodyText = 'Terms not found.';
        if (plan === 'Pride Sin') bodyText = '(Can start with any amount of energy!)';
        if (plan === 'Wrath Sin') bodyText = '(Choose your Wrath stage first. Stage 1 starts at 0 energy, Stage 2 at 250 energy, Stage 3 at 500 energy, Stage 4 at 750 energy. Required payment: 2 Xanax to admin. Can combine with Envy plan.)';
        if (plan === 'Envy Sin') bodyText = '(Must start at 1000 energy with 0 booster CD, take 4 E-DVD\'s, then take Ecstasy! Required payment: 5 Xanax to admin. Combinable with Wrath for Xanax coverage.)';
        var existing = document.getElementById('si-7ds-terms-modal');
        if (existing) existing.remove();
        var modal = document.createElement('div');
        modal.id = 'si-7ds-terms-modal';
        modal.innerHTML = '<div class="si-7ds-terms-card"><button type="button" class="si-7ds-terms-close">×</button><div class="si-7ds-terms-title">' + esc(activeTermsPlan) + ' Terms</div><div class="si-7ds-terms-body">' + esc(bodyText) + '</div></div>';
        document.body.appendChild(modal);
        var closer = modal.querySelector('.si-7ds-terms-close');
        if (closer) closer.addEventListener('click', function () { modal.remove(); });
        modal.addEventListener('click', function (ev) { if (ev.target === modal) modal.remove(); });
    };

    getMemberStatusCardHtml = function () {
        var expiry = planActivationExpiresAt || (getPlanExpiryMs(planActivationPlan, planActivationAt) ? new Date(getPlanExpiryMs(planActivationPlan, planActivationAt)).toLocaleString() : '—');
        var rule = getPlanRuleState(planActivationPlan || selectedPlan);
        return ''
            + '<div class="si-7ds-card" id="si-member-status-card">'
            +   '<div class="si-7ds-card-title">Member Claim Status</div>'
            +   '<div class="si-7ds-summary-grid">'
            +     '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + esc(planActivationPlan || selectedPlan || 'None') + '</div><div class="si-7ds-summary-label">Armed plan</div></div>'
            +     '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + esc(planActivationAt || '—') + '</div><div class="si-7ds-summary-label">Armed at</div></div>'
            +     '<div class="si-7ds-summary-tile"><div class="si-7ds-summary-num">' + esc(expiry || '—') + '</div><div class="si-7ds-summary-label">Expires at</div></div>'
            +   '</div>'
            +   '<div class="si-7ds-text"><strong>Wrath stage:</strong> ' + esc(planActivationPlan === 'Wrath Sin' ? getWrathStageDisplay(wrathSelectedStage) : '—') + '</div>'
            +   '<div class="si-7ds-text"><strong>Energy at arm:</strong> ' + esc(planActivationEnergy || '—') + '</div>'
            +   '<div class="si-7ds-text"><strong>Booster CD at arm:</strong> ' + esc(planActivationBoosterCd || '—') + '</div>'
            +   '<div class="si-7ds-text"><strong>Rule check:</strong> ' + esc(rule.text || '—') + '</div>'
            +   '<div class="si-7ds-text"><strong>Payment required:</strong> ' + esc(paymentRequiredText || '—') + '</div>'
            +   '<div class="si-7ds-text"><strong>Payment verify:</strong> ' + esc(paymentVerificationStatus || 'Not armed') + (paymentVerifiedText ? ' | ' + esc(paymentVerifiedText) : '') + '</div>'
            +   '<div class="si-7ds-text"><strong>OD detect:</strong> ' + esc(autoDetectStatus || 'Idle') + (autoOdDetectedAt ? ' | Last hit: ' + esc(autoOdDetectedAt) : '') + '</div>'
            +   '<div class="si-7ds-pillrow"><span class="si-7ds-status-badge ' + getStatusClass(claimStatus) + '">' + esc(claimStatus || 'Not submitted') + '</span></div>'
            + '</div>';
    };

    var _enhanceOverlayDomBase = enhanceOverlayDom;
    enhanceOverlayDom = function () {
        _enhanceOverlayDomBase();
        if (!overlay || activeTab !== 'plans') return;
        Array.prototype.slice.call(overlay.querySelectorAll('.si-7ds-plan-box')).forEach(function (box) {
            var nameEl = box.querySelector('.si-7ds-plan-name');
            var grid = box.querySelector('.si-7ds-plan-grid');
            var actions = box.querySelector('.si-7ds-plan-actions');
            if (!nameEl || !grid || !actions) return;
            var name = String(nameEl.textContent || '').trim();
            if (name === 'Wrath Sin') {
                grid.innerHTML = ''
                    + '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Payment</div><div class="si-7ds-plan-stat-value">2 Xanax</div></div>'
                    + '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Window</div><div class="si-7ds-plan-stat-value">48 hours</div></div>'
                    + '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Coverage</div><div class="si-7ds-plan-stat-value">S1 5 / S2 10 / S3 15 / S4 20</div></div>'
                    + '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Terms</div><div class="si-7ds-plan-stat-value">Pick stage button first</div></div>';
                actions.innerHTML = ''
                    + '<button type="button" class="si-7ds-btn" data-action="select-wrath-stage" data-stage="Stage 1">Stage 1</button>'
                    + '<button type="button" class="si-7ds-btn" data-action="select-wrath-stage" data-stage="Stage 2">Stage 2</button>'
                    + '<button type="button" class="si-7ds-btn" data-action="select-wrath-stage" data-stage="Stage 3">Stage 3</button>'
                    + '<button type="button" class="si-7ds-btn" data-action="select-wrath-stage" data-stage="Stage 4">Stage 4</button>'
                    + '<button type="button" class="si-7ds-btn alt" data-action="open-terms" data-plan="Wrath Sin">Terms</button>';
                if (!box.querySelector('.si-7ds-wrath-stage-note')) {
                    var note = document.createElement('div');
                    note.className = 'si-7ds-text si-7ds-wrath-stage-note';
                    note.innerHTML = '<strong>Selected stage:</strong> ' + esc(getWrathStageDisplay(wrathSelectedStage));
                    actions.insertAdjacentElement('afterend', note);
                } else {
                    box.querySelector('.si-7ds-wrath-stage-note').innerHTML = '<strong>Selected stage:</strong> ' + esc(getWrathStageDisplay(wrathSelectedStage));
                }
            }
            if (name === 'Envy Sin') {
                grid.innerHTML = ''
                    + '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Coverage</div><div class="si-7ds-plan-stat-value">25 Xanax / 3 E-DVD’s</div></div>'
                    + '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Payment</div><div class="si-7ds-plan-stat-value">5 Xanax</div></div>'
                    + '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Window</div><div class="si-7ds-plan-stat-value">48 hours</div></div>'
                    + '<div class="si-7ds-plan-stat"><div class="si-7ds-plan-stat-label">Terms</div><div class="si-7ds-plan-stat-value">1000 Energy / 0 booster CD</div></div>';
            }
        });
    };

    var _bindOverlayEventsBase = bindOverlayEvents;
    bindOverlayEvents = function () {
        _bindOverlayEventsBase();
        if (!overlay) return;
        overlay.querySelectorAll('[data-action="select-wrath-stage"]').forEach(function (btn) {
            if (btn.dataset.boundExt) return;
            btn.dataset.boundExt = '1';
            btn.addEventListener('click', function () {
                var stage = btn.getAttribute('data-stage') || '';
                armWrathStage(stage).then(function () {
                    saveSession();
                    renderOverlay();
                }).catch(function () {
                    saveSession();
                    renderOverlay();
                });
            });
        });
    };


    // ---- v2.8.9 admin receipt verification extension ----
    var adminReceiptVerifiedAt = (typeof GM_getValue === 'function' ? GM_getValue('si_admin_receipt_verified_at_ext', '') : '');
    var adminReceiptVerifiedText = (typeof GM_getValue === 'function' ? GM_getValue('si_admin_receipt_verified_text_ext', '') : '');
    var adminReceiptVerificationStatus = (typeof GM_getValue === 'function' ? GM_getValue('si_admin_receipt_verification_status_ext', 'Idle') : 'Idle');
    var adminReceiptFingerprint = (typeof GM_getValue === 'function' ? GM_getValue('si_admin_receipt_fingerprint_ext', '') : '');
    var adminReceiptVerifiedClaimId = (typeof GM_getValue === 'function' ? GM_getValue('si_admin_receipt_verified_claim_id_ext', '') : '');

    var _saveSessionV289 = saveSession;
    saveSession = function () {
        _saveSessionV289();
        if (typeof GM_setValue === 'function') {
            GM_setValue('si_admin_receipt_verified_at_ext', adminReceiptVerifiedAt || '');
            GM_setValue('si_admin_receipt_verified_text_ext', adminReceiptVerifiedText || '');
            GM_setValue('si_admin_receipt_verification_status_ext', adminReceiptVerificationStatus || 'Idle');
            GM_setValue('si_admin_receipt_fingerprint_ext', adminReceiptFingerprint || '');
            GM_setValue('si_admin_receipt_verified_claim_id_ext', adminReceiptVerifiedClaimId || '');
        }
    };

    function getPlanNameFromRecord(rec) {
        var armed = String(rec && rec.armedPlan || '');
        if (armed.indexOf('Wrath Sin') === 0) return 'Wrath Sin';
        if (armed.indexOf('Pride Sin') === 0) return 'Pride Sin';
        if (armed.indexOf('Envy Sin') === 0) return 'Envy Sin';
        return String(rec && rec.plan || selectedPlan || '');
    }

    function getClaimPaymentRequirement(rec) {
        var plan = getPlanNameFromRecord(rec);
        return getPlanPaymentRequirement(plan);
    }

    function getClaimMemberHints(rec) {
        var hints = [];
        var member = String(rec && rec.member || '').trim();
        var memberId = String(rec && (rec.memberId || rec.playerId) || '').trim();
        if (member) hints.push(member.toLowerCase());
        if (memberId) hints.push(memberId.toLowerCase());
        return hints.filter(Boolean);
    }

    function detectAdminReceiptForClaim(entries, rec) {
        var requirement = getClaimPaymentRequirement(rec);
        if (!requirement.qty || !requirement.item) return null;
        var armedAtMs = parseIsoOrLocalTimestamp((rec && rec.armedAt) || planActivationAt || '');
        var hints = getClaimMemberHints(rec);
        var planText = String((rec && (rec.paymentRequired || rec.paymentVerifiedText)) || requirement.text || '').toLowerCase();
        var matches = (entries || []).filter(function (entry) {
            var ts = (entry && entry.timestamp ? entry.timestamp * 1000 : 0);
            if (armedAtMs && ts && ts < armedAtMs) return false;
            var text = String(entry && entry.text || '').toLowerCase();
            if (!text) return false;
            var hasReceive = extHasKeyword(text, ['received', 'receive', 'you got', 'you received', 'was sent', 'mail', 'trade', 'traded', 'transfer']);
            var hasItem = text.indexOf(requirement.item) >= 0;
            var hasQty = text.indexOf(String(requirement.qty)) >= 0 || (requirement.qty === 2 && (text.indexOf('two') >= 0 || text.indexOf('pair') >= 0));
            var hasMember = !hints.length || hints.some(function (h) { return text.indexOf(h) >= 0; });
            return hasReceive && hasItem && hasQty && hasMember;
        }).sort(function (a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
        if (!matches.length) return null;
        var hit = matches[0];
        hit.requirementText = planText || requirement.text || '';
        return hit;
    }

    function writeAdminReceiptBackToClaim(rec) {
        if (!rec || !rec.id) return;
        var items = getClaimsDbItems();
        var idx = items.findIndex(function (item) { return item && item.id === rec.id; });
        if (idx < 0) return;
        items[idx].adminReceiptVerifiedAt = adminReceiptVerifiedAt || '';
        items[idx].adminReceiptVerifiedText = adminReceiptVerifiedText || '';
        items[idx].adminReceiptVerificationStatus = adminReceiptVerificationStatus || 'Idle';
        saveClaimsDbItems(items);
    }

    function runAdminPaymentVerification(force) {
        if (!isAdmin() || !memberApiKey) return Promise.resolve(null);
        var rec = getSelectedClaimRecord();
        if (!rec || !rec.id) {
            adminReceiptVerificationStatus = 'Select a claim to verify admin receipt';
            saveSession();
            if (force) renderOverlay();
            return Promise.resolve(null);
        }
        var plan = getPlanNameFromRecord(rec);
        var requirement = getClaimPaymentRequirement(rec);
        if (!plan || !requirement.qty) {
            adminReceiptVerificationStatus = 'No payment rule for selected claim';
            saveSession();
            if (force) renderOverlay();
            return Promise.resolve(null);
        }
        if (adminReceiptVerifiedClaimId !== rec.id) {
            adminReceiptVerifiedAt = String(rec.adminReceiptVerifiedAt || '');
            adminReceiptVerifiedText = String(rec.adminReceiptVerifiedText || '');
            adminReceiptVerificationStatus = String(rec.adminReceiptVerificationStatus || ('Checking admin receipt for ' + requirement.text));
            adminReceiptFingerprint = '';
            adminReceiptVerifiedClaimId = rec.id;
        }
        adminReceiptVerificationStatus = adminReceiptVerifiedAt ? ('Verified in admin log at ' + adminReceiptVerifiedAt) : ('Checking admin receipt for ' + requirement.text + '...');
        saveSession();
        if (force) renderOverlay();
        return getTornOdFeed(memberApiKey).then(function (data) {
            if (data && data.error) {
                adminReceiptVerificationStatus = 'Admin log check failed';
                saveSession();
                if (force) renderOverlay();
                return null;
            }
            var entries = collectActivityEntries(data || {});
            var hit = detectAdminReceiptForClaim(entries, rec);
            if (!hit) {
                adminReceiptVerificationStatus = 'Waiting for admin log receipt of ' + requirement.text + ' from ' + (rec.member || 'member');
                adminReceiptVerifiedText = adminReceiptVerifiedText || '';
                adminReceiptVerifiedAt = '';
                writeAdminReceiptBackToClaim(rec);
                saveSession();
                if (force) renderOverlay();
                return null;
            }
            var fp = String((hit.id || '') + '|' + (hit.timestamp || '') + '|' + String(hit.text || '').slice(0, 160));
            adminReceiptFingerprint = fp;
            adminReceiptVerifiedClaimId = rec.id;
            adminReceiptVerifiedAt = hit.timestamp ? new Date(hit.timestamp * 1000).toLocaleString() : new Date().toLocaleString();
            adminReceiptVerifiedText = 'Admin log matched ' + requirement.text + ' from ' + (rec.member || 'member') + '.';
            adminReceiptVerificationStatus = 'Verified in admin log at ' + adminReceiptVerifiedAt;
            if (claimId === rec.id) {
                var marker = '[Admin receipt verified ' + adminReceiptVerifiedAt + ']';
                if (String(claimProof || '').indexOf(marker) < 0) {
                    claimProof = (claimProof ? (claimProof + ' | ') : '') + marker;
                }
            }
            writeAdminReceiptBackToClaim(rec);
            addClaimHistoryEntry((sessionName || 'Admin') + ' verified insurance payment in admin log for claim ' + rec.id + '.');
            saveSession();
            if (force) renderOverlay();
            return hit;
        }).catch(function () {
            adminReceiptVerificationStatus = 'Admin log check failed';
            saveSession();
            if (force) renderOverlay();
            return null;
        });
    }

    var _saveBackendAuthFromOverlayV289 = saveBackendAuthFromOverlay;
    saveBackendAuthFromOverlay = function () {
        _saveBackendAuthFromOverlayV289();
        var keyEl = overlay && overlay.querySelector('#si-login-api-key');
        var factionEl = overlay && overlay.querySelector('#si-faction-id-lock');
        if (keyEl) memberApiKey = String(keyEl.value || '').trim();
        if (factionEl) factionIdLock = String(factionEl.value || '').trim();
        authMode = memberApiKey ? 'torn-api' : (authMode || 'local');
        saveSession();
    };

    backendAdminLogin = function () {
        saveBackendAuthFromOverlay();
        if (!apiBase || !memberApiKey || !factionIdLock) {
            window.alert('Fill in API Base URL, Torn API key, and Faction ID lock first.');
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
                authMode = 'torn-api';
                backendStatus = 'API key login ok';
                lastSyncAt = new Date().toLocaleString();
                saveSession();
                renderOverlay();
                startAdminClaimNotifications();
                startMemberAutoDetection();
                return data;
            }
            window.alert((data && data.error) ? data.error : 'API key login failed.');
            return data;
        }).catch(function () {
            backendStatus = 'API key login failed';
            lastSyncAt = new Date().toLocaleString();
            saveSession();
            renderOverlay();
            return null;
        });
    };

    backendWhoAmI = function () {
        saveBackendAuthFromOverlay();
        if (!apiBase || !memberApiKey || !factionIdLock) return Promise.resolve(null);
        return apiRequest('POST', '/api/auth/faction-login', {
            api_key: memberApiKey,
            faction_id: factionIdLock,
            secret: syncSecret
        }).then(function (data) {
            if (data && data.ok && data.user) {
                sessionName = data.user.name || data.user.username || 'Member';
                sessionRole = data.user.role || 'member';
                authMode = 'torn-api';
                saveSession();
                renderOverlay();
            }
            return data;
        }).catch(function () { return null; });
    };

    var _startAdminClaimNotificationsV289 = startAdminClaimNotifications;
    startAdminClaimNotifications = function () {
        _startAdminClaimNotificationsV289();
        if (!isAdmin()) return;
        runAdminPaymentVerification(false).catch(function () {});
        if (adminNotifyTimer) {
            clearInterval(adminNotifyTimer);
            adminNotifyTimer = setInterval(function () {
                if (apiBase && syncSecret) {
                    syncClaimsFromBackend().catch(function () {});
                }
                runAdminPaymentVerification(false).catch(function () {});
            }, 60000);
        }
    };

    var _selectClaimByIdV289 = selectClaimById;
    selectClaimById = function (id) {
        _selectClaimByIdV289(id);
        if (isAdmin()) {
            runAdminPaymentVerification(true).catch(function () {});
        }
    };

    var _renderOverlayV289 = renderOverlay;
    renderOverlay = function () {
        _renderOverlayV289();
        if (!overlay) return;
        if (isAdmin()) {
            var reviewPanel = overlay.querySelector('.si-7ds-admin-panel');
            if (reviewPanel && !overlay.querySelector('#si-admin-receipt-card')) {
                var rec = getSelectedClaimRecord();
                var req = getClaimPaymentRequirement(rec);
                var block = ''
                    + '<div id="si-admin-receipt-card" class="si-7ds-note-box">'
                    +   '<div class="si-7ds-text"><strong>Required payment:</strong> ' + esc((rec && rec.paymentRequired) || (req.text || 'Not set')) + '</div>'
                    +   '<div class="si-7ds-text"><strong>Admin receipt:</strong> ' + esc(adminReceiptVerificationStatus || 'Idle') + '</div>'
                    +   '<div class="si-7ds-text"><strong>Receipt proof:</strong> ' + esc(adminReceiptVerifiedText || 'Waiting for admin log match') + '</div>'
                    +   '<div class="si-7ds-plan-actions">'
                    +     '<button type="button" class="si-7ds-btn alt" data-action="verify-admin-receipt">Verify Admin Receipt</button>'
                    +   '</div>'
                    + '</div>';
                var target = reviewPanel.querySelector('.si-7ds-admin-note-box') || reviewPanel;
                target.insertAdjacentHTML('beforebegin', block);
            }
            overlay.querySelectorAll('[data-action="verify-admin-receipt"]').forEach(function (btn) {
                if (btn.dataset.bound) return;
                btn.dataset.bound = '1';
                btn.addEventListener('click', function () { runAdminPaymentVerification(true); });
            });
        }
    };


    // ===== Admin payout verification extension =====
    var adminPayoutVerifiedAt = (typeof GM_getValue === 'function' ? GM_getValue('si_admin_payout_verified_at_ext', '') : '');
    var adminPayoutVerifiedText = (typeof GM_getValue === 'function' ? GM_getValue('si_admin_payout_verified_text_ext', '') : '');
    var adminPayoutVerificationStatus = (typeof GM_getValue === 'function' ? GM_getValue('si_admin_payout_verification_status_ext', 'Idle') : 'Idle');
    var adminPayoutFingerprint = (typeof GM_getValue === 'function' ? GM_getValue('si_admin_payout_fingerprint_ext', '') : '');
    var adminPayoutVerifiedClaimId = (typeof GM_getValue === 'function' ? GM_getValue('si_admin_payout_verified_claim_id_ext', '') : '');

    var _saveSessionV290 = saveSession;
    saveSession = function () {
        _saveSessionV290();
        if (typeof GM_setValue === 'function') {
            GM_setValue('si_admin_payout_verified_at_ext', adminPayoutVerifiedAt || '');
            GM_setValue('si_admin_payout_verified_text_ext', adminPayoutVerifiedText || '');
            GM_setValue('si_admin_payout_verification_status_ext', adminPayoutVerificationStatus || 'Idle');
            GM_setValue('si_admin_payout_fingerprint_ext', adminPayoutFingerprint || '');
            GM_setValue('si_admin_payout_verified_claim_id_ext', adminPayoutVerifiedClaimId || '');
        }
    };

    function parseRequirementText(raw) {
        var text = String(raw || '').trim();
        if (!text) return { text: '', qty: 0, item: '' };
        var normalized = text.toLowerCase().replace(/[,]/g, ' ').replace(/\s+/g, ' ').trim();
        var m = normalized.match(/(\d+)\s*(xanax|e-?dvd(?:s)?|edvd(?:s)?|dvd(?:s)?|ecstasy|points?)/i);
        if (!m) return { text: text, qty: 0, item: '' };
        var qty = parseInt(m[1], 10) || 0;
        var item = String(m[2] || '').toLowerCase();
        if (item.indexOf('dvd') >= 0) item = 'dvd';
        return { text: text, qty: qty, item: item };
    }

    function getClaimPayoutRequirement(rec) {
        var raw = String((rec && rec.payout) || payoutAmount || '').trim();
        if (!raw) {
            var plan = getPlanNameFromRecord(rec);
            if (plan === 'Pride Sin') raw = '6 Xanax';
            else if (plan === 'Envy Sin') raw = '25 Xanax';
            else if (plan === 'Wrath Sin') {
                var stack = String((rec && rec.stack) || '').toLowerCase();
                if (stack.indexOf('4') >= 0) raw = '20 Xanax';
                else if (stack.indexOf('3') >= 0) raw = '15 Xanax';
                else if (stack.indexOf('2') >= 0) raw = '10 Xanax';
                else raw = '5 Xanax';
            }
        }
        return parseRequirementText(raw);
    }

    function detectAdminPayoutForClaim(entries, rec) {
        var requirement = getClaimPayoutRequirement(rec);
        if (!requirement.qty || !requirement.item) return null;
        var fromMs = parseIsoOrLocalTimestamp((rec && (rec.adminReceiptVerifiedAt || rec.updatedAt || rec.armedAt)) || '');
        var hints = getClaimMemberHints(rec);
        var matches = (entries || []).filter(function (entry) {
            var ts = (entry && entry.timestamp ? entry.timestamp * 1000 : 0);
            if (fromMs && ts && ts < fromMs) return false;
            var text = String(entry && entry.text || '').toLowerCase();
            if (!text) return false;
            var hasSend = extHasKeyword(text, [' sent ', ' send ', ' gave ', ' transfer', ' traded ', ' trade ', ' mailed ', ' mail ', ' you sent ', ' you gave ']);
            var hasItem = requirement.item === 'dvd' ? (text.indexOf('dvd') >= 0) : (text.indexOf(requirement.item) >= 0);
            var hasQty = text.indexOf(String(requirement.qty)) >= 0 || (requirement.qty === 2 && (text.indexOf('two') >= 0 || text.indexOf('pair') >= 0));
            var hasMember = !hints.length || hints.some(function (h) { return text.indexOf(h) >= 0; });
            return hasSend && hasItem && hasQty && hasMember;
        }).sort(function (a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
        return matches.length ? matches[0] : null;
    }

    function writeAdminPayoutBackToClaim(rec) {
        if (!rec || !rec.id) return;
        var items = getClaimsDbItems();
        var idx = items.findIndex(function (item) { return item && item.id === rec.id; });
        if (idx < 0) return;
        items[idx].adminPayoutVerifiedAt = adminPayoutVerifiedAt || '';
        items[idx].adminPayoutVerifiedText = adminPayoutVerifiedText || '';
        items[idx].adminPayoutVerificationStatus = adminPayoutVerificationStatus || 'Idle';
        items[idx].paidAt = adminPayoutVerifiedAt || items[idx].paidAt || '';
        items[idx].completedLocked = adminPayoutVerifiedAt ? 'yes' : (items[idx].completedLocked || '');
        saveClaimsDbItems(items);
    }

    function runAdminPayoutVerification(force) {
        if (!isAdmin() || !memberApiKey) return Promise.resolve(null);
        var rec = getSelectedClaimRecord();
        if (!rec || !rec.id) {
            adminPayoutVerificationStatus = 'Select a claim to verify payout';
            saveSession();
            if (force) renderOverlay();
            return Promise.resolve(null);
        }
        var requirement = getClaimPayoutRequirement(rec);
        if (!requirement.qty) {
            adminPayoutVerificationStatus = 'Set payout amount first';
            saveSession();
            if (force) renderOverlay();
            return Promise.resolve(null);
        }
        if (adminPayoutVerifiedClaimId !== rec.id) {
            adminPayoutVerifiedAt = String(rec.adminPayoutVerifiedAt || rec.paidAt || '');
            adminPayoutVerifiedText = String(rec.adminPayoutVerifiedText || '');
            adminPayoutVerificationStatus = String(rec.adminPayoutVerificationStatus || ('Checking admin payout for ' + requirement.text));
            adminPayoutFingerprint = '';
            adminPayoutVerifiedClaimId = rec.id;
        }
        adminPayoutVerificationStatus = adminPayoutVerifiedAt ? ('Verified payout at ' + adminPayoutVerifiedAt) : ('Checking admin payout for ' + requirement.text + '...');
        saveSession();
        if (force) renderOverlay();
        return getTornOdFeed(memberApiKey).then(function (data) {
            var entries = collectActivityEntries(data);
            var hit = detectAdminPayoutForClaim(entries, rec);
            if (!hit) {
                adminPayoutVerificationStatus = 'No payout log match found yet';
                adminPayoutVerifiedAt = '';
                adminPayoutVerifiedText = '';
                adminPayoutFingerprint = '';
                writeAdminPayoutBackToClaim(rec);
                saveSession();
                if (force) renderOverlay();
                return null;
            }
            adminPayoutVerifiedAt = formatTimestampMs((hit.timestamp || 0) * 1000);
            adminPayoutVerifiedText = String(hit.text || '').trim();
            adminPayoutFingerprint = String(hit.id || adminPayoutVerifiedAt || adminPayoutVerifiedText || '');
            adminPayoutVerificationStatus = 'Verified payout in admin log at ' + adminPayoutVerifiedAt;
            writeAdminPayoutBackToClaim(rec);
            saveSession();
            if (force) renderOverlay();
            return hit;
        }).catch(function () {
            adminPayoutVerificationStatus = 'Payout verification failed';
            saveSession();
            if (force) renderOverlay();
            return null;
        });
    }

    var _adminSetClaimStatusV290 = adminSetClaimStatus;
    adminSetClaimStatus = function (nextStatus) {
        var rec = getSelectedClaimRecord();
        if (rec && String(rec.completedLocked || '') === 'yes' && nextStatus !== 'Paid') {
            window.alert('This claim is locked as fully completed.');
            return;
        }
        if (String(claimStatus || '') === 'Paid' && nextStatus !== 'Paid') {
            window.alert('This claim is already marked Paid and locked.');
            return;
        }
        if (nextStatus !== 'Paid') return _adminSetClaimStatusV290(nextStatus);
        if (!isAdmin()) {
            window.alert('Admin login required.');
            return;
        }
        upsertCurrentClaimRecord();
        runAdminPayoutVerification(true).then(function (hit) {
            if (!hit) {
                window.alert('No matching payout found in admin logs yet. Send payout first, then verify again.');
                return;
            }
            var paidStamp = adminPayoutVerifiedAt || new Date().toLocaleString();
            var lockNote = 'Payout verified in admin log at ' + paidStamp;
            if (adminPayoutVerifiedText) lockNote += ' | ' + adminPayoutVerifiedText;
            decisionNote = decisionNote ? (decisionNote + ' | ' + lockNote) : lockNote;
            claimStatus = 'Paid';
            payoutAmount = payoutAmount || (getClaimPayoutRequirement(rec).text || '');
            addClaimHistoryEntry((sessionName || 'Admin') + ' marked claim ' + (claimId || 'unassigned') + ' paid after payout verification.' + (payoutAmount ? ' | Payout: ' + payoutAmount : ''));
            upsertCurrentClaimRecord();
            var items = getClaimsDbItems();
            var idx = items.findIndex(function (item) { return item && item.id === selectedClaimId; });
            if (idx >= 0) {
                items[idx].status = 'Paid';
                items[idx].paidAt = paidStamp;
                items[idx].completedLocked = 'yes';
                items[idx].adminPayoutVerifiedAt = adminPayoutVerifiedAt || paidStamp;
                items[idx].adminPayoutVerifiedText = adminPayoutVerifiedText || '';
                items[idx].adminPayoutVerificationStatus = adminPayoutVerificationStatus || 'Verified';
                saveClaimsDbItems(items);
            }
            saveSession();
            pushCurrentClaimToBackend();
            activeTab = 'claims';
            renderOverlay();
        });
    };

    var _renderOverlayV290 = renderOverlay;
    renderOverlay = function () {
        _renderOverlayV290();
        if (!overlay || !isAdmin()) return;
        var rec = getSelectedClaimRecord();
        var reviewPanel = overlay.querySelector('.si-7ds-admin-note-box');
        if (!reviewPanel || !rec || !rec.id) return;
        if (!overlay.querySelector('.si-7ds-admin-payout-box')) {
            var req = getClaimPayoutRequirement(rec);
            var block = ''
                + '<div class="si-7ds-card si-7ds-admin-payout-box">'
                +   '<div class="si-7ds-card-title">Admin Payout</div>'
                +   '<div class="si-7ds-text"><strong>Required payout:</strong> ' + esc((payoutAmount || req.text || 'Not set')) + '</div>'
                +   '<div class="si-7ds-text"><strong>Payout status:</strong> ' + esc(adminPayoutVerificationStatus || 'Idle') + '</div>'
                +   '<div class="si-7ds-text"><strong>Payout proof:</strong> ' + esc(adminPayoutVerifiedText || 'Waiting for admin log match') + '</div>'
                +   '<div class="si-7ds-plan-actions">'
                +     '<button type="button" class="si-7ds-btn alt" data-action="verify-admin-payout">Verify Admin Payout</button>'
                +   '</div>'
                + '</div>';
            var target = overlay.querySelector('.si-7ds-admin-receipt-box') || reviewPanel;
            target.insertAdjacentHTML('afterend', block);
        }
        overlay.querySelectorAll('[data-action="verify-admin-payout"]').forEach(function (btn) {
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', function () { runAdminPayoutVerification(true); });
        });

        if (String(claimStatus || '') === 'Paid' || String(rec.completedLocked || '') === 'yes') {
            ['#si-payout-amount', '#si-decision-note', '#si-claim-stack', '#si-claim-loss', '#si-claim-proof', '#si-claim-note'].forEach(function (sel) {
                var el = overlay.querySelector(sel);
                if (el) el.setAttribute('disabled', 'disabled');
            });
        }
    };

})();
