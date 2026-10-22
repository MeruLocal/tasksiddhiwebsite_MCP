#!/usr/bin/env node
// Fails when package.json, server.json and src/version.ts disagree.
import { readFileSync } from "node:fs";
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const pkg = JSON.parse(rd("package.json")).version;
const srv = JSON.parse(rd("server.json")).version;
const src = (rd("src/version.ts").match(/"([^"]+)"/) || [])[1];
const bad = [["server.json", srv], ["src/version.ts", src]].filter(([, v]) => v !== pkg);
if (bad.length) { console.error(`version mismatch: package.json=${pkg}`, bad.map(([f, v]) => `${f}=${v}`).join(" ")); process.exit(1); }
console.log(`versions agree: ${pkg}`);
