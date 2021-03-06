import interpretSamlangModule, {
  ExpressionInterpreter,
  InterpretationContext,
  EMPTY,
  FunctionValue,
  ClassValue,
  Value,
} from '../source-level-interpreter';

import {
  stringType,
  identifierType,
  Range,
  ModuleReference,
  Position,
} from 'samlang-core-ast/common-nodes';
import {
  SamlangExpression,
  VariantConstructorExpression,
  EXPRESSION_TRUE,
  EXPRESSION_METHOD_ACCESS,
  EXPRESSION_MATCH,
} from 'samlang-core-ast/samlang-expressions';
import { createGlobalErrorCollector } from 'samlang-core-errors';
import { parseSamlangExpressionFromText, parseSamlangModuleFromText } from 'samlang-core-parser';
import { assertNotNull } from 'samlang-core-utils';

const getExpression = (rawSourceWithTypeAnnotation: string): SamlangExpression => {
  const errorCollector = createGlobalErrorCollector();
  const expression = parseSamlangExpressionFromText(
    rawSourceWithTypeAnnotation,
    errorCollector.getModuleErrorCollector(ModuleReference.ROOT)
  );
  assertNotNull(expression);
  const errors = errorCollector.getErrors().map((it) => it.toString());
  expect(errors).toEqual([]);
  return expression;
};

const interpret = (
  rawSourceWithTypeAnnotation: string,
  interpretationContext: InterpretationContext = EMPTY
): Value =>
  new ExpressionInterpreter().eval(
    getExpression(rawSourceWithTypeAnnotation),
    interpretationContext
  );

const interpretModule = (rawSourceWithTypeAnnotation: string): string => {
  const errorCollector = createGlobalErrorCollector();
  const samlangModule = parseSamlangModuleFromText(
    rawSourceWithTypeAnnotation,
    errorCollector.getModuleErrorCollector(ModuleReference.ROOT)
  );
  expect(errorCollector.getErrors().map((it) => it.toString())).toEqual([]);
  return interpretSamlangModule(samlangModule);
};

it('value equality test', () => {
  expect({ type: 'unit' }).toEqual({ type: 'unit' });
  expect({ type: 'unit' }).not.toEqual({ type: 'bool', value: true });
  expect({ type: 'unit' }).not.toEqual({ type: 'int', value: 1 });
  expect({ type: 'unit' }).not.toEqual({ type: 'string', value: 'string' });
  expect({ type: 'unit' }).not.toEqual({ type: 'tuple', tupleContent: [] });
  expect({ type: 'unit' }).not.toEqual({ type: 'object', objectContent: new Map() });
  expect({ type: 'unit' }).not.toEqual({ type: 'variant', tag: 'tag', data: { type: 'unit' } });

  expect({ type: 'bool', value: true }).toEqual({ type: 'bool', value: true });
  expect({ type: 'bool', value: false }).toEqual({ type: 'bool', value: false });
  expect({ type: 'bool', value: true }).not.toEqual({ type: 'bool', value: false });
  expect({ type: 'bool', value: false }).not.toEqual({ type: 'bool', value: true });

  expect({ type: 'int', value: 1 }).toEqual({ type: 'int', value: 1 });
  expect({ type: 'int', value: 1 }).not.toEqual({ type: 'int', value: 2 });

  expect({ type: 'string', value: 'string' }).toEqual({ type: 'string', value: 'string' });
  expect({ type: 'string', value: 'string' }).not.toEqual({
    type: 'string',
    value: 'not a string',
  });

  expect({ type: 'string', value: 'string' }).toEqual({ type: 'string', value: 'string' });
  expect({ type: 'string', value: 'string' }).not.toEqual({
    type: 'string',
    value: 'not a string',
  });

  expect({ type: 'tuple', tupleContent: [] }).toEqual({ type: 'tuple', tupleContent: [] });
  expect({ type: 'tuple', tupleContent: [] }).not.toEqual({
    type: 'tuple',
    tupleContent: [{ type: 'unit' }],
  });
  expect({ type: 'tuple', tupleContent: [{ type: 'unit' }] }).toEqual({
    type: 'tuple',
    tupleContent: [{ type: 'unit' }],
  });

  expect({ type: 'object', objectContent: new Map() }).toEqual({
    type: 'object',
    objectContent: new Map(),
  });
  const objectContent1 = new Map<string, Value>();
  objectContent1.set('field1', { type: 'unit' });
  const objectContent2 = new Map<string, Value>();
  objectContent2.set('field1', BigInt(1));
  expect({ type: 'object', objectContent: objectContent1 }).not.toEqual({
    type: 'object',
    objectContent: objectContent2,
  });
  objectContent2.set('field2', { type: 'unit' });
  expect({ type: 'object', objectContent: objectContent1 }).not.toEqual({
    type: 'object',
    objectContent: objectContent2,
  });

  expect({ type: 'variant', tag: 'tag', data: { type: 'unit' } }).toEqual({
    type: 'variant',
    tag: 'tag',
    data: { type: 'unit' },
  });
  expect({ type: 'variant', tag: 'tag', data: { type: 'unit' } }).not.toEqual({
    type: 'variant',
    tag: 'diff tag',
    data: { type: 'unit' },
  });
  expect({ type: 'variant', tag: 'tag', data: { type: 'unit' } }).not.toEqual({
    type: 'variant',
    tag: 'diff tag',
    data: { type: 'int', value: 1 },
  });

  const samlangExpression = EXPRESSION_TRUE(new Range(new Position(1, 2), new Position(3, 4)));
  expect({
    type: 'functionValue',
    arguments: [],
    body: samlangExpression,
    context: { classes: new Map(), localValues: new Map() },
  }).toEqual({
    type: 'functionValue',
    arguments: [],
    body: samlangExpression,
    context: { classes: new Map(), localValues: new Map() },
  });
  expect({
    type: 'functionValue',
    arguments: ['param'],
    body: samlangExpression,
    context: { classes: new Map(), localValues: new Map() },
  }).not.toEqual({
    type: 'functionValue',
    arguments: [],
    body: samlangExpression,
    context: { classes: new Map(), localValues: new Map() },
  });
});

