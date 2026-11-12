import type { Screenshot } from './capture.js';

export interface SharePayload {
  /** Short title shown by the share sheet (native). */
  title?: string;
  /** Message body (web fallback = clipboard, some native sheets show it). */
  message?: string;
  /** URL to share. */
  url?: string;
  /**
   * Optional screenshot to share as an image attachment. Web attaches it as a `File`; native
   * attaches it on iOS only, and only when `url` is unset (see `createNativeShareTransport`).
   */
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

export interface WebNavigatorLike {
  share?(data: { title?: string; text?: string; url?: string; files?: File[] }): Promise<void>;
  canShare?(data: { files?: File[] }): boolean;
  clipboard?: {
    writeText(text: string): Promise<void>;
  };
}

export interface FileCtorLike {
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
          `screenshot.${payload.screenshot.format}`,
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

/**
 * Wraps an RN `Share`-shaped module. When `url` is unset, a `screenshot` goes out as a
 * `data:image/<format>;base64,…` URL, which iOS's share sheet attaches as the image; an explicit
 * `url` takes precedence and no image is attached then. Android's RN `Share` forwards only
 * `title` and `message`, so there neither `url` nor the screenshot reaches the sheet: a payload
 * with a screenshot and no `message` opens an empty sheet and still reports `dispatched: true`.
 */
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
      else if (payload.screenshot !== undefined) {
        const { format, base64 } = payload.screenshot;
        content.url = `data:image/${format};base64,${base64}`;
      }
      const res = await rnShare.share(content);
      // RN Share resolves to Share.sharedAction ('sharedAction') or
      // Share.dismissedAction ('dismissedAction') — never a bare 'dismissed'.
      return { dispatched: res.action === 'sharedAction', via: 'native' };
    },
  };
}

/**
 * Writes base64 image data to a file the OS share sheet can read and resolves to its URI. The app
 * supplies it (typically over `expo-file-system`'s cache directory); see the package README.
 */
export interface ShareFileWriterLike {
  writeBase64File(name: string, base64: string): Promise<string>;
}

/**
 * Shares a `screenshot` as an image file through an `expo-sharing`-shaped module, which is how
 * an image reaches the Android share sheet. `canShare` is true only for a payload with a
 * screenshot, so register it before `createNativeShareTransport` and text-only payloads fall
 * through. The file is shared alone: `message` and `url` are dropped, and `title` becomes the
 * `dialogTitle`. `shareAsync` does not report whether the user completed the share, so
 * `dispatched: true` means the sheet was opened; it is `false` when `isAvailableAsync()` resolves
 * false. Writer and `shareAsync` rejections propagate.
 */
export function createExpoShareTransport(
  sharing: ExpoSharingLike,
  files: ShareFileWriterLike,
): ShareTransport {
  return {
    name: 'native',
    canShare(payload) {
      return payload.screenshot !== undefined;
    },
    async share(payload) {
      const shot = payload.screenshot;
      if (shot === undefined) return { dispatched: false, via: 'native' };
      if (!(await sharing.isAvailableAsync())) return { dispatched: false, via: 'native' };
      const uri = await files.writeBase64File(`screenshot.${shot.format}`, shot.base64);
      const options: { dialogTitle?: string; mimeType?: string } = {
        mimeType: `image/${shot.format}`,
      };
      if (payload.title !== undefined) options.dialogTitle = payload.title;
      await sharing.shareAsync(uri, options);
      return { dispatched: true, via: 'native' };
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
