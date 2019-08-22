package samlang.printer

import org.apache.commons.text.CaseUtils
import samlang.ast.common.Type
import samlang.ast.common.Type.FunctionType
import samlang.ast.common.Type.IdentifierType
import samlang.ast.common.Type.PrimitiveType
import samlang.ast.common.Type.TupleType
import samlang.ast.common.Type.UndecidedType
import samlang.ast.common.TypeVisitor
import samlang.ast.ir.IrExpression
import samlang.ast.ir.IrExpression.Binary
import samlang.ast.ir.IrExpression.ClassMember
import samlang.ast.ir.IrExpression.FieldAccess
import samlang.ast.ir.IrExpression.FunctionApplication
import samlang.ast.ir.IrExpression.Lambda
import samlang.ast.ir.IrExpression.Literal
import samlang.ast.ir.IrExpression.MethodAccess
import samlang.ast.ir.IrExpression.ObjectConstructor
import samlang.ast.ir.IrExpression.Ternary
import samlang.ast.ir.IrExpression.This
import samlang.ast.ir.IrExpression.TupleConstructor
import samlang.ast.ir.IrExpression.Unary
import samlang.ast.ir.IrExpression.Variable
import samlang.ast.ir.IrExpression.VariantConstructor
import samlang.ast.ir.IrExpressionVisitor
import samlang.ast.ir.IrStatement
import samlang.ast.ir.IrStatement.ConstantDefinition
import samlang.ast.ir.IrStatement.IfElse
import samlang.ast.ir.IrStatement.LetDeclaration
import samlang.ast.ir.IrStatement.Match
import samlang.ast.ir.IrStatement.Return
import samlang.ast.ir.IrStatement.Throw
import samlang.ast.ir.IrStatement.VariableAssignment
import samlang.ast.ir.IrStatementVisitor
import samlang.ast.ts.TsPattern
import samlang.util.IndentedPrinter

private class JavaPrinter(private val printer: IndentedPrinter) {

    private val statementPrinter: JavaStatementPrinter = JavaStatementPrinter()
    private val expressionPrinter: JavaExpressionPrinter = JavaExpressionPrinter()

    private var temporaryVariableId: Int = 0

    private fun printStatement(statement: IrStatement): Unit = statement.accept(visitor = statementPrinter)

    private fun printExpression(expression: IrExpression): Unit = expression.accept(visitor = expressionPrinter)

    private fun allocateVariable(): String {
        val id = temporaryVariableId
        temporaryVariableId++
        return "_JAVA_PRINTING_$id"
    }

