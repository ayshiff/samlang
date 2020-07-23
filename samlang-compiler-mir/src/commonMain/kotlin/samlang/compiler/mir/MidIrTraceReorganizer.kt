package samlang.compiler.mir

import kotlinx.collections.immutable.PersistentSet
import kotlinx.collections.immutable.toPersistentSet
import samlang.ast.mir.MidIrStatement
import samlang.ast.mir.MidIrStatement.Companion.CJUMP_FALLTHROUGH
import samlang.ast.mir.MidIrStatement.ConditionalJump
import samlang.ast.mir.MidIrStatement.Jump
import samlang.ast.mir.MidIrStatement.Return

/** The utility class used to reorganize the traces. */
internal object MidIrTraceReorganizer {
    /** @return list contains the optimized order of the starting labels. */
    private fun buildTrace(basicBlocks: List<BasicBlock>): List<BasicBlock> {
        val reorderedBlockLabelSet = mutableSetOf<String>()
        val reorderedBlocks = mutableListOf<BasicBlock>()
        // start building the trace at 0 because that's where function starts.
        basicBlocks.forEach { blockToStart ->
            if (blockToStart.label in reorderedBlockLabelSet) {
                return@forEach
            }
            val stack = buildTrace(
                block = blockToStart,
                visited = reorderedBlockLabelSet.toPersistentSet(),
                memoizedResult = mutableMapOf()
            ) ?: error(message = "Impossible!")
            val tempList = stack.toReversedOrderedCollection()
            reorderedBlockLabelSet.addAll(tempList.map { it.label })
            reorderedBlocks += tempList
        }
        return reorderedBlocks
    }

    private fun buildTrace(
        block: BasicBlock,
        visited: PersistentSet<String>,
        memoizedResult: MutableMap<String, SizedImmutableStack<BasicBlock>>
    ): SizedImmutableStack<BasicBlock>? {
        if (visited.contains(block.label)) {
            return null
        }
        val optimal = memoizedResult[block.label]
        if (optimal != null) {
            return optimal
        }
        val newVisited = visited.add(element = block.label)
        var bestTrace = SizedImmutableStack<BasicBlock> { it.instructions.size }
        val targetBlocks = block.targets
        for (nextBlock in targetBlocks) {
            val fullTrace = buildTrace(
                block = nextBlock,
                visited = newVisited,
                memoizedResult = memoizedResult
            )
            if (fullTrace != null) {
                if (fullTrace.size > bestTrace.size) {
                    bestTrace = fullTrace
                }
            }
        }
        val knownOptimal = bestTrace.plus(block)
        memoizedResult[block.label] = knownOptimal
        return knownOptimal
    }

    /**
     * Fix the block control flow graph inconsistencies caused by reordering.
     *
     * Potential things to fix:
     * - Jump is no longer necessary due to reordering
     * - Jump is missing due to reordering
     * - Canonicalize CJUMP to CJUMP_FALLTHROUGH
     */
    private fun emitStatements(reorderedBlocks: List<BasicBlock>): List<MidIrStatement> {
        val fixedStatements = mutableListOf<MidIrStatement>()
        val len = reorderedBlocks.size
        // remove redundant jumps, added needed jump
        for (i in 0 until len) {
            val currentBlock = reorderedBlocks[i]
            val lastStatement = currentBlock.lastStatement
            val traceImmediateNext = if (i < len - 1) reorderedBlocks[i + 1].label else null
            when (lastStatement) {
                is Jump -> {
                    val actualJumpTarget = lastStatement.label
                    fixedStatements += if (actualJumpTarget != traceImmediateNext) {
                        // jump is necessary, keep it
                        currentBlock.instructions
                    } else {
                        // remove the jump
                        currentBlock.instructions.dropLast(n = 1)
                    }
                }
                is ConditionalJump -> {
                    val (condition1, actualTrueTarget, actualFalseTarget) = lastStatement
                    // setup previous unchanged instructions
                    val newInstructions = currentBlock.instructions.dropLast(n = 1).toMutableList()
                    when {
                        actualTrueTarget == traceImmediateNext -> {
                            // need to invert condition
                            val condition = MidIrTransformUtil.invertCondition(condition1)
                            newInstructions += CJUMP_FALLTHROUGH(condition, actualFalseTarget)
                        }
                        actualFalseTarget == traceImmediateNext -> {
                            // nice! we can make it fall through!
                            newInstructions += CJUMP_FALLTHROUGH(condition1, actualTrueTarget)
                        }
                        else -> {
                            newInstructions += CJUMP_FALLTHROUGH(condition1, actualTrueTarget)
                            // force jump to false target
                            newInstructions += Jump(actualTrueTarget)
                        }
                    }
                    fixedStatements += newInstructions
                }
                is Return -> fixedStatements += currentBlock.instructions // no problem
                else -> error(message = "Bad instruction type: ${lastStatement::class}")
            }
        }
        return fixedStatements
    }

    /**
     * Reorder the statements to fix the control for LOW IR.
     *
     * @param allocator the allocator used to allocate new temp labels
     * @param originalStatements original list of statements.
     * @return the reordered and fixed statements.
     */
     fun reorder(allocator: MidIrResourceAllocator, originalStatements: List<MidIrStatement>): List<MidIrStatement> =
        emitStatements(buildTrace(BasicBlock.from(allocator, originalStatements)))
}
