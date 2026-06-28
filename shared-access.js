const AT_SESSION_KEY = 'activityTrackerSession';
const AT_LOCAL_USER_KEY = 'actTracker_v5_user';
const AT_DEFAULT_BUFFER_SEC = 5 * 60;

function atSan(value) {
  return String(value || '').replace(/[.#$[\]/\s]/g, '_');
}

function atUser() {
  try {
    return JSON.parse(sessionStorage.getItem(AT_SESSION_KEY) || localStorage.getItem(AT_SESSION_KEY) || 'null');
  } catch (e) {
    return null;
  }
}

function atSetUser(user) {
  sessionStorage.setItem(AT_SESSION_KEY, JSON.stringify(user));
  localStorage.setItem(AT_SESSION_KEY, JSON.stringify(user));
}

function atClearUser() {
  sessionStorage.removeItem(AT_SESSION_KEY);
  localStorage.removeItem(AT_SESSION_KEY);
  localStorage.removeItem(AT_LOCAL_USER_KEY);
}

function atRequire(allowedRoles, allowedTeams) {
  const user = atUser();
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  const teams = allowedTeams ? (Array.isArray(allowedTeams) ? allowedTeams : [allowedTeams]) : null;
  const okRole = user && roles.includes(user.role);
  const okTeam = !teams || teams.includes(user.team);
  if (!okRole || !okTeam) {
    window.location.href = 'index.html';
    return null;
  }
  return user;
}

function atLogout() {
  atClearUser();
  if (window.firebase && firebase.auth) {
    firebase.auth().signOut().finally(() => { window.location.href = 'index.html'; });
  } else {
    window.location.href = 'index.html';
  }
}

function atLoadApprovalSettings(db, team, onChange) {
  db.ref(team + '/settings/approval').on('value', snap => {
    const val = snap.val() || {};
    onChange({
      enabled: val.enabled !== false,
      bufferSec: Number(val.bufferMinutes || 5) * 60
    });
  });
}

function atTaskStatus(log, elapsedSec, settings) {
  const bufferSec = settings && settings.bufferSec ? settings.bufferSec : AT_DEFAULT_BUFFER_SEC;
  const enabled = !settings || settings.enabled !== false;
  const baseSec = Number(log.ahtTarget || log.slaSec || 0);
  const effectiveSec = baseSec + bufferSec;
  const elapsed = Number(elapsedSec || log.totalTimeSec || 0);
  const breached = baseSec > 0 && elapsed > effectiveSec;
  if (log.approvalStatus === 'approved') return { text: 'Approved', cls: 'sg', breached, effectiveSec };
  if (log.approvalStatus === 'rejected') return { text: 'Rejected', cls: 'sr', breached, effectiveSec };
  if (enabled && breached) return { text: 'Pending Lead Approval', cls: 'sr', breached, effectiveSec, pending: true };
  if (breached) return { text: 'SLA Breached', cls: 'sr', breached, effectiveSec };
  if (baseSec > 0 && elapsed > baseSec) return { text: 'Within Buffer', cls: 'sw', breached: false, effectiveSec };
  return { text: 'Within SLA', cls: 'sg', breached: false, effectiveSec };
}

function atApprovalPayload(user, status) {
  return {
    approvalStatus: status,
    requiresLeadApproval: false,
    approvedBy: user && user.name ? user.name : 'Lead',
    approvedRole: user && user.role ? user.role : 'lead',
    approvedAt: Date.now()
  };
}
