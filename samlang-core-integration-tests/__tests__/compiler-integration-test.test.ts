import { runnableSamlangProgramTestCases } from '../test-programs';

import { assemblyProgramToString } from 'samlang-core-ast/asm-program';
import { ModuleReference } from 'samlang-core-ast/common-nodes';
import { MidIRCompilationUnit, midIRCompilationUnitToString } from 'samlang-core-ast/mir-nodes';
import {
  compileSamlangSourcesToHighIRSources,
  compileHighIrModuleToMidIRCompilationUnit,
  generateAssemblyInstructionsFromMidIRCompilationUnit,
} from 'samlang-core-compiler';
import interpretAssemblyProgram from 'samlang-core-interpreter/assembly-interpreter';
import interpretMidIRCompilationUnit from 'samlang-core-interpreter/mid-ir-interpreter';
import interpretSamlangModule from 'samlang-core-interpreter/source-level-interpreter';
import optimizeIRCompilationUnit from 'samlang-core-optimization';
import { checkSources } from 'samlang-core-services';
import { assertNotNull } from 'samlang-core-utils';

type MidIRTestCase = {
  readonly testCaseName: string;
  readonly expectedStandardOut: string;
  readonly compilationUnit: MidIRCompilationUnit;
};

const { checkedSources, compileTimeErrors } = checkSources(
  runnableSamlangProgramTestCases.map((it) => [
    new ModuleReference([it.testCaseName]),
    it.sourceCode,
  ])
);

// @ts-expect-error: process type is in @types/node, but we deliberatively excludes it to prevent core package depending on node.
if (process.env.CI) {
  runnableSamlangProgramTestCases.forEach((testCase) => {
    it(`source-level: ${testCase.testCaseName}`, () => {
      const samlangModule = checkedSources.get(new ModuleReference([testCase.testCaseName]));
      assertNotNull(samlangModule);
      expect(interpretSamlangModule(samlangModule)).toBe(testCase.expectedStandardOut);
    });
  });
}

const mirBaseTestCases: readonly MidIRTestCase[] = (() => {
  expect(compileTimeErrors).toEqual([]);

  const hirSources = compileSamlangSourcesToHighIRSources(checkedSources);

  return runnableSamlangProgramTestCases.map(({ testCaseName, expectedStandardOut }) => {
    const highIRModule = hirSources.get(new ModuleReference([testCaseName]));
    assertNotNull(highIRModule);
    const compilationUnit = compileHighIrModuleToMidIRCompilationUnit(highIRModule);
    return {
      testCaseName,
      expectedStandardOut,
      compilationUnit,
    };
  });
})();

const testMidIROptimizerResult = (
  testCase: MidIRTestCase,
  optimizer: (compilationUnit: MidIRCompilationUnit) => MidIRCompilationUnit
): void => {
  const unoptimized = testCase.compilationUnit;
  const optimized = optimizer(unoptimized);
  const interpretationResult = interpretMidIRCompilationUnit(optimized);
  if (interpretationResult !== testCase.expectedStandardOut) {
    const expected = testCase.expectedStandardOut;
    const unoptimizedString = midIRCompilationUnitToString(unoptimized);
    const optimizedString = midIRCompilationUnitToString(optimized);
    fail(
      `Expected:\n${expected}\nActual:\n${interpretationResult}\nUnoptimized MIR:${unoptimizedString}\nOptimized MIR:${optimizedString}`
    );
  }
};

const testAssemblyResult = (
  testCase: MidIRTestCase,
  optimizer: (compilationUnit: MidIRCompilationUnit) => MidIRCompilationUnit
): void => {
  const unoptimized = testCase.compilationUnit;
  const optimized = optimizer(unoptimized);
  const program = generateAssemblyInstructionsFromMidIRCompilationUnit(optimized);
  const interpretationResult = interpretAssemblyProgram(program);
  if (interpretationResult !== testCase.expectedStandardOut) {
    const expected = testCase.expectedStandardOut;
    const optimizedString = assemblyProgramToString(program);
    fail(`Expected:\n${expected}\nActual:\n${interpretationResult}\nAssembly:${optimizedString}`);
  }
};

mirBaseTestCases.forEach((testCase) => {
  // @ts-expect-error: process type is in @types/node, but we deliberatively excludes it to prevent core package depending on node.
  if (process.env.CI) {
    it(`IR[no-opt]: ${testCase.testCaseName}`, () => {
      let result: string;
      try {
        result = interpretMidIRCompilationUnit(testCase.compilationUnit);
      } catch {
        fail(midIRCompilationUnitToString(testCase.compilationUnit));
      }
      expect(result).toBe(testCase.expectedStandardOut);
    });

    it(`IR[copy]: ${testCase.testCaseName}`, () =>
      testMidIROptimizerResult(testCase, (it) =>
        optimizeIRCompilationUnit(it, { doesPerformCopyPropagation: true })
      ));

    it(`IR[vn]: ${testCase.testCaseName}`, () =>
      testMidIROptimizerResult(testCase, (it) =>
        optimizeIRCompilationUnit(it, { doesPerformLocalValueNumbering: true })
      ));

    it(`IR[cse]: ${testCase.testCaseName}`, () =>
      testMidIROptimizerResult(testCase, (it) =>
        optimizeIRCompilationUnit(it, { doesPerformCommonSubExpressionElimination: true })
      ));

    it(`IR[inl]: ${testCase.testCaseName}`, () =>
      testMidIROptimizerResult(testCase, (it) =>
        optimizeIRCompilationUnit(it, { doesPerformInlining: true })
      ));

    it(`IR[all]: ${testCase.testCaseName}`, () =>
      testMidIROptimizerResult(testCase, (it) => optimizeIRCompilationUnit(it)));
  }

  it(`ASM[all]: ${testCase.testCaseName}`, () =>
    testAssemblyResult(testCase, (it) => optimizeIRCompilationUnit(it)));
});
