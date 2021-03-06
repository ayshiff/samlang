import {
  buildGlobalTypingContext,
  updateGlobalTypingContext,
} from './global-typing-context-builder';
import ModuleTypeChecker from './module-type-checker';
import type { GlobalTypingContext, MemberTypeInformation } from './typing-context';
import checkUndefinedImportsError from './undefined-imports-checker';

import { ModuleReference, Sources } from 'samlang-core-ast/common-nodes';
import type { SamlangModule } from 'samlang-core-ast/samlang-toplevel';
import type { ReadonlyGlobalErrorCollector } from 'samlang-core-errors';
import {
  HashMap,
  HashSet,
  ReadonlyHashSet,
  hashMapOf,
  mapOf,
  setOf,
  hashSetOf,
  assertNotNull,
} from 'samlang-core-utils';

/**
 * A centralized place to manage up-to-date dependency relationship.
 * It is particularly useful for incremental type checking.
 */
export class DependencyTracker {
  /** [module] => what this module depends on */
  private readonly forwardDependency: HashMap<
    ModuleReference,
    ReadonlyHashSet<ModuleReference>
  > = hashMapOf();

  /** [module] => other modules depends on this module */
  private readonly reverseDependency: HashMap<
    ModuleReference,
    HashSet<ModuleReference>
  > = hashMapOf();

  getForwardDependencies(moduleReference: ModuleReference): ReadonlyHashSet<ModuleReference> {
    return this.forwardDependency.get(moduleReference) ?? setOf();
  }

  getReverseDependencies(moduleReference: ModuleReference): ReadonlyHashSet<ModuleReference> {
    return this.reverseDependency.get(moduleReference) ?? setOf();
  }

  /**
   * Update dependency tracker with `moduleReference` and `importedModules`.
   * If `importedModules` is null, it means that we want to remove `moduleReference` from system.
   */
  update(moduleReference: ModuleReference, importedModules?: readonly ModuleReference[]): void {
    const oldImportedModules = this.forwardDependency.get(moduleReference);
    if (oldImportedModules != null) {
      oldImportedModules.forEach((oldImportedModule) => {
        const reverseDependencySet = this.reverseDependency.get(oldImportedModule);
        // If things are consistent:
        //   then if B is A's forward dependency, then A must be B's reverse dependency.
        assertNotNull(reverseDependencySet);
        reverseDependencySet.delete(moduleReference);
      });
    }
    if (importedModules == null) {
      this.forwardDependency.delete(moduleReference);
      return;
    }
    this.forwardDependency.set(moduleReference, setOf(...importedModules));
    importedModules.forEach((newImportedModule) => {
      const reverseDependencies = this.reverseDependency.get(newImportedModule);
      if (reverseDependencies == null) {
        this.reverseDependency.set(newImportedModule, hashSetOf(moduleReference));
      } else {
        reverseDependencies?.add(moduleReference);
      }
    });
  }
}

const typeCheckModule = (
  sources: Sources<SamlangModule>,
  globalTypingContext: GlobalTypingContext,
  moduleReference: ModuleReference,
  samlangModule: SamlangModule,
  errorCollector: ReadonlyGlobalErrorCollector
): SamlangModule => {
  const moduleErrorCollector = errorCollector.getModuleErrorCollector(moduleReference);
  checkUndefinedImportsError(sources, samlangModule, moduleErrorCollector);
  const moduleContext = globalTypingContext.get(moduleReference);
  assertNotNull(moduleContext);
  const checkedModule = new ModuleTypeChecker(moduleErrorCollector).typeCheck(samlangModule, {
    ...moduleContext.importedClasses,
    ...moduleContext.definedClasses,
  });
  return checkedModule;
};

export const typeCheckSources = (
  sources: Sources<SamlangModule>,
  errorCollector: ReadonlyGlobalErrorCollector
): readonly [Sources<SamlangModule>, GlobalTypingContext] => {
  const globalTypingContext = buildGlobalTypingContext(sources);
  const checkedSources = hashMapOf<ModuleReference, SamlangModule>();
  sources.forEach((samlangModule, moduleReference) => {
    checkedSources.set(
      moduleReference,
      typeCheckModule(sources, globalTypingContext, moduleReference, samlangModule, errorCollector)
    );
  });
  return [checkedSources, globalTypingContext];
};

export const typeCheckSourcesIncrementally = (
  sources: Sources<SamlangModule>,
  globalTypingContext: GlobalTypingContext,
  affectedSourceList: readonly ModuleReference[],
  errorCollector: ReadonlyGlobalErrorCollector
): Sources<SamlangModule> => {
  updateGlobalTypingContext(globalTypingContext, sources, affectedSourceList);
  const updatedSources = hashMapOf<ModuleReference, SamlangModule>();
  affectedSourceList.forEach((moduleReference) => {
    const samlangModule = sources.get(moduleReference);
    if (samlangModule == null) {
      return;
    }
    updatedSources.set(
      moduleReference,
      typeCheckModule(sources, globalTypingContext, moduleReference, samlangModule, errorCollector)
    );
  });
  return updatedSources;
};

// eslint-disable-next-line camelcase
export const typeCheckSingleModuleSource_EXPOSED_FOR_TESTING = (
  samlangModule: SamlangModule,
  errorCollector: ReadonlyGlobalErrorCollector
): SamlangModule => {
  const moduleReference = new ModuleReference(['Test']);
  const checkedModule = typeCheckSources(
    mapOf([moduleReference, samlangModule]),
    errorCollector
  )[0].get(moduleReference);
  assertNotNull(checkedModule);
  return checkedModule;
};

export type { GlobalTypingContext, MemberTypeInformation };
