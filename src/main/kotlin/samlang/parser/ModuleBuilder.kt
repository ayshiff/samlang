package samlang.parser

import org.antlr.v4.runtime.ANTLRInputStream
import org.antlr.v4.runtime.CommonTokenStream
import samlang.ast.Module
import samlang.ast.ModuleMembersImport
import samlang.ast.ModuleReference
import samlang.errors.MissingFileError
import samlang.parser.generated.PLBaseVisitor
import samlang.parser.generated.PLLexer
import samlang.parser.generated.PLParser
import samlang.util.createSourceOrFail
import java.io.File
import java.io.InputStream

object ModuleBuilder {

    private fun buildModule(inputStream: InputStream): Module {
        val parser = PLParser(CommonTokenStream(PLLexer(ANTLRInputStream(inputStream))))
        val errorListener = SyntaxErrorListener()
        parser.removeErrorListeners()
        parser.addErrorListener(errorListener)
        val sourceVisitor = Visitor(syntaxErrorListener = errorListener)
        val moduleContext = parser.module()
        val module = moduleContext.accept(sourceVisitor)
        val errors = errorListener.syntaxErrors
        return createSourceOrFail(module = module, errors = errors)
    }

    fun buildModuleFromSingleFile(fileDir: String): Module =
        File(fileDir)
            .takeIf { it.isFile }
            ?.let { buildModule(inputStream = it.inputStream()) }
            ?: throw MissingFileError(filename = fileDir)

    fun buildModuleFromText(text: String): Module = buildModule(inputStream = text.byteInputStream())

    private class Visitor(syntaxErrorListener: SyntaxErrorListener) : PLBaseVisitor<Module>() {

        private val classBuilder: ClassBuilder = ClassBuilder(syntaxErrorListener = syntaxErrorListener)

        private fun buildModuleReference(ctx: PLParser.ModuleReferenceContext): ModuleReference =
            ModuleReference(range = ctx.range, parts = ctx.UpperId().map { it.text })

        private fun buildModuleMembersImport(ctx: PLParser.ImportModuleMembersContext): ModuleMembersImport =
            ModuleMembersImport(
                range = ctx.range,
                moduleReference = buildModuleReference(ctx = ctx.moduleReference()),
                importedMembers = ctx.LowerId().map { node ->
                    val symbol = node.symbol
                    symbol.text to symbol.range
                }
            )

        override fun visitModule(ctx: PLParser.ModuleContext): Module =
            Module(
                imports = ctx.importModuleMembers().map(transform = ::buildModuleMembersImport),
                classDefinitions = ctx.clazz().map { it.accept(classBuilder) }
            )
    }
}
