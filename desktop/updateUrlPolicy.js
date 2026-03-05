const ALLOWED_UPDATE_HOSTS = new Set(["github.com", "objects.githubusercontent.com"]);

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
  isAllowedUpdateHost,
  validateInstallerDownloadUrl
};