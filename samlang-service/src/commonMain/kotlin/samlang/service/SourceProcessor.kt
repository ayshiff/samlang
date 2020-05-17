package samlang.service

import samlang.ast.common.ModuleReference
import samlang.ast.common.Sources
import samlang.ast.lang.Module
import samlang.checker.ErrorCollector
import samlang.checker.typeCheckSources
import samlang.errors.CompileTimeError
import samlang.parser.buildModuleFromText

fun checkSources(sourceHandles: List<Pair<ModuleReference, String>>): Pair<Sources<Module>, List<CompileTimeError>> {
    val errorCollector = ErrorCollector()
    val moduleMappings = mutableMapOf<ModuleReference, Module>()
    for ((moduleReference, text) in sourceHandles) {
        val (module, parseErrors) = buildModuleFromText(moduleReference = moduleReference, text = text)
        parseErrors.forEach { errorCollector.add(compileTimeError = it) }
        moduleMappings[moduleReference] = module
    }
    val (checkedSources, _) = typeCheckSources(
        sources = Sources(moduleMappings = moduleMappings),
        errorCollector = errorCollector
    )
    return checkedSources to errorCollector.collectedErrors
}