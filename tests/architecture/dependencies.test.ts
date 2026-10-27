import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = join(process.cwd(), "src");

async function collectTypeScriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTypeScriptFiles(path)));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(path);
    }
  }
  return files;
}

function importedSpecifiers(source: string): string[] {
  return [...source.matchAll(/from\s+["']([^"']+)["']/g)].map(
    (match) => match[1]!,
  );
}

function forbiddenImports(
  files: ReadonlyArray<{ path: string; source: string }>,
  forbidden: ReadonlyArray<string>,
): string[] {
  const violations: string[] = [];
  for (const file of files) {
    for (const specifier of importedSpecifiers(file.source)) {
      if (forbidden.some((value) => specifier.includes(value))) {
        violations.push(
          `${relative(process.cwd(), file.path)} imports ${specifier}`,
        );
      }
    }
  }
  return violations;
}

describe("hexagonal dependency direction", () => {
  it("keeps the domain independent of application, infrastructure and frameworks", async () => {
    const paths = await collectTypeScriptFiles(join(sourceRoot, "domain"));
    const files = await Promise.all(
      paths.map(async (path) => ({ path, source: await readFile(path, "utf8") })),
    );

    expect(
      forbiddenImports(files, [
        "/application/",
        "/adapters/",
        "/config/",
        "express",
        "drizzle-orm",
        "cheerio",
        "pino",
        "dotenv",
        '"pg"',
      ]),
    ).toEqual([]);
  });

  it("keeps application code independent of adapters and frameworks", async () => {
    const paths = await collectTypeScriptFiles(join(sourceRoot, "application"));
    const files = await Promise.all(
      paths.map(async (path) => ({ path, source: await readFile(path, "utf8") })),
    );

    expect(
      forbiddenImports(files, [
        "/adapters/",
        "/config/",
        "express",
        "drizzle-orm",
        "cheerio",
        "pino",
        "dotenv",
        '"pg"',
        "node:http",
        "node:fs",
      ]),
    ).toEqual([]);
  });
});
