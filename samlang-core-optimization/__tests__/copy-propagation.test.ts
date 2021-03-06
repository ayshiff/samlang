import optimizeIRWithCopyPropagation from '../copy-propagation-optimization';

import {
  MIR_ZERO,
  MIR_ONE,
  MIR_EIGHT,
  MIR_TEMP,
  MIR_IMMUTABLE_MEM,
  MIR_MOVE_TEMP,
  MIR_MOVE_IMMUTABLE_MEM,
  MIR_CALL_FUNCTION,
  MIR_CJUMP_FALLTHROUGH,
  MIR_JUMP,
  MIR_LABEL,
  MIR_RETURN,
  midIRStatementToString,
  MIR_OP,
} from 'samlang-core-ast/mir-nodes';

it('optimizeIRWithCopyPropagation test 1', () => {
  expect(
    optimizeIRWithCopyPropagation([
      MIR_MOVE_TEMP(MIR_TEMP('a'), MIR_ONE),
      MIR_MOVE_TEMP(MIR_TEMP('b'), MIR_ZERO),
      MIR_MOVE_TEMP(MIR_TEMP('c'), MIR_EIGHT),
      MIR_MOVE_TEMP(MIR_TEMP('x'), MIR_TEMP('a')),
      MIR_MOVE_TEMP(MIR_TEMP('y'), MIR_TEMP('b')),
      MIR_MOVE_TEMP(MIR_TEMP('z'), MIR_TEMP('c')),
      MIR_MOVE_TEMP(MIR_TEMP('x'), MIR_TEMP('b')),
      MIR_CALL_FUNCTION('fff', [], 'y'),
      MIR_MOVE_TEMP(MIR_TEMP('z'), MIR_TEMP('x')),
      MIR_CALL_FUNCTION('fff', [MIR_TEMP('z')]),
      MIR_RETURN(MIR_TEMP('z')),
      MIR_RETURN(),
    ])
      .map(midIRStatementToString)
      .join('\n')
  ).toBe(`a = 1;
b = 0;
c = 8;
x = a;
y = b;
z = c;
x = b;
y = fff();
z = b;
fff(b);
return b;
return;`);
});

it('optimizeIRWithCopyPropagation test 2', () => {
  expect(
    optimizeIRWithCopyPropagation([
      MIR_MOVE_TEMP(MIR_TEMP('a'), MIR_ONE),
      MIR_MOVE_TEMP(MIR_TEMP('b'), MIR_OP('+', MIR_ZERO, MIR_ZERO)),
      MIR_CJUMP_FALLTHROUGH(MIR_TEMP('a'), 'true'),
      MIR_MOVE_TEMP(MIR_TEMP('x'), MIR_TEMP('a')),
      MIR_JUMP('end'),
      MIR_LABEL('true'),
      MIR_MOVE_TEMP(MIR_TEMP('x'), MIR_TEMP('b')),
      MIR_LABEL('end'),
      MIR_MOVE_TEMP(MIR_TEMP('y'), MIR_TEMP('x')),
      MIR_MOVE_IMMUTABLE_MEM(MIR_IMMUTABLE_MEM(MIR_TEMP('y')), MIR_IMMUTABLE_MEM(MIR_TEMP('x'))),
    ])
      .map(midIRStatementToString)
      .join(`\n`)
  ).toBe(`a = 1;
b = (0 + 0);
if (a) goto true;
x = a;
goto end;
true:
x = b;
end:
y = x;
MEM[x] = MEM[x];`);
});
