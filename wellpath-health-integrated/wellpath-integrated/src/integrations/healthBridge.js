const requestedReadTypes = [
  'steps',
  'sleep',
  'restingHeartRate',
  'exerciseMinutes',
  'activeEnergy',
];

function nativeBridge() {
  return window.WellPathHealth || window.webkit?.messageHandlers?.wellPathHealth || null;
}

function platformFromRuntime() {
  const capacitorPlatform = window.Capacitor?.getPlatform?.() || 'web';
  if (capacitorPlatform === 'ios' || capacitorPlatform === 'android') return capacitorPlatform;
  const agent = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(agent)) return 'ios';
  if (/Android/i.test(agent)) return 'android';
  return 'web';
}

export function getHealthBridgeStatus() {
  const platform = platformFromRuntime();
  const bridge = nativeBridge();
  return {
    platform,
    available: Boolean(bridge),
    provider: platform === 'ios' ? 'apple_health' : platform === 'android' ? 'health_connect' : null,
    requestedReadTypes,
  };
}

async function callBridge(action, payload = {}) {
  const bridge = nativeBridge();
  if (!bridge) {
    return {
      ok: false,
      status: 'unavailable',
      message: 'Health data access is available only inside the installed iOS or Android app.',
    };
  }

  if (typeof bridge[action] === 'function') return bridge[action](payload);

  if (typeof bridge.postMessage === 'function') {
    bridge.postMessage({ action, payload });
    return { ok: true, status: 'requested' };
  }

  return { ok: false, status: 'unavailable', message: 'The installed app does not expose this health action yet.' };
}

export function requestHealthPermissions() {
  return callBridge('requestPermissions', { read: requestedReadTypes, write: [] });
}

export function syncHealthData() {
  return callBridge('sync', { read: requestedReadTypes, days: 30 });
}

export function openHealthPermissionSettings() {
  return callBridge('openPermissionSettings');
}

export { requestedReadTypes };
