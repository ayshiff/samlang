import ModuleReference from '../ast/common/module-reference';
import { MidIRCompilationUnit, midIRCompilationUnitToString } from '../ast/mir';
import { typeCheckSources } from '../checker';
// eslint-disable-next-line import/no-internal-modules
import compileSamlangSourcesToHighIRSources from '../compiler/hir';
// eslint-disable-next-line import/no-internal-modules
import { compileHighIrSourcesToMidIRCompilationUnitWithMultipleEntries } from '../compiler/mir';
import { createGlobalErrorCollector } from '../errors';
import interpretMidIRCompilationUnit from '../interpreter/mid-ir-interpreter';
import optimizeIRCompilationUnit from '../optimization';
import { parseSamlangModuleFromText } from '../parser';
import { mapOf } from '../util/collections';
import { assertNotNull } from '../util/type-assertions';

type WellTypedSamlangProgramTestCase = {
  readonly testCaseName: string;
  readonly expectedStandardOut: string;
  readonly sourceCode: string;
};

const runnableSamlangProgramTestCases: readonly WellTypedSamlangProgramTestCase[] = [
  {
    testCaseName: 'and-or-inside-if',
    expectedStandardOut: 'one\n',
    sourceCode: `
class Main {
  function main(): unit = {
    val i = 1;
    val j = 2;
    if (i < j && i > 0 && j > 0) then {
      val a = 3;
      val b = 4;
      if (a > b || a + b > 0 && true) then println("one") else println("two")
    } else {
      val a = 3;
      val b = 4;
      if (a == 2 || b == 4) then {
        println("three")
      } else {
        println("four")
      }
    }
  }
}
`,
  },
  {
    testCaseName: 'block-in-if-else',
    expectedStandardOut: '',
    sourceCode: `
class Main {
  function main(): unit =
    if (true) then {
      val _ = Main.main2();
      val _ = Main.main3();
      val _ = 3;
      {}
    } else {
      {}
    }

  function main2(): int =
    if (true) then {
      val _ = 3;
      3
    } else {
      2
    }

  function main3(): unit =
    if (true) then {
      val _ = 3;
    } else {
      // Do nothing...
    }
}
`,
  },
  {
    testCaseName: 'builtins',
    expectedStandardOut: '42!\n',
    sourceCode: `
class Main {
  function main(): unit = {
    val value = intToString(stringToInt("42"))::"!";
    val _ = println(value);
  }
}
`,
  },
  {
    testCaseName: 'cf-test-1',
    expectedStandardOut: '361200\n',
    sourceCode: `
class Main {
  function testI(acc: int, i: int): int =
    if (i >= 30 + 100/100 - 2000*2000/(10*10*10*4000)) then
      acc
    else
      Main.testI(Main.testJ(acc, 0), i + 1)

  function testJ(acc: int, j: int): int =
    if (j >= 10 + 100 * 99 * 98 * 97 * 0) then
      acc
    else
      // +1204
      Main.testJ(acc + 34 * 34 + 4 + 1 + 1231 / 28, j + 1)

  // 1204 * 30 * 10 = 361200
  function main(): unit = println(intToString(Main.testI(0, 0)))
}
`,
  },
  {
    testCaseName: 'cf-test-2',
    expectedStandardOut: '7000\n',
    sourceCode: `
class Main {
  function test(acc: int, i: int): int =
    if (i >= 10*10*2) then
      acc
    else {
      // 35
      val increase = (1+2*3-4/5%10000000/12334) + (1+2*3-4/5%10000000/12334) +
                     (1+2*3-4/5%10000000/12334) + (1+2*3-4/5%10000000/12334) +
                     (1+2*3-4/5%10000000/12334);
      Main.test(acc + increase, i + 1)
    }

  // 35 * 200 = 7000
  function main(): unit = println(intToString(Main.test(0, 0)))
}
`,
  },
  {
    testCaseName: 'cf-test-3',
    expectedStandardOut: '1400\n',
    sourceCode: `
class Main {
  function test(acc: int, i: int): int =
    if (i >= 10*10*2) then
      acc
    else {
      // +7
      Main.test(acc + 1 + 2 * 3 - 4 / 5 % 10000000 / 1234, i + 1)
    }

  // 200 * 7 = 1400
  function main(): unit = println(intToString(Main.test(0, 0)))
}
`,
  },
  {
    testCaseName: 'concat-string',
    expectedStandardOut: 'Hello World!\n',
    sourceCode: `
class Main {
  function main(): unit = println("Hello "::"World!")
}
`,
  },
  {
    testCaseName: 'correct-op',
    expectedStandardOut: 'OK\n',
    sourceCode: `
class Main {
  function crash(a: string, b: string): unit = {
    val _ = println("different:");
    val _ = println("a:");
    val _ = println(a);
    val _ = println("b:");
    val _ = println(b);
    val _ = panic("crash!");
  }

  function checkInt(a: int, b: int): unit =
    if (a == b) then {} else Main.crash(intToString(a), intToString(b))

  function boolToString(b: bool): string =
    if (b) then "true" else "false"

  function checkBool(a: bool, b: bool): unit =
    if (a == b) then {} else Main.crash(Main.boolToString(a), Main.boolToString(b))

  function checkAll(): unit = {
    val _ = Main.checkInt(42, 21 * 2);
    val _ = Main.checkInt(42, 84 / 2);
    val _ = Main.checkInt(42, 91 % 49);
    val _ = Main.checkInt(42, 20 + 22);
    val _ = Main.checkInt(42, 50 - 8);

    val _ = Main.checkBool(false, false);
    val _ = Main.checkBool(true, true);

    val _ = Main.checkBool(false, false && false);
    val _ = Main.checkBool(false, true && false);
    val _ = Main.checkBool(false, false && true);
    val _ = Main.checkBool(true, true && true);
    val _ = Main.checkBool(false, false || false);
    val _ = Main.checkBool(true, true || false);
    val _ = Main.checkBool(true, false || true);
    val _ = Main.checkBool(true, true || true);

    val _ = Main.checkBool(true, 42 < 50);
    val _ = Main.checkBool(false, 42 > 42);
    val _ = Main.checkBool(false, 42 > 50);
    val _ = Main.checkBool(true, 42 <= 42);
    val _ = Main.checkBool(true, 42 <= 43);
    val _ = Main.checkBool(false, 42 <= 41);
    val _ = Main.checkBool(true, 50 > 42);
    val _ = Main.checkBool(false, 42 < 42);
    val _ = Main.checkBool(false, 50 < 42);
    val _ = Main.checkBool(true, 42 >= 42);
    val _ = Main.checkBool(true, 43 >= 42);
    val _ = Main.checkBool(false, 41 >= 42);

    val _ = Main.checkBool(true, 1 == 1);
    val _ = Main.checkBool(false, 1 == 2);
    val _ = Main.checkBool(false, 1 != 1);
    val _ = Main.checkBool(true, 1 != 2);
    val _ = Main.checkBool(true, true == true);
    val _ = Main.checkBool(false, true == false);
    val _ = Main.checkBool(false, true != true);
    val _ = Main.checkBool(true, true != false);

    val c = 21;
    val _ = Main.checkInt(-42, -(c * 2)); // prevent constant folding!
    val _ = Main.checkBool(true, !false);
    val _ = Main.checkBool(false, !true);
  }

  function main(): unit = {
    val _ = Main.checkAll();
    println("OK")
  }
}
`,
  },
  {
    testCaseName: 'cse-test-1',
    expectedStandardOut: '30\n12\n15\n',
    sourceCode: `
class Main {
  function printInt(i: int): unit = println(intToString(i))

  function test(a: int, b: int): unit = {
    val _ = Main.printInt((a * b + a) + (a * b + a));
    val _ = Main.printInt(a * b);
    val _ = Main.printInt(a * b + a);
  }

  function main(): unit = Main.test(3, 4)
}
`,
  },
  {
    testCaseName: 'cse-test-2',
    expectedStandardOut: 'OK\n',
    sourceCode: `
class Main {
  function printInt(i: int): unit = println(intToString(i))

  function check(actual: int, expected: int): unit =
    if (actual != expected) then
      panic("actual: "::intToString(actual)::", expected "::intToString(expected))
    else {}

  function test(first: bool, a: int, b: int, aTimesB: int): unit = {
    val t = if (first) then a * b else a * b;
    val _ = Main.check(a * b, aTimesB);
  }

  function main(): unit = {
    val _ = Main.test(true, 3, 4, 12);
    val _ = Main.test(false, 3, 4, 12);
    println("OK")
  }
}
`,
  },
  {
    testCaseName: 'cse-test-3',
    expectedStandardOut: '2181\n',
    sourceCode: `
class Main {
  function log(x: int, b: int): int =
    if (x <= 0) then 0
    else if (x <= b) then 1
    else if (x <= b * b) then 2
    else if (x <= b * b * b) then 3
    else if (x <= b * b * b * b) then 4
    else if (x <= b * b * b * b * b) then 5
    else if (x <= b * b * b * b * b * b) then 6
    else if (x <= b * b * b * b * b * b * b) then 7
    else if (x <= b * b * b * b * b * b * b * b) then 8
    else if (x <= b * b * b * b * b * b * b * b * b) then 9
    else if (x <= b * b * b * b * b * b * b * b * b * b) then 10
    else 10 + Main.log(x / (b * b * b * b * b * b * b * b * b * b), b)

  function plusLog2(acc: int, i: int): int = acc + Main.log(i, 2)

  function test(acc: int, i: int): int =
    if (i >= 300) then
      acc
    else
      Main.test(acc + Main.log(i, 2), i + 1)

  function main(): unit = println(intToString(Main.test(0, 0)))
}
`,
  },
  {
    testCaseName: 'cse-test-4',
    expectedStandardOut: '2700\n',
    sourceCode: `
class Main {
  function test(totalPicograms: int, i: int): int = {
    val maxLong = 9223372036854775807;
    if (i >= 300) then
      totalPicograms
    else {
      val megagrams = maxLong - i;
      val kilograms = megagrams / 1000;
      val grams = (megagrams / 1000) / 1000;
      val milligrams = ((megagrams / 1000) / 1000) / 1000;
      val micrograms = (((megagrams / 1000) / 1000) / 1000) / 1000;
      val nanograms = ((((megagrams / 1000) / 1000) / 1000) / 1000) / 1000;
      val picograms = (((((megagrams / 1000) / 1000) / 1000) / 1000) / 1000) / 1000;
      Main.test(totalPicograms + picograms, i + 1)
    }
  }

  function main(): unit = println(intToString(Main.test(0, 0)))
}`,
  },
  {
    testCaseName: 'cse-test-5',
    expectedStandardOut: '150\n',
    sourceCode: `
class Main {
  function test(totalOddNumbers: int, i: int): int = {
    if (i >= 300) then
      totalOddNumbers
    else {
      val iMod64 = i % 64;
      val iMod32 = (i % 64) % 32;
      val iMod16 = ((i % 64) % 32) % 16;
      val iMod8 = (((i % 64) % 32) % 16) % 8;
      val iMod4 = ((((i % 64) % 32) % 16) % 8) % 4;
      val iMod2 = (((((i % 64) % 32) % 16) % 8) % 4) % 2;
      Main.test(totalOddNumbers + iMod2, i + 1)
    }
  }

  function main(): unit = println(intToString(Main.test(0, 0)))
}
`,
  },
  {
    testCaseName: 'cse-test-6',
    expectedStandardOut: 'OK\n',
    sourceCode: `
class Main {
  function printInt(i: int): unit = println(intToString(i))

  function check(actual: int, expected: int): unit =
    if (actual != expected) then
      panic("actual: "::intToString(actual)::", expected "::intToString(expected))
    else {}

  function test(first: bool, a: int, b: int, aTimesB: int): unit = {
    val _ = if (first) then {
      val _ = a * b;
    } else {};
    val _ = Main.check(a * b, aTimesB);
  }

  function main(): unit = {
    val _ = Main.test(true, 3, 4, 12);
    val _ = Main.test(false, 3, 4, 12);
    println("OK")
  }
}
`,
  },
  {
    testCaseName: 'different-classes-demo',
    expectedStandardOut: 'OK\n',
    sourceCode: `
class Math {
  function plus(a: int, b: int): int = a + b
  function cosine(angleInDegree: int): int = panic("Not supported!")
}

class Student(val name: string, val age: int) {
  method getName(): string = this.name
  method getAge(): int = this.age
  function dummyStudent(): Student = { name: "RANDOM_BABY", age: 0 }
}

class PrimitiveType(
  U(bool),
  I(int),
  S(string),
  B(bool),
) {
  // some random functions
  function getUnit(): PrimitiveType = U(false)
  function getInteger(): PrimitiveType = I(42)
  function getString(): PrimitiveType = S("Answer to life, universe, and everything.")
  function getBool(): PrimitiveType = B(false)

  // pattern matching!
  method isTruthy(): bool =
    match (this) {
      | U _ -> false
      | I i -> i != 0
      | S s -> s != ""
      | B b -> b
    }
}

class FunctionExample {
  function <T> getIdentityFunction(): (T) -> T = (x) -> x
}

class Box<T>(val content: T) {
  function <T> init(content: T): Box<T> = { content } // object short hand syntax
  method getContent(): T = {
    val { content } = this; content
  }
}

class Option<T>(None(unit), Some(T)) {
  function <T> getNone(): Option<T> = None({})
  function <T> getSome(d: T): Option<T> = Some(d)
  method forceValue(): T =
    match (this) {
      | None _ -> panic("Ah")
      | Some v -> v
    }
  method <R> map(f: (T) -> R): Option<R> =
    match (this) {
      | None _ -> None({})
      | Some d -> Some(f(d))
    }
}

class Main {

  private function assertTrue(condition: bool, message: string): unit =
    if (condition) then {} else panic(message)

  private function assertFalse(condition: bool, message: string): unit =
    if (!condition) then {} else panic(message)

  private function assertEquals(e1: int, e2: int, message: string): unit =
    if (e1 == e2) then {} else panic(intToString(e1)::" "::intToString(e2)::" "::message)

  private function consistencyTest(): unit = {
    val _ = Main.assertEquals(Option.getSome(3).map((i) -> i + 1).forceValue(), 4, "Ah1");
    val _ = Main.assertEquals(Box.init(42).getContent(), 42, "Ah2");
    val _ = Main.assertEquals(FunctionExample.getIdentityFunction()(42), 42, "Ah3");
    val _ = Main.assertEquals(Student.dummyStudent().getAge(), 0, "Ah4");
    val _ = Main.assertEquals(Math.plus(2, 2), 4, "Ah5");
    val _ = Main.assertFalse(PrimitiveType.getUnit().isTruthy(), "Ah6");
    val _ = Main.assertTrue(PrimitiveType.getInteger().isTruthy(), "Ah7");
    val _ = Main.assertTrue(PrimitiveType.getString().isTruthy(), "Ah8");
    val _ = Main.assertFalse(PrimitiveType.getBool().isTruthy(), "Ah9");
  }

  function main(): unit = {
    val _ = Main.consistencyTest();
    println("OK")
  }
}
`,
  },
  {
    testCaseName: 'different-expressions-demo',
    expectedStandardOut: '42\n',
    sourceCode: `
class Foo(val a: int) {
  function bar(): int = 3
}

class Option<T>(None(unit), Some(T)) {
  function matchExample(opt: Option<int>): int =
    match (opt) {
      | None _ -> 42
      | Some a -> a
    }
}

class Obj(val d: int, val e: int) {
  function valExample(): int = {
    val a: int = 1;
    val b = 2;
    val [_, c] = ["dd", 3]; // c = 3
    val { e as d } = { d: 5, e: 4 }; // d = 4
    val _ = 42;
    // 1 + 2 * 3 / 4 = 1 + 6/4 = 1 + 1 = 2
    a + b * c / d
  }
}

class Main {
  function identity(a: int): int = a

  function random(): int = {
    val a = 42; // very random
    a
  }

  function oof(): int = 14

  function div(a: int, b: int): int =
    if b == 0 then (
      panic("Division by zero is illegal!")
    ) else (
      a / b
    )

  function nestedVal(): int = {
    val a = {
      val b = 4;
      val c = {
        val c = b;
        b
      }; // c = 4
      c
    }; // 4
    val [e, b, _] = [1, "bool", true];
    a + 1 // 5
  }

  function main(): unit = println(intToString(Main.identity(
    Foo.bar() * Main.oof() * Obj.valExample() / Main.div(4, 2) + Main.nestedVal() - 5
  )))
}
`,
  },
  {
    testCaseName: 'empty',
    expectedStandardOut: '',
    sourceCode: `
class Main {
  function main(): unit = {}
}
`,
  },
  {
    testCaseName: 'evaluation-order',
    expectedStandardOut: `0
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
`,
    sourceCode: `
// This program uses function calls that contain printing statement to detect evaluation order.

class Main {
  // return a random number, print order
  function intIdentity(order: int): int = {
    val _ = println(intToString(order));
    2
  }

  // return a random bool, print order
  function boolIdentity(item: bool, order: int): bool = {
    val _ = println(intToString(order));
    item
  }

  // return the string back, print str
  function stringIdentity(str: string): string = {
    val _ = println("surprise!");
    str
  }

  function binaryExpressionTest(): unit = {
    val _ = Main.intIdentity(0) + Main.intIdentity(1);
    val _ = Main.intIdentity(2) - Main.intIdentity(3);
    val _ = Main.intIdentity(4) * Main.intIdentity(5);
    val _ = Main.intIdentity(6) / Main.intIdentity(7);
    val _ = Main.intIdentity(8) % Main.intIdentity(9);
    val _ = Main.intIdentity(10) < Main.intIdentity(11);
    val _ = Main.intIdentity(12) <= Main.intIdentity(13);
    val _ = Main.intIdentity(14) > Main.intIdentity(15);
    val _ = Main.intIdentity(16) >= Main.intIdentity(17);
    val _ = Main.intIdentity(18) == Main.intIdentity(19);
    val _ = Main.intIdentity(20) != Main.intIdentity(21);
    val _ = Main.boolIdentity(false, 22) || Main.boolIdentity(false, 23);
    val _ = Main.boolIdentity(true, 24) && Main.boolIdentity(true, 25);
  }

  function main(): unit = Main.binaryExpressionTest()
}
`,
  },
  {
    testCaseName: 'function-call-never-ignored',
    expectedStandardOut: 'hi\n',
    sourceCode: `
class Main {
  function hi(): int = {
    val _ = println("hi");
    5
  }

  function main(): unit = {
    val _ = Main.hi();
  }
}
`,
  },
  {
    testCaseName: 'generic-object-test',
    expectedStandardOut: '2\n42\n',
    sourceCode: `
class GenericObject<T1, T2>(val v1: T1, val v2: T2) {
  function main(): unit = {
    val f = (v2) -> (
      if (v2 + 1 == 3) then
        { v1: 3, v2 }
      else
        { v1: 3, v2: 42 }
    );
    val _ = println(intToString(f(2).v2)); // print 2
    val _ = println(intToString(f(3).v2)); // print 42
  }
}

class Main {
  function main(): unit = GenericObject.main()
}
`,
  },
  {
    testCaseName: 'if-else-consistency',
    expectedStandardOut: '3\n3\nOK\n',
    sourceCode: `
class Main {
  function main(): unit = {
    val a = if (true) then
      (if (false) then 10000 else 3)
    else
      4
    ;
    val b = if (false) then 4 else if (true) then 3 else 20000;
    val _ = println(intToString(a));
    val _ = println(intToString(b));
    if (a != b) then panic("Not OK") else println("OK")
  }
}
`,
  },
  {
    testCaseName: 'if-else-unreachable-1',
    expectedStandardOut: 'success\n',
    sourceCode: `
class Main {
  function main(): unit = {
    val i = 2;
    val j = 3;
    if (i > j) then
      println("shouldn't reach here")
    else if (j < i) then
      println("shouldn't reach here")
    else if (i < 0) then
      println("shouldn't reach here")
    else
      println("success")
  }
}
`,
  },
  {
    testCaseName: 'if-else-unreachable-2',
    expectedStandardOut: 'success\n',
    sourceCode: `
class Main {
  function main(): unit = {
    val i = 3;
    val j = 2;
    if (i > j) then
      println("success")
    else if (j < i) then
      println("shouldn't reach here")
    else if (i < 0) then
      println("shouldn't reach here")
    else
      println("shouldn't reach here")
  }
}
`,
  },
  {
    testCaseName: 'map-but-ignore',
    expectedStandardOut: '',
    sourceCode: `
class Option<T>(None(unit), Some(T)) {
  method <R> mapButIgnore(f: (T) -> R): unit = {
    val _ = match (this) {
      // Resolved to Option<UNDECIDED>
      | None _ -> None({})
      // Resolved to Option<R>
      // If the merge process does not go deeper,
      // we will complain that Option<UNDECIDED> != Option<R>,
      // which is bad!
      | Some d -> Some(f(d))
    };
  }

  function main(): unit = {
    val none = None({});
    val _ = Some(none.mapButIgnore((it) -> it)).mapButIgnore((it) -> it);
  }
}

class Main {
  function main(): unit = Option.main()
}
`,
  },
  {
    testCaseName: 'math-functions',
    expectedStandardOut: '24\n55\n',
    sourceCode: `
class Main {
  function factorial(n: int): int =
    if (n == 0) then 1 else Main.factorial(n - 1) * n

  function fib(n: int): int =
    if (n == 0) then 0 else if (n == 1) then 1 else Main.fib(n - 2) + Main.fib(n - 1)

  function uselessRecursion(n: int): unit = if (n == 0) then {} else Main.uselessRecursion(n - 1)

  function main(): unit = {
    val _ = println(intToString(Main.factorial(4)));
    val _ = println(intToString(Main.fib(10)));
    val _ = Main.uselessRecursion(20);
  }
}
`,
  },
  {
    testCaseName: 'mutually-recursive',
    expectedStandardOut: 'OK\n',
    sourceCode: `
class Main {
  function isEven(n: int): bool = if n == 0 then true else Main.isOdd(n-1)
  function isOdd(n: int): bool = if n == 0 then false else Main.isEven(n-1)

  function main(): unit =
    if (!(Main.isEven(3)) && Main.isOdd(3)) then println("OK") else println("BAD")
}
`,
  },
  {
    testCaseName: 'optional-semicolon',
    expectedStandardOut: '-7\n',
    sourceCode: `
class Main(val a: int, val b: bool) {
  function main(): unit = {
    val _ = 3
    val a = 2;
    val c = a - 3;
    val d = c * 7
    val b = true;
    val [_, e] = [a, c]
    val _ = { a: e, b }
    val finalValue = a + c + d + (if (b) then 0 else panic("")) + e; // 2 + (-1) + (-7) + (-1) = -7
    println(intToString(finalValue))
  }
}
`,
  },
  {
    testCaseName: 'reordering-test',
    expectedStandardOut: 'OK\n',
    sourceCode: `
class Main {
  function assertEqual(a: int, b: int): unit = if (a != b) then panic("") else {}

  function main(): unit = {
    val v0 = if (true) then {
      val _ = 0;
      val _ = 0;
      val _ = 0;
      val _ = 0;
      val _ = 0;
      val _ = 0;
      val _ = 0;
      val _ = 0;
      val _ = 0;
      val _ = 0;
      65536
    } else 42;
    val v1 = if (false) then 42 else {
      val _ = 0;
      val _ = 0;
      val _ = 0;
      val _ = 0;
      val _ = 0;
      val _ = 0;
      val _ = 0;
      val _ = 0;
      val _ = 0;
      val _ = 0;
      65536
    };
    val v2 = if (!true) then 42 else {
      val _ = 0;
      val _ = 0;
      val _ = 0;
      val _ = 0;
      val _ = 0;
      val _ = 0;
      val _ = 0;
      val _ = 0;
      val _ = 0;
      val _ = 0;
      65536
    };
    val v3 = if (!false) then {
      val _ = 0;
      val _ = 0;
      val _ = 0;
      val _ = 0;
      val _ = 0;
      val _ = 0;
      val _ = 0;
      val _ = 0;
      val _ = 0;
      val _ = 0;
      65536
    } else 42;
    val _ = Main.assertEqual(v0, v1);
    val _ = Main.assertEqual(v2, v3);
    val _ = Main.assertEqual(v0, v2);
    println("OK")
  }
}
`,
  },
  {
    testCaseName: 'short-circuit-and-or',
    expectedStandardOut: `0
1
false
0
1
true
0
false
0
false
0
true
0
true
0
1
false
0
1
true
0
1
0
1
0
0
0
0
0
1
0
1
`,
    sourceCode: `
class Main {
  function printAndReturn(b: bool, i: int): bool = {
    val _ = println(intToString(i));
    b
  }

  function printlnBool(b: bool): unit = if (b) then println("true") else println("false")

  function testAndShortCircuitInExpression(): unit = {
    val b1 = Main.printAndReturn(true, 0) && Main.printAndReturn(false, 1); // [0] [1]
    val _ = Main.printlnBool(b1); // false
    val b2 = Main.printAndReturn(true, 0) && Main.printAndReturn(true, 1); // [0] [1]
    val _ = Main.printlnBool(b2); // true
    val b3 = Main.printAndReturn(false, 0) && Main.printAndReturn(false, 1); // [0]
    val _ = Main.printlnBool(b3); // false
    val b4 = Main.printAndReturn(false, 0) && Main.printAndReturn(true, 1); // [0]
    val _ = Main.printlnBool(b4); // false
  }

  function testOrShortCircuitInExpression(): unit = {
    val b1 = Main.printAndReturn(true, 0) || Main.printAndReturn(false, 1); // [0]
    val _ = Main.printlnBool(b1); // true
    val b2 = Main.printAndReturn(true, 0) || Main.printAndReturn(true, 1); // [0]
    val _ = Main.printlnBool(b2); // true
    val b3 = Main.printAndReturn(false, 0) || Main.printAndReturn(false, 1); // [0] [1]
    val _ = Main.printlnBool(b3); // false
    val b4 = Main.printAndReturn(false, 0) || Main.printAndReturn(true, 1); // [0] [1]
    val _ = Main.printlnBool(b4); // true
  }

  function testAndShortCircuitInIf(): unit = {
    // [0] [1]
    val _ = if (Main.printAndReturn(true, 0) && Main.printAndReturn(false, 1)) then panic("Ah") else {};
    // [0] [1]
    val _ = if (Main.printAndReturn(true, 0) && Main.printAndReturn(true, 1)) then {} else panic("Ah");
    // [0]
    val _ = if (Main.printAndReturn(false, 0) && Main.printAndReturn(false, 1)) then panic("Ah") else {};
    // [0]
    val _ = if (Main.printAndReturn(false, 0) && Main.printAndReturn(true, 1)) then panic("Ah") else {};
  }

  function testOrShortCircuitInIf(): unit = {
    // [0]
    val _ = if (Main.printAndReturn(true, 0) || Main.printAndReturn(false, 1)) then {} else panic("Ah");
    // [0]
    val _ = if (Main.printAndReturn(true, 0) || Main.printAndReturn(true, 1)) then {} else panic("Ah");
    // [0] [1]
    val _ = if (Main.printAndReturn(false, 0) || Main.printAndReturn(false, 1)) then panic("Ah") else {};
    // [0] [1]
    val _ = if (Main.printAndReturn(false, 0) || Main.printAndReturn(true, 1)) then {} else panic("Ah");
  }

  function main(): unit = {
    val _ = Main.testAndShortCircuitInExpression();
    val _ = Main.testOrShortCircuitInExpression();
    val _ = Main.testAndShortCircuitInIf();
    val _ = Main.testOrShortCircuitInIf();
  }
}
`,
  },
  {
    testCaseName: 'string-global-constant',
    expectedStandardOut: 'OK\n',
    sourceCode: `
class Main {
  function main(): unit = {
    val a1 = "a";
    val a2 = "a";
    if a1 == a2 then
      println("OK")
    else {
      println("BAD")
    }
  }
}
`,
  },
  {
    testCaseName: 'too-much-interference',
    expectedStandardOut: '0\n',
    sourceCode: `
class Main {
  function main(): unit = {
    // without constant propagation, this program will spill a lot!
    val v0 = 0;
    val v1 = 0;
    val v2 = 0;
    val v3 = 0;
    val v4 = 0;
    val v5 = 0;
    val v6 = 0;
    val v7 = 0;
    val v8 = 0;
    val v9 = 0;
    val v10 = 0;
    val v11 = 0;
    val v12 = 0;
    val v13 = 0;
    val v14 = 0;
    val v15 = 0;
    val v16 = 0;
    val v17 = 0;
    val v18 = 0;
    val v19 = 0;
    val v20 = 0;
    val v21 = 0;
    val v22 = 0;
    val v23 = 0;
    val v24 = 0;
    val v25 = 0;
    val v26 = 0;
    val v27 = 0;
    val v28 = 0;
    val v29 = 0;
    val v30 = 0;
    val v31 = 0;
    val v32 = 0;
    val v33 = 0;
    val v34 = 0;
    val v35 = 0;
    val v36 = 0;
    val v37 = 0;
    val v38 = 0;
    val v39 = 0;
    val v40 = 0;
    val v41 = 0;
    val v42 = 0;
    val v43 = 0;
    val v44 = 0;
    val v45 = 0;
    val v46 = 0;
    val v47 = 0;
    val v48 = 0;
    val v49 = 0;
    val result =
    v0 + v1 + v2 + v3 + v4 + v5 + v6 + v7 + v8 + v9 +
    v10 + v11 + v12 + v13 + v14 + v15 + v16 + v17 + v18 + v19 +
    v20 + v21 + v22 + v23 + v24 + v25 + v26 + v27 + v28 + v29 +
    v30 + v31 + v32 + v33 + v34 + v35 + v36 + v37 + v38 + v39 +
    v40 + v41 + v42 + v43 + v44 + v45 + v46 + v47 + v48 + v49
    ;
    println(intToString(result))
  }
}
`,
  },
  {
    testCaseName: 'various-syntax-forms',
    expectedStandardOut: '84\n',
    sourceCode: `
class Clazz(val t: int) {
    function of(): Clazz = { t: 42 }

    method thisTest(): int = {
      val i: int = this.t;
      val { t as j } = this;
      i + j
    }
}

class Option<T>(Some(T), None(bool)) {
  function <T> none(): Option<T> = None(true)
  method toSome(t: T): Option<T> = Some(t)
  method isNone(): bool = match (this) {
    | None _ -> true
    | Some _ -> false
  }
  method <R> map(f: (T) -> R): Option<R> =
    match (this) {
      | None _ -> None(true)
      | Some t -> Some(f(t))
    }
}

class List<T>(Nil(bool), Cons([T * List<T>])) {
  function <T> of(t: T): List<T> =
    Cons([t, Nil(true)])
  method cons(t: T): List<T> =
    Cons([t, this])
}

class Main {
  function literalsAndSimpleExpressions(): unit = {
    val _ = 42;
    val _ = -65536;
    val _ = true;
    val _ = false;
    val _ = !true;
    val _ = !false;
    val _ = "aaa";
    val _ = {};
  }

  function variables(a: int, b: string): unit = {
    val c = 3 + a;
    val d = b == b;
    val e = c % c;
  }

  function methodAndFunctionReference(): int =
    Clazz.of().thisTest()

  function panicTest(reason: string): Clazz = panic(reason)

  function functionsTest(): unit = {
    val _ = Main.literalsAndSimpleExpressions();
    val _ = Main.variables(3, "hi");
    val _ = Main.methodAndFunctionReference();
    val _ = Main.panicTest("Ah!").thisTest();
    val _ = Main.binaryExpressions();
    val _ = Main.lambdaTest(3);
    Main.functionsTest()
  }

  function binaryExpressions(): unit = {
    val a: int = 1 * 2 + 3 / 4 % 5 - 6;
    val b: bool = a < a && 1 > 3 || 2 <= 4 && 5 >= 6;
    val c: bool = a == 2;
    val d: bool = Main.panicTest("ha") != Clazz.of();
    val e: bool = List.of(3) == List.of(a * 3);
  }

  function lambdaTest(a: int): string = {
    val b: Option<string> = Option.none().toSome(3).map(Main.lambdaTest);
    val c: Option<string> = Option.none().toSome(3).map((x) -> "empty");
    "hello world"
  }

  function main(): unit = {
    val _ = Main.literalsAndSimpleExpressions();
    val _ = Main.variables(3, "sss");
    val v = Main.methodAndFunctionReference(); // 42 + 42 == 84
    println(intToString(v))
  }
}
`,
  },
];

