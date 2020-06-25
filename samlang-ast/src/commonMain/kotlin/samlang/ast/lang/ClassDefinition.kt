package samlang.ast.lang

import samlang.ast.common.Range
import samlang.ast.common.Type
import samlang.ast.common.TypeDefinition

data class ClassDefinition(
    override val range: Range,
    override val nameRange: Range,
    override val name: String,
    override val isPublic: Boolean,
    val typeDefinition: TypeDefinition,
    override val members: List<MemberDefinition>
) : ClassInterface<ClassDefinition.MemberDefinition> {

    data class MemberDefinition(
        override val range: Range,
        override val isPublic: Boolean,
        override val isMethod: Boolean,
        override val nameRange: Range,
        override val name: String,
        override val typeParameters: List<String>,
        override val type: Type.FunctionType,
        override val parameters: List<AnnotatedParameter>,
        val body: Expression
    ) : ClassMemberInterface
}
