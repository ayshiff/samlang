package samlang.errors

import samlang.ast.common.Range

class CollisionError(collidedName: String, range: Range) : CompileTimeError.WithRange(
    reason = "Name `$collidedName` collides with a previously defined name.",
    range = range
)