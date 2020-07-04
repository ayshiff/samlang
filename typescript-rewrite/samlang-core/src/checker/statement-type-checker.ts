import type { FieldType } from '../ast/common/structs';
import { Type, unitType } from '../ast/common/types';
import {
  SamlangExpression,
  SamlangValStatement,
  StatementBlock,
  EXPRESSION_PANIC,
  EXPRESSION_STRING,
} from '../ast/lang/samlang-expressions';
import type { Pattern, ObjectPatternDestucturedName } from '../ast/lang/samlang-pattern';
import type { ModuleErrorCollector } from '../errors/error-collector';
import { isNotNull, assertNotNull } from '../util/type-assertions';
import type { AccessibleGlobalTypingContext, LocalTypingContext } from './typing-context';

export default class StatementTypeChecker {
  constructor(
    private readonly accessibleGlobalTypingContext: AccessibleGlobalTypingContext,
    private readonly errorCollector: ModuleErrorCollector,
    private readonly typeCheckExpression: (
      expression: SamlangExpression,
      expectedType: Type
    ) => SamlangExpression
  ) {}

  readonly typeCheck = (
    { range, statements, expression }: StatementBlock,
    expectedType: Type,
    localContext: LocalTypingContext
  ): StatementBlock =>
    localContext.withNestedScope(() => {
      const checkedStatements = statements.map((statement) =>
        this.typeCheckValStatement(statement, localContext)
      );
      let checkedExpression: SamlangExpression | undefined;
      if (expression != null) {
        checkedExpression = this.typeCheckExpression(expression, expectedType);
      } else {
        // Force the type checker to resolve expected type to unit.
        this.typeCheckExpression(
          EXPRESSION_PANIC({ range, type: unitType, expression: EXPRESSION_STRING(range, '') }),
          expectedType
        );
        checkedExpression = undefined;
      }
      return { range, statements: checkedStatements, expression: checkedExpression };
    });

  private typeCheckValStatement(
    statement: SamlangValStatement,
    localContext: LocalTypingContext
  ): SamlangValStatement {
    const { range, pattern, typeAnnotation, assignedExpression } = statement;
    const checkedAssignedExpression = this.typeCheckExpression(assignedExpression, typeAnnotation);
    const checkedAssignedExpressionType = checkedAssignedExpression.type;
    let checkedPattern: Pattern;
    switch (pattern.type) {
      case 'TuplePattern': {
        if (checkedAssignedExpressionType.type !== 'TupleType') {
          this.errorCollector.reportUnexpectedTypeKindError(
            assignedExpression.range,
            'tuple',
            checkedAssignedExpressionType
          );
          return {
            ...statement,
            typeAnnotation: assignedExpression.type,
            assignedExpression: checkedAssignedExpression,
          };
        }
        const expectedSize = checkedAssignedExpressionType.mappings.length;
        const actualSize = pattern.destructedNames.length;
        if (expectedSize !== actualSize) {
          this.errorCollector.reportTupleSizeMismatchError(
            assignedExpression.range,
            expectedSize,
            actualSize
          );
        }
        pattern.destructedNames
          .map(([name, nameRange], index) => {
            return name == null
              ? null
              : ([name, nameRange, checkedAssignedExpressionType.mappings[index]] as const);
          })
          .filter(isNotNull)
          .forEach(([name, nameRange, elementType]) => {
            localContext.addLocalValueType(name, elementType, () =>
              this.errorCollector.reportCollisionError(nameRange, name)
            );
          });
        checkedPattern = pattern;
        break;
      }

      case 'ObjectPattern': {
        if (checkedAssignedExpressionType.type !== 'IdentifierType') {
          this.errorCollector.reportUnexpectedTypeKindError(
            assignedExpression.range,
            'identifier',
            checkedAssignedExpressionType
          );
          return {
            ...statement,
            typeAnnotation: assignedExpression.type,
            assignedExpression: checkedAssignedExpression,
          };
        }
        const fieldMappingsOrError = this.accessibleGlobalTypingContext.resolveTypeDefinition(
          checkedAssignedExpressionType,
          'object'
        );
        let fieldNamesMappings: {
          readonly fieldNames: readonly string[];
          readonly fieldMappings: Readonly<Record<string, FieldType | undefined>>;
        };
        switch (fieldMappingsOrError.type) {
          case 'Resolved':
            fieldNamesMappings = {
              fieldNames: fieldMappingsOrError.names,
              fieldMappings: fieldMappingsOrError.mappings,
            };
            break;
          // istanbul ignore next
          case 'IllegalOtherClassMatch':
            // istanbul ignore next
            throw new Error('We match on objects here, so this case is impossible.');
          case 'UnsupportedClassTypeDefinition':
            this.errorCollector.reportUnsupportedClassTypeDefinitionError(
              assignedExpression.range,
              'object'
            );
            return {
              ...statement,
              typeAnnotation: assignedExpression.type,
              assignedExpression: checkedAssignedExpression,
            };
          case 'TypeParamSizeMismatch':
            this.errorCollector.reportTypeParameterSizeMismatchError(
              assignedExpression.range,
              fieldMappingsOrError.expected,
              fieldMappingsOrError.actual
            );
            return {
              ...statement,
              typeAnnotation: assignedExpression.type,
              assignedExpression: checkedAssignedExpression,
            };
        }
        const { fieldNames, fieldMappings } = fieldNamesMappings;
        const fieldOrderMapping = Object.fromEntries(
          fieldNames.map((name, index) => [name, index])
        );
        const destructedNames: ObjectPatternDestucturedName[] = [];
        for (let i = 0; i < pattern.destructedNames.length; i += 1) {
          const destructedName: ObjectPatternDestucturedName = pattern.destructedNames[i];
          const { fieldName: originalName, alias: renamedName, range: fieldRange } = destructedName;
          const fieldInformation = fieldMappings[originalName];
          if (fieldInformation == null) {
            this.errorCollector.reportUnresolvedNameError(fieldRange, originalName);
            return {
              ...statement,
              typeAnnotation: assignedExpression.type,
              assignedExpression: checkedAssignedExpression,
            };
          }
          const { isPublic, type: fieldType } = fieldInformation;
          if (
            checkedAssignedExpressionType.identifier !==
              this.accessibleGlobalTypingContext.currentClass &&
            !isPublic
          ) {
            this.errorCollector.reportUnresolvedNameError(fieldRange, originalName);
            return {
              ...statement,
              typeAnnotation: assignedExpression.type,
              assignedExpression: checkedAssignedExpression,
            };
          }
          const nameToBeUsed = renamedName ?? originalName;
          localContext.addLocalValueType(nameToBeUsed, fieldType, () =>
            this.errorCollector.reportCollisionError(fieldRange, nameToBeUsed)
          );
          const fieldOrder = fieldOrderMapping[originalName];
          assertNotNull(fieldOrder);
          destructedNames.push({ ...destructedName, fieldOrder });
        }
        checkedPattern = { range, type: 'ObjectPattern', destructedNames };
        break;
      }

      case 'VariablePattern':
        localContext.addLocalValueType(pattern.name, checkedAssignedExpressionType, () =>
          this.errorCollector.reportCollisionError(pattern.range, pattern.name)
        );
        checkedPattern = pattern;
        break;

      case 'WildCardPattern':
        checkedPattern = pattern;
        break;
    }
    return {
      ...statement,
      typeAnnotation: assignedExpression.type,
      assignedExpression: checkedAssignedExpression,
      pattern: checkedPattern,
    };
  }
}
