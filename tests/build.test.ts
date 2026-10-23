import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { build } from "../lib/build.ts";

async function siteFixture(source: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "fluidsite-test-"));
  await mkdir(join(root, "src", "assets"), { recursive: true });
  await mkdir(join(root, "public", "images"), { recursive: true });
  await writeFile(join(root, "business.json"), JSON.stringify({ name: "Test Business" }));
  await writeFile(join(root, "src", "index.ts"), source);
  await writeFile(join(root, "src", "assets", "styles.css"), "body{color:black}");
  await writeFile(join(root, "public", "images", "logo.txt"), "image");
  return root;
}

test("builds arbitrary HTML pages and automatically copies site files", async () => {
  const root = await siteFixture(`
    export function build({ business }) {
      return {
        "index.html": "<!doctype html><html><head></head><body><h1>" + business.name + "</h1></body></html>",
        "services/index.html": "<!doctype html><title>Services</title>"
      };
    }
  `);

  const result = await build(root);

  assert.deepEqual(result.pagesWritten, ["index.html", "services/index.html"]);
  assert.equal(await readFile(join(root, "dist", "styles.css"), "utf8"), "body{color:black}");
  assert.equal(await readFile(join(root, "dist", "public", "images", "logo.txt"), "utf8"), "image");
  assert.match(await readFile(join(root, "dist", "index.html"), "utf8"), /Test Business/);
  assert.match(
    await readFile(join(root, "dist", "index.html"), "utf8"),
    /application\/ld\+json/,
  );
  assert.match(
    await readFile(join(root, "dist", "services", "index.html"), "utf8"),
    /Services/,
  );
});

test("requires a home page and preserves the previous dist on failure", async () => {
  const root = await siteFixture(`export function build() { return { "about.html": "About" }; }`);
  await mkdir(join(root, "dist"));
  await writeFile(join(root, "dist", "index.html"), "previous build");

  await assert.rejects(build(root), /must return an index\.html page/);
  assert.equal(await readFile(join(root, "dist", "index.html"), "utf8"), "previous build");
});

test("rejects pages that escape dist", async () => {
  const root = await siteFixture(`
    export function build() {
      return { "index.html": "Home", "../outside.html": "Nope" };
    }
  `);

  await assert.rejects(build(root), /escapes dist/);
});