it('empty context equality check', () => {
  expect(EMPTY).toEqual(EMPTY);
});

it('non-empty context equality check', () => {
  const testFunctions: Record<string, FunctionValue | undefined> = {};
  const testMethods: Record<string, FunctionValue | undefined> = {};
  const samlangExpression = EXPRESSION_TRUE(new Range(new Position(1, 2), new Position(3, 4)));
  const functionValue: FunctionValue = {
    type: 'functionValue',
    arguments: [],
    body: samlangExpression,
    context: EMPTY,
  };
  testFunctions.function1 = functionValue;
  testMethods.method1 = functionValue;
  const testClassValue = { functions: testFunctions, methods: testMethods };
  const testClasses: Record<string, ClassValue | undefined> = {};
  testClasses.class1 = testClassValue;
  const testLocalValues: Record<string, Value | undefined> = {};
  testLocalValues.v1 = { type: 'unit' };
  const testContext = { classes: testClasses, localValues: testLocalValues };

  expect(testContext).toEqual(testContext);
});

it('literal expressions evaluate correctly', () => {
  expect(interpret('5')).toEqual(BigInt(5));
  expect(interpret('"value"')).toEqual('value');
  expect(interpret('true')).toEqual(true);
});

it('this expressions evaluate correctly', () => {
  expect(interpret('this', { classes: {}, localValues: { this: true } })).toEqual(true);
  expect(() => interpret('this')).toThrow('Missing `this`');
});

it('variable expressions evaluate correctly', () => {
  expect(
    interpret('test', {
      classes: {},
      localValues: { test: true },
    })
  ).toEqual(true);
  expect(() => interpret('test')).toThrow(`Missing variable test`);
});

it('class member expressions evaluate correctly', () => {
  expect(
    interpret('(MyClass.classFunction)()', {
      classes: {
        MyClass: {
          functions: {
            classFunction: {
              type: 'functionValue',
              arguments: [],
              body: getExpression('5'),
              context: EMPTY,
            },
          },
          methods: {},
        },
      },
      localValues: {},
    })
  ).toBe(BigInt(5));

  expect(() => interpret('MyClass.func')).toThrow('');
});

it('tuple expression evaluates correctly', () => {
  expect(interpret('[5, true]')).toEqual({
    type: 'tuple',
    tupleContent: [BigInt(5), true],
  });
});

it('object constructor expression evaluates correctly', () => {
  expect(() => interpret('{ test }')).toThrow('Missing variable test');
  expect(interpret('{ test: 5 }')).toEqual({
    type: 'object',
    objectContent: new Map([['test', BigInt(5)]]),
  });
});

it('variant expression evaluates correctly', () => {
  expect(interpret('Tag(5)')).toEqual({
    type: 'variant',
    tag: 'Tag',
    data: BigInt(5),
  });
});

it('field access expression evaluates correctly', () => {
  expect(interpret('{test:5}.test')).toEqual(BigInt(5));
  expect(() => interpret('"value".test')).toThrow('');
});

it('method access expression evaluates correctly', () => {
  const methodAccessExpression = EXPRESSION_METHOD_ACCESS({
    range: Range.DUMMY,
    type: identifierType('C', []),
    expression: {
      ...(getExpression('Tag(5)') as VariantConstructorExpression),
      type: identifierType('C', []),
    },
    methodName: 'method',
  });

  expect(
    (new ExpressionInterpreter().eval(methodAccessExpression, {
      classes: {
        C: {
          functions: {},
          methods: {
            method: {
              type: 'functionValue',
              arguments: [],
              body: getExpression('5'),
              context: EMPTY,
            },
          },
        },
      },
      localValues: {},
    }) as FunctionValue).type
  ).toBe('functionValue');
  expect(() => new ExpressionInterpreter().eval(methodAccessExpression, EMPTY)).toThrow('');
});

