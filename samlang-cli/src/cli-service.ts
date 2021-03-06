import { spawnSync } from 'child_process';
import { lstatSync, readdirSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, normalize, dirname, resolve, relative, sep } from 'path';

import type { SamlangProjectConfiguration } from './configuration';

import { assemblyProgramToString } from 'samlang-core-ast/asm-program';
import { ModuleReference, Sources } from 'samlang-core-ast/common-nodes';
import type { SamlangModule } from 'samlang-core-ast/samlang-toplevel';
import { compileSamlangSourcesToHighIRSources } from 'samlang-core-compiler';
import { prettyPrintHighIRModuleAsJS } from 'samlang-core-printer';
import { lowerSourcesToAssemblyPrograms } from 'samlang-core-services';

const walk = (startPath: string, visitor: (file: string) => void): void => {
  const recursiveVisit = (path: string): void => {
    if (lstatSync(path).isFile()) {
      visitor(path);
      return;
    }

    if (lstatSync(path).isDirectory()) {
      readdirSync(path).some((relativeChildPath) => recursiveVisit(join(path, relativeChildPath)));
    }
  };

  return recursiveVisit(startPath);
};

export const collectSources = ({
  sourceDirectory,
}: SamlangProjectConfiguration): readonly (readonly [ModuleReference, string])[] => {
  const sourcePath = resolve(sourceDirectory);
  const sources: (readonly [ModuleReference, string])[] = [];

  walk(sourcePath, (file) => {
    if (!file.endsWith('.sam')) return;
    const relativeFile = normalize(relative(sourcePath, file));
    const relativeFileWithoutExtension = relativeFile.substring(0, relativeFile.length - 4);
    sources.push([
      new ModuleReference(relativeFileWithoutExtension.split(sep)),
      readFileSync(file).toString(),
    ]);
  });

  return sources;
};

export const compileToJS = (sources: Sources<SamlangModule>, outputDirectory: string): void => {
  const programs = compileSamlangSourcesToHighIRSources(sources);
  const paths: string[] = [];
  programs.forEach((program, moduleReference) => {
    const outputJSFilePath = join(outputDirectory, `${moduleReference}.js`);
    mkdirSync(dirname(outputJSFilePath), { recursive: true });
    writeFileSync(outputJSFilePath, prettyPrintHighIRModuleAsJS(program));
    paths.push(outputJSFilePath);
  });
};

const compileToX86Assembly = (
  sources: Sources<SamlangModule>,
  outputDirectory: string
): readonly string[] => {
  const programs = lowerSourcesToAssemblyPrograms(sources);
  const paths: string[] = [];
  programs.forEach((program, moduleReference) => {
    const outputAssemblyFilePath = join(outputDirectory, `${moduleReference}.s`);
    mkdirSync(dirname(outputAssemblyFilePath), { recursive: true });
    writeFileSync(outputAssemblyFilePath, assemblyProgramToString(program));
    paths.push(outputAssemblyFilePath);
  });
  return paths;
};

const RUNTIME_PATH = join(__dirname, '..', 'samlang-runtime');
const LIBRARY_NAME = `sam-${process.platform}`;

const linkWithGcc = (outputProgramFile: string, outputAssemblyFile: string): boolean => {
  const gccProcess = spawnSync(
    'gcc',
    [
      '-o',
      outputProgramFile,
      outputAssemblyFile,
      `-L${RUNTIME_PATH}`,
      `-l${LIBRARY_NAME}`,
      '-lpthread',
    ],
    { shell: true, stdio: 'inherit' }
  );
  return gccProcess.status === 0;
};

export const compileToX86Executables = (
  sources: Sources<SamlangModule>,
  outputDirectory: string
): boolean => {
  const assemblyPaths = compileToX86Assembly(sources, outputDirectory);
  const linkResults = assemblyPaths.map((assemblyPath) =>
    linkWithGcc(assemblyPath.substring(0, assemblyPath.length - 2), assemblyPath)
  );
  return linkResults.every((it) => it);
};
