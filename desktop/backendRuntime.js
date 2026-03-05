function createBackendRuntime({ backendSupervisor }) {
  function startBackend() {
    backendSupervisor.startBackend();
  }

  function waitForPort(host, port, timeoutMs = 120000, intervalMs = 500) {
    return backendSupervisor.waitForPort(host, port, timeoutMs, intervalMs);
  }

  function stopBackend() {
    return backendSupervisor.stopBackend();
  }

  return {
    startBackend,
    waitForPort,
    stopBackend,
  };
}

module.exports = {
  createBackendRuntime,
};
