package samlang.interpreter

import org.apache.commons.text.StringEscapeUtils
import samlang.ast.checked.CheckedExpr

sealed class Value {

    /*
     * --------------------------------------------------------------------------------
     * Part 1: Primitive Values
     * --------------------------------------------------------------------------------
     */

    object UnitValue : Value() {
        override fun toString(): String = "unit"
    }

    data class IntValue(val v: Long) : Value() {
        override fun toString(): String = v.toString()
    }

    data class StringValue(val v: String) : Value() {
        override fun toString(): String = "\"${StringEscapeUtils.escapeJava(v)}\""
    }

    data class BoolValue(val v: Boolean) : Value() {
        override fun toString(): String = v.toString()
    }

    /*
     * --------------------------------------------------------------------------------
     * Part 2: Compound Values
     * --------------------------------------------------------------------------------
     */

    data class TupleValue(val tupleContent: List<Value>) : Value() {
        override fun toString(): String = tupleContent.joinToString(separator = ", ", prefix = "[", postfix = "]")
    }

    data class ObjectValue(val objectContent: Map<String, Value>) : Value() {
        override fun toString(): String = objectContent.entries.joinToString(
            separator = ", ", prefix = "{ ", postfix = " }"
        ) { (k, v) -> "$k: $v" }
    }

    data class VariantValue(val tag: String, val data: Value) : Value() {
        override fun toString(): String = "$tag($data)"
    }

    /*
     * --------------------------------------------------------------------------------
     * Part 3: Special Values
     * --------------------------------------------------------------------------------
     */

    data class FunctionValue(
        internal val arguments: List<String>,
        internal val body: CheckedExpr,
        internal var context: InterpretationContext
    ) : Value() {
        override fun toString(): String = "function"
    }

}
