import type { Screenshot } from './capture.js';

export interface SharePayload {
  /** Short title shown by the share sheet (native). */
  title?: string;
  /** Message body (web fallback = clipboard, some native sheets show it). */
  message?: string;
  /** URL to share. */
  url?: string;
  /** Optional screenshot to share as an image attachment. */
  screenshot?: Screenshot;
}

export interface ShareResult {
  /** Whether the share action was kicked off successfully. */
  dispatched: boolean;
  /** Name of the transport that handled the request. */
  via: 'web-share' | 'web-clipboard' | 'native' | 'noop';
}

/**
 * Platform adapter that knows how to hand a payload to the OS share sheet.
 * The host app picks an adapter based on its runtime (web vs iOS/Android).
 */
export interface ShareTransport {
  readonly name: ShareResult['via'];
  canShare(payload: SharePayload): boolean;
  share(payload: SharePayload): Promise<ShareResult>;
}

// ---------- Web Share API adapter -----------------------------------------

interface WebNavigatorLike {
  share?(data: { title?: string; text?: string; url?: string; files?: File[] }): Promise<void>;
  canShare?(data: { files?: File[] }): boolean;
  clipboard?: {
    writeText(text: string): Promise<void>;
  };
}

interface FileCtorLike {
  new (parts: BlobPart[], name: string, options?: { type?: string }): File;
}

export function createWebShareTransport(
  nav: WebNavigatorLike,
  fileCtor?: FileCtorLike,
): ShareTransport {
  return {
    name: 'web-share',
    canShare(payload) {
      if (!nav.share) return false;
      if (!payload.screenshot) return true;
      if (!fileCtor || !nav.canShare) return false;
      try {
        const f = new fileCtor(
          [payload.screenshot.bytes as unknown as BlobPart],
          'screenshot.png',
          {
            type: `image/${payload.screenshot.format}`,
          },
        );
        return nav.canShare({ files: [f] });
      } catch {
        return false;
      }
    },
    async share(payload) {
      if (!nav.share) return { dispatched: false, via: 'web-share' };
      const data: { title?: string; text?: string; url?: string; files?: File[] } = {};
      if (payload.title !== undefined) data.title = payload.title;
      if (payload.message !== undefined) data.text = payload.message;
      if (payload.url !== undefined) data.url = payload.url;
      if (payload.screenshot && fileCtor) {
        const file = new fileCtor(
          [payload.screenshot.bytes as unknown as BlobPart],
          `screenshot.${payload.screenshot.format}`,
          { type: `image/${payload.screenshot.format}` },
        );
        data.files = [file];
      }
      await nav.share(data);
      return { dispatched: true, via: 'web-share' };
    },
  };
}

export function createWebClipboardTransport(nav: WebNavigatorLike): ShareTransport {
  return {
    name: 'web-clipboard',
    canShare(payload) {
      return Boolean(nav.clipboard && (payload.url ?? payload.message));
    },
    async share(payload) {
      if (!nav.clipboard) return { dispatched: false, via: 'web-clipboard' };
      const text = [payload.message, payload.url].filter((s): s is string => Boolean(s)).join(' ');
      if (text.length === 0) return { dispatched: false, via: 'web-clipboard' };
      await nav.clipboard.writeText(text);
      return { dispatched: true, via: 'web-clipboard' };
    },
  };
}

// ---------- Native (RN Share / expo-sharing-shaped) adapter ---------------

export interface NativeShareLike {
  share(content: { title?: string; message?: string; url?: string }): Promise<{ action?: string }>;
}

export interface ExpoSharingLike {
  isAvailableAsync(): Promise<boolean>;
  shareAsync(uri: string, options?: { dialogTitle?: string; mimeType?: string }): Promise<void>;
}

export function createNativeShareTransport(rnShare: NativeShareLike): ShareTransport {
  return {
    name: 'native',
    canShare() {
      return true;
    },
    async share(payload) {
      const content: { title?: string; message?: string; url?: string } = {};
      if (payload.title !== undefined) content.title = payload.title;
      if (payload.message !== undefined) content.message = payload.message;
      if (payload.url !== undefined) content.url = payload.url;
      const res = await rnShare.share(content);
      return { dispatched: res.action !== 'dismissed', via: 'native' };
    },
  };
}

// ---------- Manager -------------------------------------------------------

export class ShareManager {
  private transports: ShareTransport[] = [];

  register(t: ShareTransport): this {
    this.transports.push(t);
    return this;
  }

  async share(payload: SharePayload): Promise<ShareResult> {
    for (const t of this.transports) {
      if (t.canShare(payload)) return t.share(payload);
    }
    return { dispatched: false, via: 'noop' };
  }
}
