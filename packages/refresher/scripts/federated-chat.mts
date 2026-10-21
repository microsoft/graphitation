import { copyFile, mkdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import type { BuildOptions } from "esbuild";

const root = fileURLToPath(new URL("../", import.meta.url));
const appDirectory = join(root, "examples", "federated-chat");
export const federatedChatOutputDirectory: string = join(
  root,
  "dist",
  "federated-chat",
);
const host = "127.0.0.1";
const assets = new Map<string, readonly [file: string, contentType: string]>([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/main.js", ["main.js", "text/javascript; charset=utf-8"]],
  ["/main.js.map", ["main.js.map", "application/json"]],
  ["/main.css", ["main.css", "text/css; charset=utf-8"]],
  ["/main.css.map", ["main.css.map", "application/json"]],
  ["/worker.js", ["worker.js", "text/javascript; charset=utf-8"]],
  ["/worker.js.map", ["worker.js.map", "application/json"]],
]);

export async function buildFederatedChat(
  outputDirectory: string = federatedChatOutputDirectory,
): Promise<void> {
  await mkdir(outputDirectory, { recursive: true });
  const common: BuildOptions = {
    absWorkingDir: root,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    minify: true,
    // The devtools name actions by their functions' names.
    keepNames: true,
    sourcemap: true,
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    logLevel: "silent",
  };
  await Promise.all([
    build({
      ...common,
      entryPoints: [join(appDirectory, "worker", "main.ts")],
      outfile: join(outputDirectory, "worker.js"),
    }),
    build({
      ...common,
      entryPoints: [join(appDirectory, "main", "main.tsx")],
      outfile: join(outputDirectory, "main.js"),
      jsx: "automatic",
    }),
    copyFile(
      join(appDirectory, "index.html"),
      join(outputDirectory, "index.html"),
    ),
  ]);
}

export type FederatedChatServer = { url: string; close(): Promise<void> };

export async function serveFederatedChat(
  options: { outputDirectory?: string; port?: number; rebuild?: boolean } = {},
): Promise<FederatedChatServer> {
  const outputDirectory =
    options.outputDirectory ?? federatedChatOutputDirectory;
  let rebuilding: Promise<void> | undefined;
  const rebuild = (): Promise<void> => {
    rebuilding ??= buildFederatedChat(outputDirectory).finally(() => {
      rebuilding = undefined;
    });
    return rebuilding;
  };
  const server = createServer((request, response) => {
    const respond = async (): Promise<void> => {
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("X-Content-Type-Options", "nosniff");
      if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405, { Allow: "GET, HEAD" });
        response.end("Method not allowed");
        return;
      }
      const asset = assets.get(
        new URL(request.url ?? "/", `http://${host}`).pathname,
      );
      if (asset === undefined) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }
      if (options.rebuild && asset[0] === "index.html") await rebuild();
      const content = await readFile(join(outputDirectory, asset[0]));
      response.writeHead(200, { "Content-Type": asset[1] });
      response.end(request.method === "HEAD" ? undefined : content);
    };
    void respond().catch((error: unknown) => {
      console.error(error);
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(
        "Federated chat failed to load. See the terminal for details.",
      );
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 0, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (address === null || typeof address === "string")
    throw new Error("Missing HTTP server port.");
  return {
    url: `http://${host}:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
}

async function main(): Promise<void> {
  const mode = process.argv[2] ?? "dev";
  if (mode !== "dev" && mode !== "build" && mode !== "preview")
    throw new Error("Use dev, build, or preview.");
  if (mode !== "preview") await buildFederatedChat();
  if (mode === "build") {
    console.log(`Federated chat build: ${federatedChatOutputDirectory}`);
    return;
  }
  const port = Number(
    process.env["PORT"] ?? (mode === "preview" ? 4181 : 5181),
  );
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT must be an integer between 1 and 65535.");
  const server = await serveFederatedChat({ port, rebuild: mode === "dev" });
  console.log(`Federated chat ${mode}: ${server.url}`);
  if (mode === "dev") console.log("Reload to rebuild edits. No hot reload.");
  const stop = (): void => {
    void server.close().catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