it('unary expression evaluates correctly', () => {
  expect(interpret('-5')).toEqual(BigInt(-5));
  expect(interpret('!true')).toEqual(false);
});

it('panic expression evaluates correctly', () => {
  expect(() => interpret('panic("value")')).toThrow('value');
});

it('built in function call expression evaluates correctly', () => {
  expect(interpret('stringToInt("5")')).toEqual(BigInt(5));
  expect(() => interpret('stringToInt("value")')).toThrow(`Cannot convert \`value\` to int.`);
  expect(interpret('intToString(5)')).toEqual('5');

  const temporaryInterpreterForPrint = new ExpressionInterpreter();
  expect(temporaryInterpreterForPrint.eval(getExpression('println("value")'), EMPTY)).toEqual({
    type: 'unit',
  });
  expect(temporaryInterpreterForPrint.printed()).toEqual('value\n');
});

it('function expression evaluates correctly', () => {
  expect(interpret('(() -> "value")()')).toEqual('value');
  expect(interpret('((arg1: string) -> "value")("aaa")')).toEqual('value');
});

it('binary expression evaluates correctly', () => {
  expect(interpret('5 * 5')).toEqual(BigInt(25));
  expect(interpret('5 / 5')).toEqual(BigInt(1));
  expect(() => interpret('5 / 0')).toThrow('Division by zero!');
  expect(interpret('5 % 5')).toEqual(BigInt(0));
  expect(() => interpret('5 % 0')).toThrow('Mod by zero!');
  expect(interpret('5 + 5')).toEqual(BigInt(10));
  expect(interpret('5 - 5')).toEqual(BigInt(0));
  expect(interpret('5 < 5')).toEqual(false);
  expect(interpret('5 <= 5')).toEqual(true);
  expect(interpret('5 > 5')).toEqual(false);
  expect(interpret('5 >= 5')).toEqual(true);
  expect(interpret('5 == 5')).toEqual(true);
  expect(() => interpret('(() -> "value") == (() -> "value")')).toThrow(
    'Cannot compare functions!'
  );
  expect(interpret('5 != 5')).toEqual(false);
  expect(() => interpret('(() -> "value") != 5')).toThrow('Cannot compare functions!');
  expect(interpret('true && true')).toEqual(true);
  expect(interpret('false && true')).toEqual(false);
  expect(interpret('true || true')).toEqual(true);
  expect(interpret('false || true')).toEqual(true);
  expect(interpret('"value"::"value"')).toEqual('valuevalue');
});

it('if else expression evaluates correctly', () => {
  expect(interpret('if (true) then "true branch" else "false branch"')).toEqual('true branch');
  expect(interpret('if (false) then "true branch" else "false branch"')).toEqual('false branch');
});

it('matching list evaluates correctly', () => {
  expect(interpret('match (Tag(5)) { | Tag data -> data }')).toEqual(BigInt(5));
  expect(interpret('match (Tag(5)) { | Tag _ -> "value" }')).toEqual('value');
  expect(() =>
    new ExpressionInterpreter().eval(
      EXPRESSION_MATCH({
        range: Range.DUMMY,
        type: stringType,
        matchedExpression: getExpression('Tag(5)'),
        matchingList: [],
      }),
      EMPTY
    )
  ).toThrow();
});

it('lambda expression evaluates correctly', () => {
  expect((interpret('() -> 5') as FunctionValue).type).toBe('functionValue');
});

it('statement block expression evalutes correctly', () => {
  expect(
    interpret(`{
      val [tuple, _] = [5, 6];
      val {field as f, field} = {field: 5};
      val varrr = {bar:4}.bar;
      val _ = 5;
    }`)
  ).toEqual({ type: 'unit' });

  expect(() =>
    interpret(`{
      val diffVar = {
        val varrr = 5;
        varrr
      };
      val varrr = varrr;
    }`)
  ).toThrow('Missing variable varrr');

  expect(interpret('{ 5 }')).toEqual(BigInt(5));

  expect(interpret('{ val varrr = 5; varrr }')).toEqual(BigInt(5));

  expect(() => interpret('{ val {fieldName as f} = {field: 5}; }')).toThrow();
});

it('module runs correctly', () => {
  expect(interpretModule('')).toBe('');
  expect(interpretModule('class ExampleClass<P>(val types: int) { }')).toBe('');
  expect(interpretModule(`class Main { }`)).toBe('');
  expect(interpretModule('class Main { function main(): int = 2 }')).toBe('');
  expect(interpretModule('class Main { method main(): unit = println("a") }')).toBe('');
  expect(interpretModule('class Main { function main(a: int): unit = println("a") }')).toBe('');
  expect(interpretModule('class Main { function main(): unit = println("Hello World!") }')).toBe(
    'Hello World!\n'
  );
  expect(() =>
    interpretModule('class Main { function main(): unit = panic("Hello World!") }')
  ).toThrow();
});
