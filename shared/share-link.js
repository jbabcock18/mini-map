function encodeUtf8Base64Url(text) {
  const utf8Bytes = new TextEncoder().encode(text);
  let binary = "";
  utf8Bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeUtf8Base64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeSharePayload(payload) {
  return encodeUtf8Base64Url(JSON.stringify(payload));
}

export function decodeSharePayload(encodedPayload) {
  if (!encodedPayload || typeof encodedPayload !== "string") return null;
  try {
    const json = decodeUtf8Base64Url(encodedPayload);
    const payload = JSON.parse(json);
    return payload && typeof payload === "object" ? payload : null;
  } catch (error) {
    return null;
  }
}

export function parseSharePayloadFromSearch(searchString = window.location.search) {
  const params = new URLSearchParams(searchString || "");
  const encoded = params.get("p");
  if (!encoded) return null;
  return decodeSharePayload(encoded);
}

export function buildBuilderShareUrl(payload, builderPath = "/") {
  const encoded = encodeSharePayload(payload);
  const url = new URL(builderPath, window.location.origin);
  url.searchParams.set("p", encoded);
  return url.toString();
}