    private inner class JavaStatementPrinter : IrStatementVisitor<Unit> {
        override fun visit(statement: Throw) {
            printer.printlnWithoutFurtherIndentation {
                printWithoutBreak(x = "throw new Error(")
                printExpression(expression = statement.expression)
                printWithoutBreak(x = ");")
            }
        }

        override fun visit(statement: IfElse) {
            printer.printlnWithoutFurtherIndentation {
                printWithoutBreak(x = "if (")
                printExpression(expression = statement.booleanExpression)
                printWithoutBreak(x = ") {")
            }
            printer.indented {
                statement.s1.forEach(::printStatement)
            }
            printer.printWithBreak(x = "} else {")
            printer.indented {
                statement.s2.forEach(::printStatement)
            }
            printer.printWithBreak(x = "}")
        }

        override fun visit(statement: Match) {
            val (type, assignedTemporaryVariable, matchedVariable, matchedVariableType, matchingList) = statement
            if (assignedTemporaryVariable != null) {
                printer.printWithBreak(x = "${type.toJavaTypeString()} $assignedTemporaryVariable;")
            }
            val totalNumberOfCases = matchingList.size
            for (i in 0 until totalNumberOfCases) {
                val (tag, dataVariable, statements, finalExpression) = matchingList[i]
                printer.printlnWithoutFurtherIndentation {
                    if (i > 0) {
                        printWithoutBreak(x = "} else ")
                    }
                    printWithoutBreak(x = "if ")
                    printWithoutBreak(x = "($matchedVariable instanceof ${matchedVariableType.identifier}.$tag) {")
                }
                printer.indented {
                    if (dataVariable != null) {
                        printWithoutBreak(x = "final var $dataVariable = ")
                        printWithoutBreak(x = "((${matchedVariableType.toJavaTypeString()}) $matchedVariable).data;")
                    }
                    statements.forEach(action = ::printStatement)
                    if (finalExpression != IrExpression.UNIT) {
                        printlnWithoutFurtherIndentation {
                            printWithoutBreak(x = "$assignedTemporaryVariable = ")
                            printExpression(expression = finalExpression)
                            printWithoutBreak(x = ";")
                        }
                    }
                }
            }
            printer.printWithBreak(x = "} else {")
            printer.indented {
                printWithoutBreak(x = "throw new Error(\"NOT_EXHAUSTIVE!\");")
            }
            printer.printWithBreak(x = "}")
        }

        override fun visit(statement: LetDeclaration) {
            printer.printWithBreak(x = "${statement.typeAnnotation} ${statement.name};")
        }

        override fun visit(statement: VariableAssignment) {
            printer.printlnWithoutFurtherIndentation {
                printWithBreak(x = statement.name)
                printWithBreak(x = "=")
                printExpression(expression = statement.assignedExpression)
                printWithoutBreak(";")
            }
        }

        override fun visit(statement: ConstantDefinition) {
            val (pattern, typeAnnotation, assignedExpression) = statement
            printer.printlnWithoutFurtherIndentation {
                when (pattern) {
                    is TsPattern.TuplePattern -> {
                        val temporaryVariable = allocateVariable()
                        printWithoutBreak(x = "${typeAnnotation.toJavaTypeString()} $temporaryVariable = ")
                        printExpression(expression = assignedExpression)
                        printWithBreak(x = ";")
                        pattern.destructedNames.forEachIndexed { index, name ->
                            if (name != null) {
                                printWithoutBreak(x = "final var $name = $temporaryVariable.get$index();")
                            }
                        }
                    }
                    is TsPattern.ObjectPattern -> {
                        val temporaryVariable = allocateVariable()
                        printWithoutBreak(x = "${typeAnnotation.toJavaTypeString()} $temporaryVariable = ")
                        printExpression(expression = assignedExpression)
                        printWithBreak(x = ";")
                        pattern.destructedNames.forEach { (name, alias) ->
                            val getMethodCall =
                                "$temporaryVariable.get${CaseUtils.toCamelCase(name, true)}()"
                            printWithoutBreak(x = "final var ${alias ?: name} = $getMethodCall;")
                        }
                    }
                    is TsPattern.VariablePattern -> {
                        printWithoutBreak(x = "${typeAnnotation.toJavaTypeString()} ${pattern.name} = ")
                        printExpression(expression = assignedExpression)
                        printWithBreak(x = ";")
                    }
                    is TsPattern.WildCardPattern -> {
                        printExpression(expression = assignedExpression)
                        printWithBreak(x = ";")
                    }
                }
            }
        }

        override fun visit(statement: Return) {
            val returnedExpression = statement.expression
            if (returnedExpression == null) {
                printer.printWithBreak(x = "return;")
            } else {
                printer.printlnWithoutFurtherIndentation {
                    printWithoutBreak(x = "return ")
                    printExpression(expression = returnedExpression)
                    printWithoutBreak(x = ";")
                }
            }
        }
    }