type MidIRTestCase = {
  readonly testCaseName: string;
  readonly expectedStandardOut: string;
  readonly compilationUnit: MidIRCompilationUnit;
};

const mirBaseTestCases: readonly MidIRTestCase[] = (() => {
  const errorCollector = createGlobalErrorCollector();

  const parsedSamlangSources = mapOf(
    ...runnableSamlangProgramTestCases.map((it) => {
      const moduleReference = new ModuleReference([it.testCaseName]);
      return [
        moduleReference,
        parseSamlangModuleFromText(
          it.sourceCode,
          errorCollector.getModuleErrorCollector(moduleReference)
        ),
      ] as const;
    })
  );
  expect(errorCollector.getErrors()).toEqual([]);

  const [checkedSamlangSources] = typeCheckSources(parsedSamlangSources, errorCollector);
  expect(errorCollector.getErrors()).toEqual([]);

  const mirSources = compileHighIrSourcesToMidIRCompilationUnitWithMultipleEntries(
    compileSamlangSourcesToHighIRSources(checkedSamlangSources)
  );

  return runnableSamlangProgramTestCases.map(({ testCaseName, expectedStandardOut }) => {
    const compilationUnit = mirSources.get(new ModuleReference([testCaseName]));
    assertNotNull(compilationUnit);
    return {
      testCaseName,
      expectedStandardOut,
      compilationUnit,
    };
  });
})();

