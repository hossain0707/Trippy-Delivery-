import test from "node:test";
import assert from "node:assert/strict";
import { editableProfile } from "./profile.mjs";

test("saving a fetched profile omits identity, timestamps and injected roles", () => {
  const profile = { name: "নাজমুল", phone: "", language: "bn", subject: "google:123", email: "customer@example.com", updated_at: "2026-11-19", roles: ["admin"] };
  assert.deepEqual(editableProfile(profile), { name: "নাজমুল", phone: "", language: "bn" });
  assert.equal(profile.subject, "google:123");
});

test("empty phone and English preference round trip without extra fields", () => {
  assert.deepEqual(editableProfile({name:"Customer", phone:"", language:"en"}), {name:"Customer", phone:"", language:"en"});
});
