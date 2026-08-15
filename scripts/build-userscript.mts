import { writeFile } from "node:fs/promises";
import { BOOKMARKLET_SOURCE } from "../client/src/lib/bookmarkletSource";

const metadata = `// ==UserScript==
// @name         ChordShift for Tab4U
// @namespace    https://tab4uchord-t2tntlcw.manus.space/
// @version      1.0.0
// @description  Transpose chords directly on Tab4U while preserving lyrics.
// @match        https://www.tab4u.com/tabs/songs/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

`;

await writeFile("client/public/chordshift.user.js", `${metadata}${BOOKMARKLET_SOURCE}\n`, "utf8");
