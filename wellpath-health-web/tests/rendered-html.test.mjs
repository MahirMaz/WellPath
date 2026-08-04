import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("https://wellpath.example/", {
      headers: {
        accept: "text/html",
        host: "wellpath.example",
        "x-forwarded-host": "wellpath.example",
        "x-forwarded-proto": "https",
      },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders WellPath metadata", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(
    html,
    /<title>WellPath Health \| Connected wellness workspace<\/title>/i,
  );
  assert.match(html, /property="og:title" content="WellPath Health"/i);
  assert.match(
    html,
    /property="og:image" content="https:\/\/wellpath\.example\/og\.png"/i,
  );
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("ships the functional web app and API routes without starter assets", async () => {
  const [page, app, aiRoute, backendRoute] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/WellPathWebApp.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/api/ai/[...path]/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/api/backend/[...path]/route.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(page, /<WellPathWebApp \/>/);
  assert.match(app, /wellpath-src\/app\.jsx/);
  assert.match(aiRoute, /api\.groq\.com\/openai\/v1\/chat\/completions/);
  assert.match(backendRoute, /proxyWellPathRequest/);

  await assert.rejects(
    access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)),
  );
  await assert.rejects(
    access(new URL("../app/_sites-preview/preview.css", import.meta.url)),
  );
});