    private inner class JavaExpressionPrinter : IrExpressionVisitor<Unit> {

        private fun IrExpression.printSelf(withParenthesis: Boolean = false): Unit =
            if (withParenthesis) {
                printer.printlnWithoutFurtherIndentation {
                    printWithoutBreak(x = "(")
                    printSelf()
                    print(x = ")", requireBreak = false)
                }
            } else accept(visitor = this@JavaExpressionPrinter)

        override fun visit(expression: Literal) {
            val literalString = when (val literal = expression.literal) {
                samlang.ast.common.Literal.UnitLiteral -> "null"
                is samlang.ast.common.Literal.IntLiteral -> "${literal.value}L"
                else -> literal.prettyPrintedValue
            }
            printer.printWithoutBreak(x = literalString)
        }

        override fun visit(expression: Variable) {
            printer.printWithoutBreak(x = expression.name)
        }

        override fun visit(expression: This) {
            printer.printWithoutBreak(x = "this")
        }

        override fun visit(expression: ClassMember) {
            printer.printWithoutBreak(x = "${expression.className}::${expression.memberName}")
        }

        override fun visit(expression: TupleConstructor) {
            val expressions = expression.expressionList
            printer.printWithoutBreak(x = "new SamlangIntrinsics\$Tuple${expressions.size}<")
            printer.printWithoutBreak(
                x = expressions.joinToString(separator = ", ") { it.type.toJavaTypeString(boxed = true) }
            )
            printer.printWithoutBreak(x = ">(")
            val size = expressions.size
            for (i in 0 until size) {
                printExpression(expression = expressions[i])
                if (i < size - 1) {
                    printer.printWithoutBreak(x = ", ")
                }
            }
            printer.printWithoutBreak(x = ")")
        }

        override fun visit(expression: ObjectConstructor) {
            val (type, spreadExpression, fieldDeclaration) = expression
            val builderConstructorString =
                IdentifierType(identifier = "Builder", typeArguments = type.typeArguments).toJavaTypeString()
            printer.printWithoutBreak(x = "new ${type.identifier}$$builderConstructorString(")
            if (spreadExpression == null) {
                printer.printWithoutBreak(x = "null")
            } else {
                printExpression(expression = spreadExpression)
            }
            printer.printWithoutBreak(x = ")")
            fieldDeclaration.forEach { (name, fieldExpression) ->
                printer.printWithoutBreak(x = ".set${CaseUtils.toCamelCase(name, true)}(")
                printExpression(expression = fieldExpression)
                printer.printWithoutBreak(x = ")")
            }
            printer.printWithoutBreak(x = ".build()")
        }

        override fun visit(expression: VariantConstructor) {
            val (identifier, typeArguments) = expression.type
            val innerConstructorString =
                IdentifierType(identifier = expression.tag, typeArguments = typeArguments).toJavaTypeString()
            printer.printWithoutBreak(x = "new $identifier.$innerConstructorString(")
            printExpression(expression = expression.data)
            printer.printWithoutBreak(x = ")")
        }

        override fun visit(expression: FieldAccess) {
            printer.printlnWithoutFurtherIndentation {
                expression.expression.printSelf(
                    withParenthesis = expression.expression.precedence >= expression.precedence
                )
                printWithoutBreak(x = ".${expression.fieldName}")
            }
        }

        override fun visit(expression: MethodAccess) {
            printer.printlnWithoutFurtherIndentation {
                expression.expression.printSelf(
                    withParenthesis = expression.expression.precedence >= expression.precedence
                )
                printWithoutBreak(x = "::${expression.methodName}")
            }
        }

        override fun visit(expression: Unary) {
            printer.printlnWithoutFurtherIndentation {
                printWithoutBreak(x = expression.operator.symbol)
                expression.expression.printSelf(
                    withParenthesis = expression.expression.precedence > expression.precedence
                )
            }
        }

        private fun printFunctionCallArguments(arguments: List<IrExpression>) {
            printer.printWithoutBreak(x = "(")
            arguments.forEachIndexed { index, e ->
                e.printSelf()
                if (index != arguments.size - 1) {
                    printer.printWithBreak(x = ",")
                }
            }
            printer.printWithoutBreak(x = ")")
        }

        override fun visit(expression: FunctionApplication) {
            printer.printlnWithoutFurtherIndentation {
                val (_, functionExpression, arguments) = expression
                when (functionExpression) {
                    is ClassMember -> {
                        printWithoutBreak(x = "${functionExpression.className}.${functionExpression.memberName}")
                        printFunctionCallArguments(arguments = arguments)
                    }
                    is MethodAccess -> {
                        functionExpression.expression.printSelf(
                            withParenthesis = functionExpression.expression.precedence >= expression.precedence
                        )
                        printWithoutBreak(x = ".${functionExpression.methodName}")
                        printFunctionCallArguments(arguments = arguments)
                    }
                    else -> {
                        functionExpression.printSelf(
                            withParenthesis = expression.functionExpression.precedence >= expression.precedence
                        )
                        printFunctionCallArguments(arguments = arguments)
                    }
                }
            }
        }

        override fun visit(expression: Binary) {
            expression.e1.printSelf(withParenthesis = expression.e1.precedence >= expression.precedence)
            printer.printWithoutBreak(x = " ${expression.operator.symbol} ")
            expression.e2.printSelf(withParenthesis = expression.e2.precedence >= expression.precedence)
        }

        override fun visit(expression: Ternary) {
            printer.printlnWithoutFurtherIndentation {
                expression.boolExpression.printSelf(
                    withParenthesis = expression.boolExpression.precedence >= expression.precedence
                )
                printWithoutBreak(x = " ? ")
                expression.e1.printSelf(withParenthesis = expression.e1.precedence >= expression.precedence)
                printWithoutBreak(x = " : ")
                expression.e2.printSelf(withParenthesis = expression.e2.precedence >= expression.precedence)
            }
        }

        override fun visit(expression: Lambda) {
            val parameterString =
                expression.parameters.joinToString(separator = ", ", prefix = "(", postfix = ")") { (name, type) ->
                    "$name: ${type.toJavaTypeString(boxed = true)}"
                }
            printer.printlnWithoutFurtherIndentation {
                printWithoutBreak(x = parameterString)
                printWithoutBreak(x = " -> {")
                expression.body.forEach(action = ::printStatement)
                printWithoutBreak(x = "}")
            }
        }
    }
}

