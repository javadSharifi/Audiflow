// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetLinuxAssetAudioForTests,
  resolveScopedBlobAudioSrc,
  revokeActiveBlobSrc,
  toPlayableLinuxAudioSrc,
} from "../linuxAssetAudio";

const ASSET_URL = "asset://localhost/home/user/Music/song.mp3";

function stubDeps() {
  const blob = new Blob(["audio-bytes"], { type: "audio/mpeg" });
  const fetchImpl = vi.fn(async () =>
    new Response(blob, { status: 200, headers: { "Content-Type": "audio/mpeg" } }),
  );
  const created = ["blob:mock-uuid-1", "blob:mock-uuid-2"];
  let n = 0;
  const createUrl = vi.fn(() => created[n++] ?? `blob:mock-uuid-${n}`);
  const revokeUrl = vi.fn();
  return { blob, fetchImpl, createUrl, revokeUrl };
}

describe("Linux asset:// audio workaround (WebKitGTK custom-scheme media block)", () => {
  beforeEach(() => {
    __resetLinuxAssetAudioForTests();
  });

  it("fetches the asset bytes and hands the element a blob: URL", async () => {
    const { blob, fetchImpl, createUrl, revokeUrl } = stubDeps();
    const src = await toPlayableLinuxAudioSrc(ASSET_URL, fetchImpl, createUrl, revokeUrl);

    expect(fetchImpl).toHaveBeenCalledWith(ASSET_URL);
    expect(createUrl).toHaveBeenCalledWith(expect.any(Blob));
    expect(src).toBe("blob:mock-uuid-1");
    void blob;
  });

  it("revokes the previous blob URL when resolving the next track (no leak)", async () => {
    const { fetchImpl, createUrl, revokeUrl } = stubDeps();
    const first = await toPlayableLinuxAudioSrc(ASSET_URL, fetchImpl, createUrl, revokeUrl);
    const second = await toPlayableLinuxAudioSrc(ASSET_URL, fetchImpl, createUrl, revokeUrl);

    expect(first).toBe("blob:mock-uuid-1");
    expect(second).toBe("blob:mock-uuid-2");
    expect(revokeUrl).toHaveBeenCalledWith("blob:mock-uuid-1");
  });

  it("falls back to the asset URL when fetch fails (error path unchanged)", async () => {
    const { createUrl, revokeUrl } = stubDeps();
    const failingFetch = vi.fn(async () => {
      throw new Error("scheme unreachable");
    });
    const src = await toPlayableLinuxAudioSrc(ASSET_URL, failingFetch, createUrl, revokeUrl);

    expect(src).toBe(ASSET_URL);
    expect(createUrl).not.toHaveBeenCalled();
  });

  it("falls back to the asset URL on non-OK responses", async () => {
    const { createUrl, revokeUrl } = stubDeps();
    const notFound = vi.fn(async () => new Response("nope", { status: 404 }));
    const src = await toPlayableLinuxAudioSrc(ASSET_URL, notFound, createUrl, revokeUrl);

    expect(src).toBe(ASSET_URL);
    expect(createUrl).not.toHaveBeenCalled();
  });

  it("revokeActiveBlobSrc drops the live URL without touching anything else", async () => {
    const { fetchImpl, createUrl, revokeUrl } = stubDeps();
    await toPlayableLinuxAudioSrc(ASSET_URL, fetchImpl, createUrl, revokeUrl);
    revokeActiveBlobSrc(revokeUrl);
    expect(revokeUrl).toHaveBeenCalledWith("blob:mock-uuid-1");
    revokeActiveBlobSrc(revokeUrl);
    expect(revokeUrl).toHaveBeenCalledTimes(1);
  });
});

describe("Scoped blob handles (preview/audition elements)", () => {
  it("returns an owned handle with a blob: URL", async () => {
    const { fetchImpl, createUrl, revokeUrl } = stubDeps();
    const handle = await resolveScopedBlobAudioSrc(ASSET_URL, fetchImpl, createUrl, revokeUrl);

    expect(handle?.url).toBe("blob:mock-uuid-1");
    expect(fetchImpl).toHaveBeenCalledWith(ASSET_URL);
  });

  it("revokes exactly once and never touches the player singleton slot", async () => {
    const { fetchImpl, createUrl, revokeUrl } = stubDeps();
    const handle = await resolveScopedBlobAudioSrc(ASSET_URL, fetchImpl, createUrl, revokeUrl);
    // Player singleton untouched while a preview handle is alive.
    expect(revokeUrl).not.toHaveBeenCalled();

    handle?.revoke();
    expect(revokeUrl).toHaveBeenCalledWith("blob:mock-uuid-1");
    handle?.revoke();
    expect(revokeUrl).toHaveBeenCalledTimes(1);
  });

  it("two handles are independent (revoking one leaves the other)", async () => {
    const { fetchImpl, createUrl, revokeUrl } = stubDeps();
    const first = await resolveScopedBlobAudioSrc(ASSET_URL, fetchImpl, createUrl, revokeUrl);
    const second = await resolveScopedBlobAudioSrc(ASSET_URL, fetchImpl, createUrl, revokeUrl);

    first?.revoke();
    expect(revokeUrl).toHaveBeenCalledWith("blob:mock-uuid-1");
    expect(revokeUrl).not.toHaveBeenCalledWith("blob:mock-uuid-2");
    expect(second?.url).toBe("blob:mock-uuid-2");
  });

  it("returns null on fetch failure so the caller falls back to asset://", async () => {
    const { createUrl, revokeUrl } = stubDeps();
    const failingFetch = vi.fn(async () => {
      throw new Error("scheme unreachable");
    });
    const handle = await resolveScopedBlobAudioSrc(ASSET_URL, failingFetch, createUrl, revokeUrl);

    expect(handle).toBeNull();
    expect(createUrl).not.toHaveBeenCalled();
  });

  it("returns null on non-OK responses", async () => {
    const { createUrl, revokeUrl } = stubDeps();
    const notFound = vi.fn(async () => new Response("nope", { status: 404 }));
    const handle = await resolveScopedBlobAudioSrc(ASSET_URL, notFound, createUrl, revokeUrl);

    expect(handle).toBeNull();
    expect(createUrl).not.toHaveBeenCalled();
  });
});
