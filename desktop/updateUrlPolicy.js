const ALLOWED_UPDATE_HOSTS = new Set(["github.com", "objects.githubusercontent.com"]);
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

function isLoopbackHost(hostname) {
  const normalized = String(hostname || "").trim().toLowerCase();
  return LOOPBACK_HOSTS.has(normalized);
}

function resolveBackendOrigin({ protocol = "http:", host, port }) {
  const normalizedProtocol = String(protocol || "").trim().toLowerCase();
  if (normalizedProtocol !== "http:" && normalizedProtocol !== "https:") {
    return null;
  }

  const normalizedHost = String(host || "").trim().toLowerCase();
  if (!normalizedHost) {
    return null;
  }

  const normalizedPort = Number.parseInt(String(port), 10);
  if (!Number.isInteger(normalizedPort) || normalizedPort < 1 || normalizedPort > 65535) {
    return null;
  }

  try {
    return new URL(`${normalizedProtocol}//${normalizedHost}:${normalizedPort}`).origin;
  } catch (error) {
    return null;
  }
}

function shouldInjectApiTokenHeader(requestUrl, backendOrigin, initiatorUrl, referrerUrl) {
  if (!backendOrigin) {
    return false;
  }

  let request;
  let backend;
  try {
    request = new URL(String(requestUrl || ""));
    backend = new URL(String(backendOrigin));
  } catch (error) {
    return false;
  }

  if (!isLoopbackHost(backend.hostname)) {
    return false;
  }

  const sameBackendTarget = (
    request.protocol === backend.protocol
    && request.hostname === backend.hostname
    && request.port === backend.port
  );
  if (!sameBackendTarget) {
    return false;
  }

  const matchesBackendOrigin = (candidate) => {
    if (!candidate) {
      return false;
    }
    try {
      const parsed = new URL(String(candidate));
      return parsed.origin === backend.origin;
    } catch (error) {
      return false;
    }
  };

  return matchesBackendOrigin(initiatorUrl) || matchesBackendOrigin(referrerUrl);
}

function isAllowedUpdateHost(hostname) {
  const normalizedHost = String(hostname || "").trim().toLowerCase();
  if (!normalizedHost) {
    return false;
  }
  return ALLOWED_UPDATE_HOSTS.has(normalizedHost) || normalizedHost.endsWith(".githubusercontent.com");
}

function validateInstallerDownloadUrl(urlString) {
  let parsed;
  try {
    parsed = new URL(String(urlString || ""));
  } catch (error) {
    throw new Error("Installer URL is invalid.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Installer URL must use HTTPS.");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!isAllowedUpdateHost(hostname)) {
    throw new Error("Installer URL host is not allowed.");
  }

  return parsed;
}

module.exports = {
  resolveBackendOrigin,
  shouldInjectApiTokenHeader,
  isLoopbackHost,
  isAllowedUpdateHost,
  validateInstallerDownloadUrl
};
