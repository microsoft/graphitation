import * as React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import { RecentActivities } from "../types";

declare let __GRAPHIQL_CSS__: string;
declare let __GLOBAL_CSS__: string;
declare global {
  interface Window {
    REMPL_GRAPHQL_DEVTOOLS_RECENT_ACTIVITIES?: RecentActivities[];
  }
}

const style = document.createElement("style");
document.body.appendChild(style);
style.innerHTML = __GLOBAL_CSS__ + __GRAPHIQL_CSS__;

const rootEl = document.createElement("div");
rootEl.style.height = "100%";
rootEl.style.willChange = "transform";

document.body.appendChild(rootEl);

ReactDOM.render(<App />, rootEl);
