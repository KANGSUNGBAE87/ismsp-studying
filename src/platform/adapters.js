const STORAGE_PREFIX = "ismsp-study:";

export function createBrowserPlatform() {
  return {
    storage: {
      get(key, fallback = null) {
        try {
          const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${key}`);
          return raw === null ? fallback : JSON.parse(raw);
        } catch {
          return fallback;
        }
      },
      set(key, value) {
        try {
          window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
        } catch {
          // Local storage may be unavailable in private or embedded contexts.
        }
      },
    },
    haptics: {
      impact() {
        if ("vibrate" in navigator) navigator.vibrate(10);
      },
    },
    locale: {
      defaultLocale() {
        return "ko";
      },
    },
  };
}

// Ads adapter. Keeps Apps in Toss / Google Play SDK calls out of product logic.
// Reward semantics follow the global rule learned from the rewarded-ad bugfix:
// - reward completion is granted ONLY on the `userEarnedReward` event
//   (never on close/dismiss/network packets),
// - `dismissed` waits a short grace window because userEarnedReward can arrive late,
// - the caller persists the unlock by id so reopening does not re-lock it.
const REWARD_GRACE_MS = 500;

export function createAdsAdapter(options = {}) {
  const bridge = options.bridge ?? (typeof globalThis !== "undefined" ? globalThis.AppsInToss : null);

  function showFullScreen(placementId, { rewarded }) {
    // Real Apps in Toss path.
    if (bridge && typeof bridge.showFullScreenAd === "function") {
      return new Promise((resolve) => {
        let earned = false;
        let settled = false;
        const finish = (value) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };
        try {
          bridge.showFullScreenAd({
            adGroupId: placementId,
            onEvent: (event) => {
              const type = event?.type ?? event?.event;
              if (type === "userEarnedReward" || event?.rewarded === true) {
                earned = true; // reward is confirmed here and ONLY here
              } else if (type === "dismissed" || type === "closed") {
                // grace window: userEarnedReward may still be in flight
                setTimeout(() => finish({ rewarded: rewarded ? earned : false, dismissed: true }), REWARD_GRACE_MS);
              } else if (type === "error" || type === "failed" || type === "loadFailed") {
                finish({ rewarded: false, error: true });
              }
            },
          });
        } catch {
          finish({ rewarded: false, error: true });
        }
      });
    }

    // Web / static-preview stub: no SDK available. Simulate a watch so the flow
    // is testable. A cancel = no reward (mirrors not finishing the ad).
    const canConfirm = typeof window !== "undefined" && typeof window.confirm === "function";
    const watched = rewarded
      ? (canConfirm ? window.confirm(options.stubRewardPrompt ?? "[광고 시뮬레이션] 리워드 광고를 끝까지 시청하시겠습니까?\n확인 = 시청 완료(보상 지급), 취소 = 미시청") : true)
      : (canConfirm ? (window.confirm(options.stubInterstitialPrompt ?? "[광고 시뮬레이션] 전면 광고"), true) : true);
    return Promise.resolve({ rewarded: rewarded ? Boolean(watched) : false, dismissed: true, stub: true });
  }

  return {
    isAvailable() {
      return Boolean(bridge);
    },
    // Banner is a fixed-area placement; web stub just reports support so the UI
    // can render a reserved slot. Real banner is mounted by the host shell.
    bannerSupported() {
      return true;
    },
    async showRewarded(placementId) {
      return showFullScreen(placementId, { rewarded: true });
    },
    async showInterstitial(placementId) {
      await showFullScreen(placementId, { rewarded: false });
    },
  };
}
