import { AbstractParseTreeVisitor } from 'antlr4ts/tree/AbstractParseTreeVisitor';

import { classInterfaceBuilder, ClassDefinitionBuilder } from './parser-class-builder';
import { tokenRange, contextRange } from './parser-util';

import { ModuleReference } from 'samlang-core-ast/common-nodes';
import type {
  ClassDefinition,
  ModuleMembersImport,
  SamlangModule,
} from 'samlang-core-ast/samlang-toplevel';
import type { ModuleErrorCollector } from 'samlang-core-errors';
import type {
  ModuleContext,
  ImportModuleMembersContext,
  ClassAsModuleMemberContext,
  InterfaceAsModuleMemberContext,
} from 'samlang-core-parser-generated/PLParser';
import type { PLVisitor } from 'samlang-core-parser-generated/PLVisitor';
import { isNotNull, assertNotNull } from 'samlang-core-utils';

class ModuleMemberVisitor
  extends AbstractParseTreeVisitor<ClassDefinition | null>
  implements PLVisitor<ClassDefinition | null> {
  // istanbul ignore next
  defaultResult = (): ClassDefinition | null => null;

  private readonly classBuilder: ClassDefinitionBuilder;

  constructor(errorCollector: ModuleErrorCollector) {
    super();
    this.classBuilder = new ClassDefinitionBuilder(errorCollector);
  }

  visitClassAsModuleMember = (ctx: ClassAsModuleMemberContext): ClassDefinition | null =>
    ctx.clazz().accept(this.classBuilder);

  visitInterfaceAsModuleMember = (ctx: InterfaceAsModuleMemberContext): ClassDefinition | null =>
    // TODO widen the type
    ctx.interfaze().accept(classInterfaceBuilder) as ClassDefinition;
}

export default class ModuleVisitor
  extends AbstractParseTreeVisitor<SamlangModule>
  implements PLVisitor<SamlangModule> {
  private readonly moduleMemberVisitor: ModuleMemberVisitor;

  constructor(errorCollector: ModuleErrorCollector) {
    super();
    this.moduleMemberVisitor = new ModuleMemberVisitor(errorCollector);
  }

  // istanbul ignore next
  defaultResult = (): SamlangModule => ({ imports: [], classes: [] });

  private buildModuleMembersImport = (ctx: ImportModuleMembersContext): ModuleMembersImport => ({
    range: contextRange(ctx),
    importedMembers: ctx
      .UpperId()
      .map((node) => {
        const symbol = node.symbol;
        const name = symbol.text;
        assertNotNull(name);
        return [name, tokenRange(symbol)] as const;
      })
      .filter(isNotNull),
    importedModule: new ModuleReference(
      ctx
        .moduleReference()
        .UpperId()
        .map((it) => it.text)
        .filter(isNotNull)
    ),
    importedModuleRange: contextRange(ctx.moduleReference()),
  });

  visitModule = (ctx: ModuleContext): SamlangModule => ({
    imports: ctx.importModuleMembers().map(this.buildModuleMembersImport),
    classes: ctx
      .moduleMember()
      .map((it) => it.accept(this.moduleMemberVisitor))
      .filter(isNotNull),
  });
}
