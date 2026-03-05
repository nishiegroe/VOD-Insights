function createBackendApiClient({ host, port, timeoutMs }) {
  function httpRequest(options, callback) {
    return require("http").request(options, callback);
  }

  function requestApiJson(method, pathName, payload = null, requestTimeoutMs = timeoutMs) {
    return new Promise((resolve, reject) => {
      const body = payload ? JSON.stringify(payload) : null;
      const req = httpRequest(
        {
          host,
          port,
          path: pathName,
          method,
          headers: body
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body),
              }
            : undefined,
        },
        (res) => {
          const { statusCode = 0 } = res;
          let raw = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => {
            raw += chunk;
          });
          res.on("end", () => {
            if (statusCode < 200 || statusCode >= 300) {
              reject(new Error(`Request ${pathName} failed with status ${statusCode}.`));
              return;
            }
            try {
              resolve(JSON.parse(raw || "{}"));
            } catch (error) {
              reject(new Error(`Invalid JSON response from ${pathName}.`));
            }
          });
        }
      );

      req.setTimeout(requestTimeoutMs, () => {
        req.destroy(new Error(`Request timed out: ${pathName}`));
      });
      req.on("error", (error) => reject(error));
      if (body) {
        req.write(body);
      }
      req.end();
    });
  }

  return {
    requestApiJson,
  };
}

module.exports = {
  createBackendApiClient,
};
