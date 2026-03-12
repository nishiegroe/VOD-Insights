function createUpdaterConfig({ processObj }) {
  const updateCheckIntervalMs = 24 * 60 * 60 * 1000;
  const updateRequestTimeoutMs = 30000;
  const updateMaxRedirects = 5;

  const defaultUpdateFeedUrl = "https://server.nishiegroe.com/d/s/17O8FTJqXgRqxWSs5bvCoaBMjcfIUdSt/latest.json";
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
