import electron from "electron";
import { URL } from "node:url";

// To not cause duplicates because headers aren't really case sensitive, we delete all of the headers that match
function deleteHeader(responseHeaders: Record<string, string[]>, header: string) {
  const headerToDelete = header.toLowerCase();

  for (const header in responseHeaders) {
    if (Object.prototype.hasOwnProperty.call(responseHeaders, header)) {
      if (!header.toLowerCase().startsWith(headerToDelete)) continue;
      delete responseHeaders[header];
    };
  };
};

const DISCORD_HOST = /^(ptb\.|canary\.|)discord.com$/;
function isWebhookURL(url: URL) {
  if (!DISCORD_HOST.test(url.host)) return false;
  if (url.pathname.startsWith("/api/webhook")) return true;
  return false;
};

electron.app.whenReady().then(() => {
  electron.session.defaultSession.webRequest.onHeadersReceived(function({ responseHeaders, url: requestedURL, resourceType }, callback) {
    const url = new URL(requestedURL);

    if (responseHeaders) {
      deleteHeader(responseHeaders, "content-security-policy");

      const vxCors = url.searchParams.get("vx-cors");
      if (vxCors === "true") {
        deleteHeader(responseHeaders, "content-security-policy");
        responseHeaders["Access-Control-Allow-Origin"] = [ "*" ];
      };

      if (resourceType === "stylesheet") {
        deleteHeader(responseHeaders, "content-type");
        responseHeaders["Content-Type"] = [ "text/css" ];
      };
    };

    callback({ 
      cancel: isWebhookURL(url), 
      responseHeaders
    });
  });
});