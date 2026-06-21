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
// Real ads use @apps-in-toss/web-framework:
//   showFullScreenAd({ options:{adGroupId}, onEvent, onError })  // interstitial + rewarded
//   TossAds.initialize() + TossAds.attachBanner(adGroupId, target, opts)  // banner
// Reward semantics follow the global rewarded-ad rule:
// - reward is granted ONLY on the `userEarnedReward` event (never close/dismiss),
// - `dismissed` waits a short grace window (userEarnedReward can arrive late),
// - the caller persists the unlock by id so reopening does not re-lock it.
const REWARD_GRACE_MS = 500;

// Loaded only when bundled by `ait build`. In the plain static/web preview the
// bare specifier fails to resolve, so we fall back to a confirm()-based stub.
let aitModulePromise;
function loadAitModule(override) {
  if (override !== undefined) return Promise.resolve(override);
  if (!aitModulePromise) {
    aitModulePromise = import("@apps-in-toss/web-framework").catch(() => null);
  }
  return aitModulePromise;
}

export function createAdsAdapter(options = {}) {
  const getModule = () => loadAitModule(options.module);

  async function showFullScreen(placementId, { rewarded }) {
    const sdk = await getModule();
    if (sdk && typeof sdk.showFullScreenAd === "function") {
      return new Promise((resolve) => {
        let earned = false;
        let settled = false;
        const finish = (value) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };
        try {
          sdk.showFullScreenAd({
            options: { adGroupId: placementId },
            onEvent: (event) => {
              if (event?.type === "userEarnedReward") {
                earned = true; // reward confirmed here and ONLY here
              } else if (event?.type === "dismissed" || event?.type === "closed") {
                // grace window: userEarnedReward may still be in flight
                setTimeout(() => finish({ rewarded: rewarded ? earned : false, dismissed: true }), REWARD_GRACE_MS);
              }
            },
            onError: () => finish({ rewarded: false, error: true }),
          });
        } catch {
          finish({ rewarded: false, error: true });
        }
      });
    }

    // Web / static-preview stub: simulate a watch so the flow is testable.
    const canConfirm = typeof window !== "undefined" && typeof window.confirm === "function";
    const watched = rewarded
      ? (canConfirm ? window.confirm(options.stubRewardPrompt ?? "[광고 시뮬레이션] 리워드 광고를 끝까지 시청하시겠습니까?\n확인 = 시청 완료(보상 지급), 취소 = 미시청") : true)
      : true;
    return { rewarded: rewarded ? Boolean(watched) : false, dismissed: true, stub: true };
  }

  return {
    async isAvailable() {
      return Boolean(await getModule());
    },
    bannerSupported() {
      return true;
    },
    async showRewarded(placementId) {
      return showFullScreen(placementId, { rewarded: true });
    },
    async showInterstitial(placementId) {
      await showFullScreen(placementId, { rewarded: false });
    },
    // Real Apps in Toss banner via TossAds; returns null in the web stub so the
    // app shell can render its own placeholder slot instead.
    async mountBanner(placementId, target) {
      const sdk = await getModule();
      if (sdk && sdk.TossAds && typeof sdk.TossAds.attachBanner === "function") {
        try {
          sdk.TossAds.initialize();
          return sdk.TossAds.attachBanner(placementId, target, {
            theme: "auto",
            tone: "blackAndWhite",
            variant: "expanded",
          });
        } catch {
          return null;
        }
      }
      return null;
    },
  };
}
