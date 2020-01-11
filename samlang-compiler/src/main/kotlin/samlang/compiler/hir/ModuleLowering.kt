package samlang.compiler.hir

import samlang.ast.common.Sources
import samlang.ast.common.Type
import samlang.ast.hir.HighIrClassDefinition
import samlang.ast.hir.HighIrExpression
import samlang.ast.hir.HighIrFunction
import samlang.ast.hir.HighIrModule
import samlang.ast.hir.HighIrPattern
import samlang.ast.hir.HighIrStatement
import samlang.ast.lang.ClassDefinition
import samlang.ast.lang.Module

fun compileSources(sources: Sources<Module>): Sources<HighIrModule> =
    Sources(moduleMappings = sources.moduleMappings.mapValues { (_, module) -> compileModule(module = module) })

fun compileModule(module: Module): HighIrModule =
    HighIrModule(imports = module.imports, classDefinitions = module.classDefinitions.map(::compileClassDefinition))

private fun compileClassDefinition(classDefinition: ClassDefinition): HighIrClassDefinition =
    HighIrClassDefinition(
        className = classDefinition.name,
        typeDefinition = classDefinition.typeDefinition,
        members = classDefinition.members.map(transform = ::compileFunction)
    )

/** Exposed for testing. */
internal fun compileFunction(classMember: ClassDefinition.MemberDefinition): HighIrFunction {
    val bodyLoweringResult = lowerExpression(expression = classMember.body)
    val statements = bodyLoweringResult.unwrappedStatements
    val finalExpression = bodyLoweringResult.expression
    val body = if (finalExpression == null) {
        statements
    } else {
        val additionStatementForFinalExpression =
            if (classMember.body.type == Type.unit &&
                bodyLoweringResult.expression is HighIrExpression.FunctionApplication) {
                HighIrStatement.ConstantDefinition(
                    pattern = HighIrPattern.WildCardPattern,
                    typeAnnotation = Type.unit,
                    assignedExpression = bodyLoweringResult.expression
                )
            } else {
                HighIrStatement.Return(expression = bodyLoweringResult.expression)
            }
        statements.plus(element = additionStatementForFinalExpression)
    }
    return HighIrFunction(
        isPublic = classMember.isPublic,
        isMethod = classMember.isMethod,
        name = classMember.name,
        typeParameters = classMember.typeParameters,
        parameters = classMember.parameters.map { it.name to it.type },
        returnType = classMember.type.returnType,
        body = body
    )
}
