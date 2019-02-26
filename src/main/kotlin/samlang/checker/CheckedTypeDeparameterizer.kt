package samlang.checker

import samlang.ast.checked.CheckedTypeExpr
import samlang.ast.checked.CheckedTypeExpr.*
import samlang.ast.checked.CheckedTypeExprVisitor

/**
 * Force a parameterized type into a non-parameterized one by making each generic type as undecided type.
 */
internal object CheckedTypeDeparameterizer {

    fun convert(
        typeExpr: CheckedTypeExpr,
        typeParams: List<String>,
        manager: UndecidedTypeManager
    ): Pair<CheckedTypeExpr, List<UndecidedType>> {
        val len = typeParams.size
        val autoGeneratedUndecidedTypes = manager.allocateUndecidedTypes(amount = len)
        val replacementMap = typeParams.zip(other = autoGeneratedUndecidedTypes).toMap()
        return typeExpr.accept(visitor = Visitor, context = replacementMap) to autoGeneratedUndecidedTypes
    }

    fun convert(
        typeMappings: Map<String, CheckedTypeExpr>,
        typeParams: List<String>,
        manager: UndecidedTypeManager
    ): Pair<Map<String, CheckedTypeExpr>, List<UndecidedType>> {
        val len = typeParams.size
        val autoGeneratedUndecidedTypes = manager.allocateUndecidedTypes(amount = len)
        val replacementMap = typeParams.zip(other = autoGeneratedUndecidedTypes).toMap()
        val newTypeMappings = typeMappings.mapValues { (_, v) -> v.accept(visitor = Visitor, context = replacementMap) }
        return newTypeMappings to autoGeneratedUndecidedTypes
    }

    private object Visitor : CheckedTypeExprVisitor<Map<String, UndecidedType>, CheckedTypeExpr> {

        override fun visit(typeExpr: UnitType, context: Map<String, UndecidedType>): CheckedTypeExpr = typeExpr
        override fun visit(typeExpr: IntType, context: Map<String, UndecidedType>): CheckedTypeExpr = typeExpr
        override fun visit(typeExpr: StringType, context: Map<String, UndecidedType>): CheckedTypeExpr = typeExpr
        override fun visit(typeExpr: BoolType, context: Map<String, UndecidedType>): CheckedTypeExpr = typeExpr

        private fun CheckedTypeExpr.convert(context: Map<String, UndecidedType>): CheckedTypeExpr =
            accept(visitor = Visitor, context = context)

        override fun visit(typeExpr: IdentifierType, context: Map<String, UndecidedType>): CheckedTypeExpr =
            if (typeExpr.typeArgs != null) {
                typeExpr
            } else {
                context[typeExpr.identifier] ?: typeExpr
            }

        override fun visit(typeExpr: TupleType, context: Map<String, UndecidedType>): CheckedTypeExpr =
            TupleType(mappings = typeExpr.mappings.map { it.convert(context = context) })

        override fun visit(typeExpr: FunctionType, context: Map<String, UndecidedType>): CheckedTypeExpr =
            FunctionType(
                argumentTypes = typeExpr.argumentTypes.map { it.convert(context = context) },
                returnType = typeExpr.returnType.convert(context = context)
            )

        override fun visit(typeExpr: UndecidedType, context: Map<String, UndecidedType>): CheckedTypeExpr =
            error(message = "The type expr should not contain undecided type since it's the type of a module member.")

        override fun visit(typeExpr: FreeType, context: Map<String, UndecidedType>): CheckedTypeExpr =
            error(message = "The type expr should not contain free type since it's the type of a module member.")

    }
}