private fun Type.toJavaTypeString(boxed: Boolean = false): String =
    this.accept(visitor = JavaContextAwareTypeToStringConverter, context = boxed)

/**
 * Context: whether the primitive type should be boxed.
 * Return: converted type string in Java syntax.
 */
private object JavaContextAwareTypeToStringConverter : TypeVisitor<Boolean, String> {

    private fun Type.toBoxedString(): String =
        this.accept(visitor = this@JavaContextAwareTypeToStringConverter, context = true)

    override fun visit(type: PrimitiveType, context: Boolean): String = when (type.name) {
        Type.PrimitiveTypeName.UNIT -> if (context) "Void" else "void"
        Type.PrimitiveTypeName.BOOL -> if (context) "Boolean" else "boolean"
        Type.PrimitiveTypeName.INT -> if (context) "Long" else "long"
        Type.PrimitiveTypeName.STRING -> "String"
    }

    override fun visit(type: IdentifierType, context: Boolean): String = type.typeArguments
        .takeIf { it.isNotEmpty() }
        ?.joinToString(separator = ", ", prefix = "${type.identifier}<", postfix = ">") { it.toBoxedString() }
        ?: type.identifier

    override fun visit(type: TupleType, context: Boolean): String {
        val mappings = type.mappings
        val size = mappings.size
        if (size > 22) {
            TODO("Enforce tuple mapping size limit.")
        }
        return mappings.joinToString(separator = ", ", prefix = "SamlangIntrinsics\$Tuple$size<", postfix = ">") {
            it.toBoxedString()
        }
    }

    override fun visit(type: FunctionType, context: Boolean): String {
        val (argumentTypes, returnType) = type
        val size = argumentTypes.size
        if (size > 22) {
            TODO("Enforce argument type size limit.")
        }
        return argumentTypes.joinToString(
            separator = ", ",
            prefix = "SamlangIntrinsics\$Function$size<",
            postfix = ", ${returnType.toBoxedString()}>"
        ) { it.toBoxedString() }
    }

    override fun visit(type: UndecidedType, context: Boolean): String =
        error(message = "There should be no undecided type at this point!")
}