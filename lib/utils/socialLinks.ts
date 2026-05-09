// Port of adler-website/lib/utils/socialLinks.ts. The handle-validation
// logic must stay identical so a profile written from one client passes
// `isSameSocialLink` checks on the other.

import type { SocialLink, SocialPlatform } from "@/lib/types/profile";

export const SOCIAL_PLATFORMS: readonly SocialPlatform[] = [
  "instagram",
  "youtube",
  "tiktok",
  "twitter",
] as const;

export const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  twitter: "X / Twitter",
};

const PLATFORM_DOMAINS: Record<SocialPlatform, readonly string[]> = {
  instagram: ["instagram.com"],
  youtube: ["youtube.com", "youtu.be", "m.youtube.com"],
  tiktok: ["tiktok.com", "vm.tiktok.com", "vt.tiktok.com"],
  twitter: ["twitter.com", "x.com", "mobile.twitter.com"],
};

const PLATFORM_HANDLE_PATTERN: Record<SocialPlatform, RegExp> = {
  instagram: /^[A-Za-z0-9._]{1,30}$/,
  youtube: /^[A-Za-z0-9._-]{3,30}$/,
  tiktok: /^[A-Za-z0-9._]{2,24}$/,
  twitter: /^[A-Za-z0-9_]{1,15}$/,
};

export interface NormalizedHandle {
  ok: true;
  handle: string;
}
export interface InvalidHandle {
  ok: false;
  error: string;
}

export function normalizeSocialHandle(
  raw: string,
  platform: SocialPlatform,
): NormalizedHandle | InvalidHandle {
  let candidate = raw.trim();
  if (!candidate) return { ok: false, error: "Handle is required" };

  if (candidate.includes("/") || /^https?:/i.test(candidate)) {
    try {
      const url = new URL(
        /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`,
      );
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      const allowed = PLATFORM_DOMAINS[platform];
      if (!allowed.includes(host)) {
        return {
          ok: false,
          error: `That's not a ${PLATFORM_LABEL[platform]} URL`,
        };
      }
      const segments = url.pathname.split("/").filter(Boolean);
      if (platform === "youtube") {
        const at = segments.find((s) => s.startsWith("@"));
        if (!at) {
          return { ok: false, error: "Use the channel's @handle URL" };
        }
        candidate = at.slice(1);
      } else if (platform === "tiktok") {
        const at = segments.find((s) => s.startsWith("@"));
        if (!at) {
          return { ok: false, error: "Couldn't find a handle in that URL" };
        }
        candidate = at.slice(1);
      } else {
        candidate = segments[0] ?? "";
      }
      if (!candidate) {
        return { ok: false, error: "Couldn't find a handle in that URL" };
      }
    } catch {
      return { ok: false, error: "Invalid URL" };
    }
  }

  if (candidate.startsWith("@")) candidate = candidate.slice(1);

  if (!PLATFORM_HANDLE_PATTERN[platform].test(candidate)) {
    return { ok: false, error: `Not a valid ${PLATFORM_LABEL[platform]} handle` };
  }

  return { ok: true, handle: candidate };
}

export interface DetectedSocialLink {
  ok: true;
  platform: SocialPlatform;
  handle: string;
}

export function detectAndNormalizeSocialLink(
  raw: string,
): DetectedSocialLink | InvalidHandle {
  const candidate = raw.trim();
  if (!candidate) return { ok: false, error: "Paste a link" };

  let url: URL;
  try {
    url = new URL(
      /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`,
    );
  } catch {
    return {
      ok: false,
      error: "Paste a full URL from Instagram, YouTube, TikTok, or X",
    };
  }

  if (!url.hostname.includes(".")) {
    return {
      ok: false,
      error: "Paste a full URL from Instagram, YouTube, TikTok, or X",
    };
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const detected = SOCIAL_PLATFORMS.find((p) =>
    PLATFORM_DOMAINS[p].includes(host),
  );
  if (!detected) {
    return {
      ok: false,
      error: "Only Instagram, YouTube, TikTok, and X links are supported",
    };
  }

  const result = normalizeSocialHandle(raw, detected);
  if (!result.ok) return result;
  return { ok: true, platform: detected, handle: result.handle };
}

/**
 * Two links are "the same account" iff they share a platform AND a
 * case-insensitive handle. Pure helper — call sites should guard their
 * "add" interactions.
 */
export function isSameSocialLink(a: SocialLink, b: SocialLink): boolean {
  return (
    a.platform === b.platform &&
    a.handle.toLowerCase() === b.handle.toLowerCase()
  );
}

export function socialLinkUrl(link: SocialLink): string {
  switch (link.platform) {
    case "instagram":
      return `https://instagram.com/${link.handle}`;
    case "youtube":
      return `https://youtube.com/@${link.handle}`;
    case "tiktok":
      return `https://tiktok.com/@${link.handle}`;
    case "twitter":
      return `https://x.com/${link.handle}`;
  }
}
