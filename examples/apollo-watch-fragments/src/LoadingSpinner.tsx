/**
 * https://loading.io/css/
 * https://github.com/loadingio/css-spinner/tree/master/src/spinner
 */

import * as React from "react";

export const LoadingSpinner: React.FC = () => (
  <div className="lds-spinner">
    <div></div>
    <div></div>
    <div></div>
    <div></div>
    <div></div>
    <div></div>
    <div></div>
    <div></div>
    <div></div>
    <div></div>
    <div></div>
    <div></div>
  </div>
);
