package samlang.printer

import io.kotlintest.fail
import io.kotlintest.shouldBe
import io.kotlintest.specs.StringSpec
import samlang.ast.common.BinaryOperator
import samlang.ast.common.Literal
import samlang.ast.common.Range
import samlang.ast.common.Type
import samlang.ast.common.TypeDefinition
import samlang.ast.common.TypeDefinitionType
import samlang.ast.ir.IrExpression
import samlang.ast.ir.IrStatement
import samlang.ast.ts.TsFunction
import samlang.ast.ts.TsModule
import samlang.ast.ts.TsModuleFolder
import samlang.ast.ts.TsPattern

class TsPrinterTest : StringSpec() {

    private fun runCorrectlyPrintedTest(
        testName: String,
        tsModuleFolder: TsModuleFolder,
        expectedTsIndexModuleCode: String? = null,
        expectedTsClassModulesCode: List<String>,
        expectedJsClassModulesCode: List<String?>
    ) {
        if (expectedTsIndexModuleCode != null) {
            "$testName: Index Module" {
                printTsIndexModule(tsModuleFolder = tsModuleFolder) shouldBe expectedTsIndexModuleCode
            }
        }
        if (expectedTsClassModulesCode.size != expectedJsClassModulesCode.size ||
            expectedTsClassModulesCode.size != tsModuleFolder.subModules.size
        ) {
            "$testName: BAD SIZE" {
                fail(msg = "Size mismatch")
            }
            return
        }
        val testCases = tsModuleFolder.subModules.zip(
            other = expectedTsClassModulesCode.zip(other = expectedJsClassModulesCode)
        )
        for ((subModule, expectedCode) in testCases) {
            val (expectedTsCode, expectedJsCode) = expectedCode
            "$testName: TS Module `${subModule.typeName}`" {
                printTsModule(tsModule = subModule, withType = true) shouldBe expectedTsCode
            }
            if (expectedJsCode != null) {
                "$testName: JS Module `${subModule.typeName}`" {
                    printTsModule(tsModule = subModule, withType = false) shouldBe expectedJsCode
                }
            }
        }
    }

    private fun runCorrectlyPrintedTest(
        testName: String,
        tsModule: TsModule,
        expectedTsIndexModuleCode: String? = null,
        expectedTsClassModuleCode: String,
        expectedJsClassModuleCode: String? = null
    ): Unit = runCorrectlyPrintedTest(
        testName = testName,
        tsModuleFolder = TsModuleFolder(subModules = listOf(element = tsModule)),
        expectedTsIndexModuleCode = expectedTsIndexModuleCode,
        expectedTsClassModulesCode = listOf(element = expectedTsClassModuleCode),
        expectedJsClassModulesCode = listOf(element = expectedJsClassModuleCode)
    )