const testMidIROptimizerResult = (
  testCase: MidIRTestCase,
  optimizer: (compilationUnit: MidIRCompilationUnit) => MidIRCompilationUnit
): void => {
  const unoptimized = testCase.compilationUnit;
  const optimized = optimizer(unoptimized);
  const interpretationResult = interpretMidIRCompilationUnit(optimized);
  if (interpretationResult !== testCase.expectedStandardOut) {
    const expected = testCase.expectedStandardOut;
    const unoptimizedString = midIRCompilationUnitToString(unoptimized);
    const optimizedString = midIRCompilationUnitToString(optimized);
    fail(
      `Expected:\n${expected}\nActual:\n${interpretationResult}\nUnoptimized MIR:${unoptimizedString}\nOptimized MIR:${optimizedString}`
    );
  }
};

mirBaseTestCases.forEach((testCase) => {
  it(`IR[no-opt]: ${testCase.testCaseName}`, () => {
    let result: string;
    try {
      result = interpretMidIRCompilationUnit(testCase.compilationUnit);
    } catch {
      fail(midIRCompilationUnitToString(testCase.compilationUnit));
    }
    expect(result).toBe(testCase.expectedStandardOut);
  });

  it(`IR[cp]: ${testCase.testCaseName}`, () =>
    testMidIROptimizerResult(testCase, (it) =>
      optimizeIRCompilationUnit(it, { doesPerformConstantPropagation: true })
    ));

  it(`IR[copy]: ${testCase.testCaseName}`, () =>
    testMidIROptimizerResult(testCase, (it) =>
      optimizeIRCompilationUnit(it, { doesPerformCopyPropagation: true })
    ));

  it(`IR[vn]: ${testCase.testCaseName}`, () =>
    testMidIROptimizerResult(testCase, (it) =>
      optimizeIRCompilationUnit(it, { doesPerformLocalValueNumbering: true })
    ));

  it(`IR[cse]: ${testCase.testCaseName}`, () =>
    testMidIROptimizerResult(testCase, (it) =>
      optimizeIRCompilationUnit(it, { doesPerformCommonSubExpressionElimination: true })
    ));

  it(`IR[dse]: ${testCase.testCaseName}`, () =>
    testMidIROptimizerResult(testCase, (it) =>
      optimizeIRCompilationUnit(it, { doesPerformDeadCodeElimination: true })
    ));

  it(`IR[inl]: ${testCase.testCaseName}`, () =>
    testMidIROptimizerResult(testCase, (it) =>
      optimizeIRCompilationUnit(it, { doesPerformInlining: true })
    ));

  it(`IR[all]: ${testCase.testCaseName}`, () =>
    testMidIROptimizerResult(testCase, (it) => optimizeIRCompilationUnit(it)));
});