import {
  FormatModule,
  PluginInitializer,
} from "relay-compiler/lib/language/RelayLanguagePluginInterface";
import { writeFile } from "fs/promises";
import { dirname, isAbsolute, join } from "path";
import invariant from "invariant";

type Options = {
  graphQLFilesOutputDir: string;
};

type PluginWithArtifactsInitializer = PluginInitializer & {
  flush: () => Promise<void>;
};

type EmitArtifactState = {
  options: Options;
  buffer: { file: string; data: string }[];
  activeFlushes: Set<Promise<unknown>>;
  totalTime: number;
};

const BATCH_SIZE = 8;
const WRITE_RETRY_TIMEOUT_MS = 1000;

/**
 * Allows extracting additional artefacts as a side effect of language plugin work
 */
export function withArtifacts(
  plugin: PluginInitializer,
  options: Options,
): PluginWithArtifactsInitializer {
  const state: EmitArtifactState = {
    options,
    buffer: [],
    activeFlushes: new Set(),
    totalTime: 0.0,
  };
  const initializer: PluginWithArtifactsInitializer = () => {
    const pluginWithoutArtifacts = plugin();
    return {
      ...pluginWithoutArtifacts,
      formatModule: (entry) => {
        processEntry(state, entry);
        return pluginWithoutArtifacts.formatModule(entry);
      },
    };
  };
  initializer.flush = async () => {
    flushBuffer(state);
    await Promise.all(state.activeFlushes);
    // state.activeFlushes.clear();
    invariant(state.buffer.length === 0, "Buffer must be empty");
    invariant(state.activeFlushes.size === 0, "Active flushes must be empty");
  };
  return initializer;
}

type FormatModuleOptions = Parameters<FormatModule>[0];

function processEntry(
  state: EmitArtifactState,
  { moduleName, kind, docText, definition }: FormatModuleOptions,
) {
  const { options, buffer } = state;
  if (options.graphQLFilesOutputDir && kind === "Request" && docText) {
    invariant(definition.loc.kind === "Source", "Expecting source operation");
    const sourcePath = definition.loc.source.name;
    invariant(sourcePath, "Expecting source file path");

    buffer.push({
      file: resolvePath(sourcePath, moduleName, state.options),
      data: docText,
    });
  }
  if (buffer.length >= BATCH_SIZE) {
    flushBuffer(state);
  }
}

function resolvePath(
  sourcePath: string,
  moduleName: string,
  options: Options,
): string {
  const dir = options.graphQLFilesOutputDir;
  if (isAbsolute(dir)) {
    // Assuming all moduleNames are unique (Relay enforces this)
    return join(dir, moduleName);
  }
  if (dir.startsWith(".")) {
    // Rely on CWD
    return join(dir, moduleName);
  }
  if (dir === "__generated__") {
    throw new Error(
      `Option --graphQLFilesOutputDir cannot be equal to __generated__. This directory is expected to contain runtime artifacts only`,
    );
  }
  return join(dirname(sourcePath), dir, moduleName + ".extracted");
}

async function flushBuffer(state: EmitArtifactState) {
  const start = performance.now();
  const promises = state.buffer.map((e) => writeWithRetry(e.file, e.data));
  state.buffer.length = 0;
  const promise = Promise.all(promises);
  state.activeFlushes.add(promise);
  await promise;
  state.totalTime += performance.now() - start;
  state.activeFlushes.delete(promise);
}

async function writeWithRetry(file: string, data: string) {
  try {
    await writeFile(file, data);
  } catch (e) {
    await new Promise((resolve) => {
      setTimeout(resolve, WRITE_RETRY_TIMEOUT_MS);
    });
    await writeFile(file, data);
  }
}
