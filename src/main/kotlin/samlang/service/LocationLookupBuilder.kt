package samlang.service

import samlang.ast.common.Location
import samlang.ast.common.ModuleReference
import samlang.ast.lang.Expression
import samlang.ast.lang.Expression.Binary
import samlang.ast.lang.Expression.ClassMember
import samlang.ast.lang.Expression.FieldAccess
import samlang.ast.lang.Expression.FunctionApplication
import samlang.ast.lang.Expression.IfElse
import samlang.ast.lang.Expression.Lambda
import samlang.ast.lang.Expression.Literal
import samlang.ast.lang.Expression.Match
import samlang.ast.lang.Expression.MethodAccess
import samlang.ast.lang.Expression.ObjectConstructor
import samlang.ast.lang.Expression.Panic
import samlang.ast.lang.Expression.This
import samlang.ast.lang.Expression.TupleConstructor
import samlang.ast.lang.Expression.Unary
import samlang.ast.lang.Expression.Val
import samlang.ast.lang.Expression.Variable
import samlang.ast.lang.Expression.VariantConstructor
import samlang.ast.lang.ExpressionVisitor
import samlang.ast.lang.Module

class LocationLookupBuilder(val locationLookup: LocationLookup<Expression>) {
    fun rebuild(moduleReference: ModuleReference, module: Module) {
        locationLookup.purge(moduleReference = moduleReference)
        val visitor = BuildLocationLookupVisitor(moduleReference = moduleReference)
        module.classDefinitions.forEach { classDefinition ->
            classDefinition.members.forEach { member ->
                member.body.accept(visitor = visitor, context = Unit)
            }
        }
    }

    private inner class BuildLocationLookupVisitor(
        private val moduleReference: ModuleReference
    ) : ExpressionVisitor<Unit, Unit> {
        override fun visit(expression: Literal, context: Unit): Unit = build(expression = expression)

        override fun visit(expression: This, context: Unit): Unit = build(expression = expression)

        override fun visit(expression: Variable, context: Unit): Unit = build(expression = expression)

        override fun visit(expression: ClassMember, context: Unit): Unit = build(expression = expression)

        override fun visit(expression: TupleConstructor, context: Unit) {
            expression.expressionList.forEach { it.buildRecursively() }
            build(expression = expression)
        }

        override fun visit(expression: ObjectConstructor, context: Unit) {
            expression.fieldDeclarations.forEach { oneDeclaration ->
                when (oneDeclaration) {
                    is ObjectConstructor.FieldConstructor.Field -> oneDeclaration.expression.buildRecursively()
                    is ObjectConstructor.FieldConstructor.FieldShorthand -> {
                        build(
                            expression = Variable(
                                range = oneDeclaration.range, type = oneDeclaration.type, name = oneDeclaration.name
                            )
                        )
                    }
                }
            }
            build(expression = expression)
        }

        override fun visit(expression: VariantConstructor, context: Unit) {
            expression.data.buildRecursively()
            build(expression = expression)
        }

        override fun visit(expression: FieldAccess, context: Unit) {
            expression.expression.buildRecursively()
            build(expression = expression)
        }

        override fun visit(expression: MethodAccess, context: Unit) {
            expression.expression.buildRecursively()
            build(expression = expression)
        }

        override fun visit(expression: Unary, context: Unit) {
            expression.expression.buildRecursively()
            build(expression = expression)
        }

        override fun visit(expression: Panic, context: Unit) {
            expression.expression.buildRecursively()
            build(expression = expression)
        }

        override fun visit(expression: FunctionApplication, context: Unit) {
            expression.functionExpression.buildRecursively()
            expression.arguments.forEach { it.buildRecursively() }
            build(expression = expression)
        }

        override fun visit(expression: Binary, context: Unit) {
            expression.e1.buildRecursively()
            expression.e2.buildRecursively()
            build(expression = expression)
        }

        override fun visit(expression: IfElse, context: Unit) {
            expression.boolExpression.buildRecursively()
            expression.e1.buildRecursively()
            expression.e2.buildRecursively()
            build(expression = expression)
        }

        override fun visit(expression: Match, context: Unit) {
            expression.matchedExpression.buildRecursively()
            expression.matchingList.forEach { item ->
                item.expression.buildRecursively()
            }
            build(expression = expression)
        }

        override fun visit(expression: Lambda, context: Unit) {
            expression.body.buildRecursively()
            build(expression = expression)
        }

        override fun visit(expression: Val, context: Unit) {
            expression.assignedExpression.buildRecursively()
            expression.nextExpression?.buildRecursively()
            build(expression = expression)
        }

        private fun Expression.buildRecursively() {
            accept(visitor = this@BuildLocationLookupVisitor, context = Unit)
        }

        private fun build(expression: Expression) {
            locationLookup[Location(moduleReference = moduleReference, range = expression.range)] = expression
        }
    }
}