import { ANTLRInputStream, CommonTokenStream, ANTLRErrorListener } from 'antlr4ts';
import type { RecognitionException } from 'antlr4ts/RecognitionException';
import type { Recognizer } from 'antlr4ts/Recognizer';

import ExpressionBuilder from './parser-expression-builder';
import ModuleBuilder from './parser-module-builder';

import { Position, Range } from 'samlang-core-ast/common-nodes';
import type { SamlangExpression } from 'samlang-core-ast/samlang-expressions';
import type { SamlangModule } from 'samlang-core-ast/samlang-toplevel';
import type { ModuleErrorCollector } from 'samlang-core-errors';
import { PLLexer } from 'samlang-core-parser-generated/PLLexer';
import { PLParser } from 'samlang-core-parser-generated/PLParser';

class ErrorListener implements ANTLRErrorListener<unknown> {
  constructor(public readonly moduleErrorCollector: ModuleErrorCollector) {}

  syntaxError(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognizer: Recognizer<unknown, any>,
    offendingSymbol: unknown | undefined,
    line: number,
    charPositionInLine: number,
    msg: string,
    // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
    e: RecognitionException | undefined
  ) {
    this.moduleErrorCollector.reportSyntaxError(
      new Range(
        new Position(line - 1, charPositionInLine),
        new Position(line - 1, charPositionInLine)
      ),
      msg
    );
  }
}

export const parseSamlangModuleFromText = (
  text: string,
  moduleErrorCollector: ModuleErrorCollector
): SamlangModule => {
  const parser = new PLParser(new CommonTokenStream(new PLLexer(new ANTLRInputStream(text))));
  const errorListener = new ErrorListener(moduleErrorCollector);
  parser.removeErrorListeners();
  parser.addErrorListener(errorListener);
  try {
    return parser.module().accept(new ModuleBuilder(moduleErrorCollector));
  } catch {
    moduleErrorCollector.reportSyntaxError(Range.DUMMY, 'Encountered unrecoverable syntax error');
    return { imports: [], classes: [] };
  }
};

export const parseSamlangExpressionFromText = (
  text: string,
  moduleErrorCollector: ModuleErrorCollector
): SamlangExpression | null => {
  const parser = new PLParser(new CommonTokenStream(new PLLexer(new ANTLRInputStream(text))));
  const errorListener = new ErrorListener(moduleErrorCollector);
  parser.removeErrorListeners();
  parser.addErrorListener(errorListener);
  try {
    return parser.expression().accept(new ExpressionBuilder(moduleErrorCollector));
  } catch {
    moduleErrorCollector.reportSyntaxError(Range.DUMMY, 'Encountered unrecoverable syntax error');
    return null;
  }
};
