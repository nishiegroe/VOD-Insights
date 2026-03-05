function createUpdaterConfig({ processObj }) {
  const updateCheckIntervalMs = 24 * 60 * 60 * 1000;
  const updateRequestTimeoutMs = 30000;
  const updateMaxRedirects = 5;

  const updateRepoOwner = processObj.env.AET_UPDATE_REPO_OWNER || "nishiegroe";
  const updateRepoName = processObj.env.AET_UPDATE_REPO_NAME || "VOD-Insights";
  const defaultUpdateFeedUrl = `https://github.com/${updateRepoOwner}/${updateRepoName}/releases/latest/download/latest.json`;
  const updateFeedUrl = processObj.env.AET_UPDATE_FEED_URL || defaultUpdateFeedUrl;

  return {
    updateCheckIntervalMs,
    updateRequestTimeoutMs,
    updateMaxRedirects,
    updateFeedUrl,
  };
}

module.exports = {
  createUpdaterConfig,
};