    init {
        runCorrectlyPrintedTest(
            testName = "Empty",
            tsModuleFolder = TsModuleFolder(subModules = emptyList()),
            expectedTsIndexModuleCode = "export {  };\n",
            expectedTsClassModulesCode = emptyList(),
            expectedJsClassModulesCode = emptyList()
        )

        runCorrectlyPrintedTest(
            testName = "Dummy Class Module",
            tsModule = TsModule(
                imports = emptyList(),
                typeName = "Test",
                typeDefinition = TypeDefinition.ofDummy(range = Range.DUMMY),
                functions = emptyList()
            ),
            expectedTsIndexModuleCode = """
                import * as Test from './_Test';

                export { Test };

            """.trimIndent(),
            expectedTsClassModuleCode = """
                type Test = {
                };
                
                export {  };

            """.trimIndent(),
            expectedJsClassModuleCode = """
                export {  };

            """.trimIndent()
        )

        runCorrectlyPrintedTest(
            testName = "Throw",
            tsModule = TsModule(
                imports = emptyList(),
                typeName = "Test",
                typeDefinition = TypeDefinition.ofDummy(range = Range.DUMMY),
                functions = listOf(
                    element = TsFunction(
                        shouldBeExported = true,
                        name = "test",
                        typeParameters = emptyList(),
                        parameters = emptyList(),
                        returnType = Type.unit,
                        body = listOf(
                            element = IrStatement.Throw(
                                expression = IrExpression.Literal(literal = Literal.of(value = "Ah!"))
                            )
                        )
                    )
                )
            ),
            expectedTsClassModuleCode = """
                type Test = {
                };
                
                function test(): void {
                  throw new Error("Ah!");
                }
                
                export { test };

            """.trimIndent(),
            expectedJsClassModuleCode = """
                function test() {
                  throw new Error("Ah!");
                }
                
                export { test };

            """.trimIndent()
        )

        runCorrectlyPrintedTest(
            testName = "Return",
            tsModule = TsModule(
                imports = emptyList(),
                typeName = "Test",
                typeDefinition = TypeDefinition.ofDummy(range = Range.DUMMY),
                functions = listOf(
                    element = TsFunction(
                        shouldBeExported = true,
                        name = "test",
                        typeParameters = emptyList(),
                        parameters = emptyList(),
                        returnType = Type.unit,
                        body = listOf(
                            element = IrStatement.Return(expression = null)
                        )
                    )
                )
            ),
            expectedTsClassModuleCode = """
                type Test = {
                };
                
                function test(): void {
                  return;
                }
                
                export { test };

            """.trimIndent()
        )

        runCorrectlyPrintedTest(
            testName = "If-Else",
            tsModule = TsModule(
                imports = emptyList(),
                typeName = "Test",
                typeDefinition = TypeDefinition.ofDummy(range = Range.DUMMY),
                functions = listOf(
                    element = TsFunction(
                        shouldBeExported = true,
                        name = "test",
                        typeParameters = emptyList(),
                        parameters = emptyList(),
                        returnType = Type.unit,
                        body = listOf(
                            element = IrStatement.IfElse(
                                booleanExpression = IrExpression.Literal(literal = Literal.of(value = true)),
                                s1 = listOf(element = IrStatement.Return(expression = null)),
                                s2 = listOf(element = IrStatement.Return(expression = null))
                            )
                        )
                    )
                )
            ),
            expectedTsClassModuleCode = """
                type Test = {
                };
                
                function test(): void {
                  if (true) {
                    return;
                  } else {
                    return;
                  }
                }
                
                export { test };

            """.trimIndent()
        )

        runCorrectlyPrintedTest(
            testName = "Simple Assignment",
            tsModule = TsModule(
                imports = emptyList(),
                typeName = "Test",
                typeDefinition = TypeDefinition.ofDummy(range = Range.DUMMY),
                functions = listOf(
                    element = TsFunction(
                        shouldBeExported = true,
                        name = "test",
                        typeParameters = emptyList(),
                        parameters = emptyList(),
                        returnType = Type.unit,
                        body = listOf(
                            element = IrStatement.ConstantDefinition(
                                pattern = TsPattern.VariablePattern(
                                    name = "foo"
                                ),
                                typeAnnotation = Type.string,
                                assignedExpression = IrExpression.Literal(literal = Literal.of(value = "bar"))
                            )
                        )
                    )
                )
            ),
            expectedTsClassModuleCode = """
                type Test = {
                };
                
                function test(): void {
                  const foo: string = "bar";
                }
                
                export { test };

            """.trimIndent(),
            expectedJsClassModuleCode = """
                function test() {
                  const foo = "bar";
                }
                
                export { test };

            """.trimIndent()
        )

        runCorrectlyPrintedTest(
            testName = "Simple Wildcard Assignment",
            tsModule = TsModule(
                imports = emptyList(),
                typeName = "Test",
                typeDefinition = TypeDefinition.ofDummy(range = Range.DUMMY),
                functions = listOf(
                    element = TsFunction(
                        shouldBeExported = true,
                        name = "test",
                        typeParameters = emptyList(),
                        parameters = emptyList(),
                        returnType = Type.unit,
                        body = listOf(
                            element = IrStatement.ConstantDefinition(
                                pattern = TsPattern.WildCardPattern,
                                typeAnnotation = Type.string,
                                assignedExpression = IrExpression.Literal(literal = Literal.of(value = "bar"))
                            )
                        )
                    )
                )
            ),
            expectedTsClassModuleCode = """
                type Test = {
                };
                
                function test(): void {
                  "bar";
                }
                
                export { test };

            """.trimIndent()
        )

        runCorrectlyPrintedTest(
            testName = "Tuple Assignment",
            tsModule = TsModule(
                imports = emptyList(),
                typeName = "Test",
                typeDefinition = TypeDefinition.ofDummy(range = Range.DUMMY),
                functions = listOf(
                    element = TsFunction(
                        shouldBeExported = true,
                        name = "test",
                        typeParameters = emptyList(),
                        parameters = emptyList(),
                        returnType = Type.unit,
                        body = listOf(
                            element = IrStatement.ConstantDefinition(
                                pattern = TsPattern.TuplePattern(
                                    destructedNames = listOf("foo", "bar")
                                ),
                                typeAnnotation = Type.TupleType(mappings = listOf(Type.string, Type.string)),
                                assignedExpression = IrExpression.TupleConstructor(
                                    expressionList = listOf(
                                        IrExpression.Literal(literal = Literal.of(value = "foo")),
                                        IrExpression.Literal(literal = Literal.of(value = "bar"))
                                    )
                                )
                            )
                        )
                    )
                )
            ),
            expectedTsClassModuleCode = """
                type Test = {
                };
                
                function test(): void {
                  const [foo, bar]: [string, string] = ["foo", "bar"];
                }
                
                export { test };

            """.trimIndent(),
            expectedJsClassModuleCode = """
                function test() {
                  const [foo, bar] = ["foo", "bar"];
                }
                
                export { test };

            """.trimIndent()
        )

        runCorrectlyPrintedTest(
            testName = "Object Destructing",
            tsModule = TsModule(
                imports = emptyList(),
                typeName = "Test",
                typeDefinition = TypeDefinition(
                    range = Range.DUMMY,
                    type = TypeDefinitionType.OBJECT,
                    typeParameters = emptyList(),
                    mappings = mapOf("foo" to Type.int, "bar" to Type.bool)
                ),
                functions = listOf(
                    element = TsFunction(
                        shouldBeExported = true,
                        name = "test",
                        typeParameters = emptyList(),
                        parameters = listOf(element = "obj" to Type.id(identifier = "Test")),
                        returnType = Type.unit,
                        body = listOf(
                            element = IrStatement.ConstantDefinition(
                                pattern = TsPattern.ObjectPattern(
                                    destructedNames = listOf("foo" to null, "bar" to "baz")
                                ),
                                typeAnnotation = Type.id(identifier = "Test"),
                                assignedExpression = IrExpression.ObjectConstructor(
                                    spreadExpression = IrExpression.Variable(name = "obj"),
                                    fieldDeclaration = listOf(
                                        "foo" to IrExpression.Literal(literal = Literal.of(value = "foo")),
                                        "bar" to IrExpression.Literal(literal = Literal.of(value = "bar"))
                                    )
                                )
                            )
                        )
                    )
                )
            ),
            expectedTsClassModuleCode = """
                type Test = {
                  readonly foo: number;
                  readonly bar: boolean;
                };
                
                function test(obj: Test): void {
                  const { foo, bar: baz }: Test = { ...obj, foo: "foo", bar: "bar" };
                }
                
                export { test };

            """.trimIndent(),
            expectedJsClassModuleCode = """
                function test(obj) {
                  const { foo, bar: baz } = { ...obj, foo: "foo", bar: "bar" };
                }
                
                export { test };

            """.trimIndent()
        )

        runCorrectlyPrintedTest(
            testName = "Binary Expressions",
            tsModule = TsModule(
                imports = emptyList(),
                typeName = "Test",
                typeDefinition = TypeDefinition.ofDummy(range = Range.DUMMY),
                functions = listOf(
                    element = TsFunction(
                        shouldBeExported = true,
                        name = "test",
                        typeParameters = emptyList(),
                        parameters = emptyList(),
                        returnType = Type.unit,
                        body = listOf(
                            IrStatement.ConstantDefinition(
                                pattern = TsPattern.WildCardPattern,
                                typeAnnotation = Type.string,
                                assignedExpression = IrExpression.Binary(
                                    operator = BinaryOperator.PLUS,
                                    e1 = IrExpression.Literal(literal = Literal.of(value = 3)),
                                    e2 = IrExpression.Literal(literal = Literal.of(value = 14))
                                )
                            ),
                            IrStatement.ConstantDefinition(
                                pattern = TsPattern.WildCardPattern,
                                typeAnnotation = Type.string,
                                assignedExpression = IrExpression.Binary(
                                    operator = BinaryOperator.DIV,
                                    e1 = IrExpression.Literal(literal = Literal.of(value = 3)),
                                    e2 = IrExpression.Literal(literal = Literal.of(value = 14))
                                )
                            ),
                            IrStatement.ConstantDefinition(
                                pattern = TsPattern.WildCardPattern,
                                typeAnnotation = Type.string,
                                assignedExpression = IrExpression.Binary(
                                    operator = BinaryOperator.DIV,
                                    e1 = IrExpression.Literal(literal = Literal.of(value = 3)),
                                    e2 = IrExpression.Binary(
                                        operator = BinaryOperator.PLUS,
                                        e1 = IrExpression.Literal(literal = Literal.of(value = 3)),
                                        e2 = IrExpression.Literal(literal = Literal.of(value = 14))
                                    )
                                )
                            ),
                            IrStatement.ConstantDefinition(
                                pattern = TsPattern.WildCardPattern,
                                typeAnnotation = Type.string,
                                assignedExpression = IrExpression.Binary(
                                    operator = BinaryOperator.MUL,
                                    e1 = IrExpression.Binary(
                                        operator = BinaryOperator.PLUS,
                                        e1 = IrExpression.Literal(literal = Literal.of(value = 3)),
                                        e2 = IrExpression.Literal(literal = Literal.of(value = 14))
                                    ),
                                    e2 = IrExpression.Literal(literal = Literal.of(value = 3))
                                )
                            )
                        )
                    )
                )
            ),
            expectedTsClassModuleCode = """
                type Test = {
                };
                
                function test(): void {
                  3 + 14;
                  Math.floor(3 / 14) ;
                  Math.floor(3 / (3 + 14)) ;
                  (3 + 14) * 3;
                }
                
                export { test };

            """.trimIndent()
        )
    }
}
