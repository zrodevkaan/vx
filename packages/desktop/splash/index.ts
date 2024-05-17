import electron from "electron";
import { createStyle, waitForNode } from "common/dom";
import { logger } from "vx:logger";
import { injectOSVars } from "common/preloads";

import logo from "./logo.html";
import { appendTo as customCSSAppendTo } from "./css";

import "./keybinds";

injectOSVars();

waitForNode("body").then((body) => {
  const clone = logo.querySelector("svg")!.cloneNode(true);
  body.appendChild(clone);

  if (electron.ipcRenderer.sendSync("@vx/transparency/get-state")) document.body.classList.add("transparent");
});

waitForNode("head").then((head) => {
  const { appendTo } = createStyle("vx-logo-css", `#vx-logo {
    position: fixed;
    bottom: 4px;
    left: 4px;
    color: rgb(148, 155, 164);
    z-index: 30000;
  }`);

  appendTo(head);
  customCSSAppendTo(head);
});

try {
  require(electron.ipcRenderer.sendSync("@vx/preload"));
} catch (error) {
  logger.createChild("preload").error(error);
}