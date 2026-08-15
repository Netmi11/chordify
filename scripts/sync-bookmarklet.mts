import { writeFile } from "node:fs/promises";
import { BOOKMARKLET_SOURCE } from "../client/src/lib/bookmarkletSource";
await writeFile("client/public/bookmarklet.js", `${BOOKMARKLET_SOURCE}\n`, "utf8");
