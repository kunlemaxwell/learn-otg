import React from "react";
import type * as DS from "./otg-types";
import { installOTG } from "./otg-bundle.js";

/** The design-system components, bound to this app's React. Safe on server and client. */
export const OTG: DS.Lib = installOTG(React, {});
