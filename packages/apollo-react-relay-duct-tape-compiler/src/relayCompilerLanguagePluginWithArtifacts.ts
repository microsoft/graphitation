import {
  FormatModule,
  PluginInitializer,
} from "relay-compiler/lib/language/RelayLanguagePluginInterface";
import { writeFile } from "fs/promises";
import { existsSync, mkdirSync } from "fs";
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
  ensuredDirs: Set<string>;
};

const READ_BATCH_SIZE = 8; // How many operations to read before flushing writes
const WRITE_RETRY_TIMEOUT_MS = 1000;

/**
 * Allows extracting additional artefacts as a side effect of language plugin work
 */
export function withArtifacts(
  plugin: PluginInitializer,
  options: Options,
): PluginWithArtifactsInitializer {
  if (!options.graphQLFilesOutputDir) {
    const init = () => plugin();
    init.flush = async () => {};
    return init;
  }
  const state: EmitArtifactState = {
    options,
    buffer: [],
    activeFlushes: new Set(),
    ensuredDirs: new Set(),
  };
  const initializer: PluginWithArtifactsInitializer = () => {
    const pluginWithoutArtifacts = plugin();
    return {
      ...pluginWithoutArtifacts,
      formatModule: (entry) => {
        processEntry(state, entry);
        return pluginWithoutArtifacts.formatModule(entry);
      },
      isGeneratedFile: () => true,
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
      data:
        `# Extracted by @graphitation/apollo-react-relay-duct-tape-compiler from:\n#   ${sourcePath}\n` +
        docText,
    });
  }
  if (buffer.length >= READ_BATCH_SIZE) {
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
  const promises = state.buffer.map((entry) => writeWithRetry(state, entry));
  state.buffer.length = 0;
  const promise = Promise.all(promises);
  state.activeFlushes.add(promise);
  await promise;
  state.activeFlushes.delete(promise);
}

async function writeWithRetry(
  state: EmitArtifactState,
  { file, data }: { file: string; data: string },
) {
  // Ensure dir exists once per session
  const dir = dirname(file);
  if (!state.ensuredDirs.has(dir)) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    state.ensuredDirs.add(dir);
  }
  try {
    await writeFile(file, data);
  } catch (e) {
    await new Promise((resolve) => {
      setTimeout(resolve, WRITE_RETRY_TIMEOUT_MS);
    });
    await writeFile(file, data);
  }
}
