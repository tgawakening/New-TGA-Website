/**
 * The public origin used for same-origin redirects behind the proxy
 * (lib/external-origin). Pure function; no server, database or network.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { externalOrigin, externalUrl } from "../lib/external-origin";

const INTERNAL = "http://localhost:8080/reset-password/start?token=abc";
const req = (headers: Record<string, string> = {}) => new Request(INTERNAL, { headers });
const env = (app?: string) => ({ ...process.env, NEXT_PUBLIC_APP_URL: app }) as NodeJS.ProcessEnv;

test("forwarded proto + host win when both are present", () => {
  const r = req({ "x-forwarded-proto": "https", "x-forwarded-host": "tga-awakening.com" });
  assert.equal(externalOrigin(r, env("https://other.example")), "https://tga-awakening.com");
  assert.equal(externalUrl("/reset-password", r, env()).toString(), "https://tga-awakening.com/reset-password");
});

test("the first value of a forwarded list is used", () => {
  const r = req({ "x-forwarded-proto": "https, http", "x-forwarded-host": "tga-awakening.com, internal:8080" });
  assert.equal(externalOrigin(r, env()), "https://tga-awakening.com");
});

test("without both forwarded headers, NEXT_PUBLIC_APP_URL is the origin", () => {
  assert.equal(externalOrigin(req(), env("https://tga-awakening.com/")), "https://tga-awakening.com");
  assert.equal(externalOrigin(req({ "x-forwarded-proto": "https" }), env("https://tga-awakening.com")), "https://tga-awakening.com");
  assert.equal(externalOrigin(req({ "x-forwarded-host": "tga-awakening.com" }), env("https://app.example")), "https://app.example");
});

test("the raw request host and port are never used", () => {
  assert.notEqual(externalOrigin(req(), env("https://tga-awakening.com")), "http://localhost:8080");
  assert.equal(externalOrigin(req(), env(undefined)), "http://localhost:3000", "unset: appUrl()'s own fallback, not the request");
});

test("malformed forwarded values are ignored", () => {
  for (const [proto, host] of [
    ["javascript", "tga-awakening.com"],
    ["https", "evil.example/path"],
    ["https", "user@evil.example"],
    ["https", "tga awakening.com"],
    ["https", ""],
  ])
    assert.equal(externalOrigin(req({ "x-forwarded-proto": proto, "x-forwarded-host": host }), env("https://tga-awakening.com")), "https://tga-awakening.com");
});

test("query strings and paths are kept", () => {
  const r = req({ "x-forwarded-proto": "https", "x-forwarded-host": "tga-awakening.com" });
  assert.equal(externalUrl("/seerah?ref=Abc", r, env()).toString(), "https://tga-awakening.com/seerah?ref=Abc");
});
