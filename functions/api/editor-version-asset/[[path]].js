import {
  normalizeVersionPath,
  versionBucket,
  versionPrefix
} from "../../_lib/editor-versions.js";
import {
  isSafeVersionAssetPath,
  verifyVersionPreviewSignature
} from "../../_lib/editor-version-preview.js";

function unavailable() {
  return new Response("No encontrado.", {
    status: 404,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer"
    }
  });
}

export async function onRequestGet(context) {
  try {
    const parts = (context.params.path || []).map(value => String(value));
    const [projectId, versionId, ...assetParts] = parts;
    const assetPath = assetParts.join("/");
    const url = new URL(context.request.url);

    if (
      !projectId ||
      !versionId ||
      !isSafeVersionAssetPath(assetPath)
    ) {
      return unavailable();
    }

    const valid = await verifyVersionPreviewSignature({
      env: context.env,
      projectId,
      versionId,
      assetPath,
      expiresAt: url.searchParams.get("expires"),
      providedSignature: url.searchParams.get("signature")
    });

    if (!valid) return unavailable();

    const key = `${versionPrefix(projectId, versionId)}/files/${normalizeVersionPath(assetPath)}`;
    const object = await versionBucket(context.env).get(key);

    if (!object) return unavailable();

    return new Response(await object.arrayBuffer(), {
      headers: {
        "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    console.error("editor version asset", error);
    return unavailable();
  }
}
