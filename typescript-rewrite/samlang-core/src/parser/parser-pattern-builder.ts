import { AbstractParseTreeVisitor } from 'antlr4ts/tree/AbstractParseTreeVisitor';

import type {
  Pattern,
  TuplePattern,
  ObjectPattern,
  ObjectPatternDestucturedName,
  VariablePattern,
  WildCardPattern,
} from '../ast/lang/samlang-pattern';
import {
  TuplePatternContext,
  ObjectPatternContext,
  RawVarContext,
  RenamedVarContext,
  VariablePatternContext,
  WildcardPatternContext,
} from './generated/PLParser';
import { PLVisitor } from './generated/PLVisitor';
import { tokenRange, contextRange } from './parser-util';

class FieldNameBuilder extends AbstractParseTreeVisitor<ObjectPatternDestucturedName | null>
  implements PLVisitor<ObjectPatternDestucturedName | null> {
  // istanbul ignore next
  defaultResult = (): ObjectPatternDestucturedName | null => null;

  visitRawVar = (ctx: RawVarContext): ObjectPatternDestucturedName | null => {
    const symbol = ctx.LowerId().symbol;
    const fieldName = symbol.text;
    // istanbul ignore next
    if (fieldName == null) {
      // istanbul ignore next
      return null;
    }
    return { fieldName, fieldOrder: -1, range: tokenRange(symbol) };
  };

  visitRenamedVar = (ctx: RenamedVarContext): ObjectPatternDestucturedName | null => {
    const idList = ctx.LowerId();
    const fieldName = idList[0].symbol.text;
    // istanbul ignore next
    if (fieldName == null) {
      // istanbul ignore next
      return null;
    }
    const alias = idList[1].symbol.text;
    // istanbul ignore next
    if (alias == null) {
      // istanbul ignore next
      return null;
    }
    return {
      fieldName,
      fieldOrder: -1,
      alias,
      range: contextRange(ctx),
    };
  };
}

const fieldNameBuilder = new FieldNameBuilder();

class PatternBuilder extends AbstractParseTreeVisitor<Pattern | null>
  implements PLVisitor<Pattern | null> {
  defaultResult = (): Pattern | null => null;

  visitTuplePattern = (ctx: TuplePatternContext): TuplePattern => ({
    type: 'TuplePattern',
    range: contextRange(ctx),
    destructedNames: ctx
      .varOrWildCard()
      .map((c) => [c.LowerId()?.symbol?.text ?? null, contextRange(c)] as const),
  });

  visitObjectPattern = (ctx: ObjectPatternContext): ObjectPattern => ({
    type: 'ObjectPattern',
    range: contextRange(ctx),
    destructedNames: ctx
      .varOrRenamedVar()
      .map((it) => it.accept(fieldNameBuilder))
      .filter((it): it is ObjectPatternDestucturedName => Boolean(it)),
  });

  visitVariablePattern = (ctx: VariablePatternContext): VariablePattern => ({
    type: 'VariablePattern',
    range: contextRange(ctx),
    name: ctx.text,
  });

  visitWildcardPattern = (ctx: WildcardPatternContext): WildCardPattern => ({
    type: 'WildCardPattern',
    range: contextRange(ctx),
  });
}

const patternBuilder = new PatternBuilder();
export default patternBuilder;
