import path from "path";
import fs from "fs/promises";
import { DocumentNode, parse } from "graphql";

export interface ModuleLoader {
  resolveModuleFromPath(
    absolutePath: string,
  ): Promise<{ document: DocumentNode; rootPath: string }>;
}

export interface ModuleLoaderResult {
  document: DocumentNode;
  rootPath: string;
}

export class FileSystemModuleLoader implements ModuleLoader {
  async resolveModuleFromPath(
    absolutePath: string,
  ): Promise<ModuleLoaderResult> {
    let modulePath;
    if (path.isAbsolute(absolutePath)) {
      modulePath = absolutePath;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const packageJson = require(`${absolutePath}/package.json`);
      modulePath = require.resolve(`${absolutePath}/${packageJson.main}`);
    }
    const stat = await fs.stat(modulePath);
    if (stat.isFile()) {
      const body = await fs.readFile(modulePath, { encoding: "utf-8" });
      const document = parse(body);
      return { document, rootPath: modulePath };
    }
    throw new Error(`Error loading module ${absolutePath}`);
  }
}

export class TestModuleLoader implements ModuleLoader {
  private fileSystemLoader: FileSystemModuleLoader;
  constructor(private moduleMap: Map<string, ModuleLoaderResult>) {
    this.fileSystemLoader = new FileSystemModuleLoader();
  }

  resolveModuleFromPath(absolutePath: string): Promise<ModuleLoaderResult> {
    if (this.moduleMap.has(absolutePath)) {
      return Promise.resolve(
        this.moduleMap.get(absolutePath) as ModuleLoaderResult,
      );
    } else {
      return this.fileSystemLoader.resolveModuleFromPath(absolutePath);
    }
  }
}
