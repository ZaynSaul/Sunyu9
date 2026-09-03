import type { ConversionOutcome } from '@/types';
import { convertNumber, formatNewNational, toE164 } from '../numberConverter';

/** Shorthand: run the pipeline and return the outcome. */
const run = (raw: string): ConversionOutcome => convertNumber(raw);

describe('convertNumber — convertible old numbers', () => {
  it.each([
    ['Africell 2xxxxxx', '2345678', 'africell', '872345678'],
    ['Africell 4xxxxxx', '4123456', 'africell', '874123456'],
    ['Africell 7xxxxxx', '7123456', 'africell', '877123456'],
    ['QCell 3xxxxxx', '3123456', 'qcell', '833123456'],
    ['QCell 5xxxxxx', '5123456', 'qcell', '835123456'],
    ['Comium 6xxxxxx', '6123456', 'comium', '866123456'],
  ])('%s', (_label, input, operator, newNational) => {
    const outcome = run(input);
    expect(outcome.status).toBe('convertible');
    if (outcome.status !== 'convertible') return;
    expect(outcome.operator).toBe(operator);
    expect(outcome.oldNational).toBe(input);
    expect(outcome.newNational).toBe(newNational);
    expect(outcome.e164).toBe(`+220${newNational}`);
  });

  it.each([
    ['spaces', '712 3456'],
    ['dashes', '712-34-56'],
    ['parens', '(712) 3456'],
    ['+220 with spaces', '+220 712 3456'],
    ['00220', '00220 7123456'],
    ['bare 220', '2207123456'],
    ['+220 with trunk zero', '+220 (0) 7123456'],
  ])('normalises %s to the same conversion', (_label, input) => {
    const outcome = run(input);
    expect(outcome.status).toBe('convertible');
    if (outcome.status !== 'convertible') return;
    expect(outcome.newNational).toBe('877123456');
  });

  it('groups the migrated national number as XX XXX XXXX', () => {
    const outcome = run('7123456');
    if (outcome.status !== 'convertible') throw new Error('expected convertible');
    expect(outcome.display).toBe('87 712 3456');
    // raw 9-digit form is still available for classification / E.164
    expect(outcome.newNational).toBe('877123456');
  });

  it('keeps the +220 in the display when the original had a country code', () => {
    const national = run('7123456');
    const international = run('+220 712 3456');
    if (national.status !== 'convertible' || international.status !== 'convertible') {
      throw new Error('expected convertible');
    }
    expect(national.display).toBe('87 712 3456');
    expect(international.display).toBe('+220 87 712 3456');
    // A bare local number is written as plain digits (iOS strips added spacing);
    // one that had a country code keeps the grouped international form.
    expect(national.target).toBe('877123456');
    expect(international.target).toBe('+220 87 712 3456');
    // E.164 stays canonical (unbroken) for any programmatic use
    expect(international.e164).toBe('+220877123456');
  });
});

describe('convertNumber — left untouched', () => {
  it('leaves Gamcel numbers alone (not in this phase)', () => {
    expect(run('9123456')).toEqual({
      status: 'not-applicable',
      reason: 'operator-not-migrating',
      kind: 'old-national',
    });
  });

  it('leaves Gamtel fixed lines alone (8xxxxxx)', () => {
    expect(run('8412345')).toMatchObject({ status: 'not-applicable', reason: 'fixed-line' });
  });

  it('skips a 7-digit number in no known operator range', () => {
    expect(run('1123456')).toMatchObject({ status: 'not-applicable', reason: 'unknown-range' });
  });

  it('recognises an already-migrated number', () => {
    expect(run('877123456')).toEqual({
      status: 'already-migrated',
      operator: 'africell',
      newNational: '877123456',
      e164: '+220877123456',
    });
    expect(run('+220 87 712 3456')).toMatchObject({ status: 'already-migrated', operator: 'africell' });
  });

  it('does not treat a malformed 9-digit number as migrated', () => {
    expect(run('123456789')).toMatchObject({ status: 'not-applicable', reason: 'unknown-range' });
    expect(run('875012345')).toMatchObject({ status: 'not-applicable', reason: 'unknown-range' });
  });

  it('flags non-Gambian numbers', () => {
    expect(run('+1 202 555 0143')).toMatchObject({ status: 'not-applicable', reason: 'non-gambian' });
    expect(run('+221 77 123 45 67')).toMatchObject({ status: 'not-applicable', reason: 'non-gambian' });
  });

  it('does not reinterpret a malformed +220 number as national', () => {
    // `+220` + 4 digits: `220` is unambiguously the country code, so the 4-digit
    // remainder is just too short — it must NOT be read as the national number
    // `2207890` and "converted".
    expect(run('+220 7890')).toMatchObject({ status: 'not-applicable', reason: 'unknown-range' });
    expect(run('+220 1234')).toMatchObject({ status: 'not-applicable', reason: 'unknown-range' });
    expect(run('00220 1234')).toMatchObject({ status: 'not-applicable', reason: 'unknown-range' });
    // but a bare national number that happens to start with 22 is still fine
    expect(run('2207890')).toMatchObject({ status: 'convertible', newNational: '872207890' });
  });

  it('flags short codes', () => {
    expect(run('116')).toMatchObject({ status: 'not-applicable', reason: 'short-code' });
    expect(run('1422')).toMatchObject({ status: 'not-applicable', reason: 'short-code' });
  });
});

describe('convertNumber — invalid input', () => {
  it.each([
    ['empty', '', 'empty'],
    ['whitespace', '   ', 'empty'],
    ['too short', '12', 'too-short'],
    ['letters / extension', '7123456 ext 12', 'non-dialable'],
    ['vanity number', 'CALL-ME', 'non-dialable'],
  ])('%s -> invalid:%s', (_label, input, reason) => {
    expect(run(input)).toEqual({ status: 'invalid', reason });
  });
});

describe('idempotency', () => {
  it('converting an already-converted number is a no-op', () => {
    const first = run('7123456');
    if (first.status !== 'convertible') throw new Error('expected convertible');
    expect(run(first.newNational).status).toBe('already-migrated');
    expect(run(first.e164).status).toBe('already-migrated');
    // the grouped form we actually write back must also be recognised on re-scan
    expect(run(first.target).status).toBe('already-migrated');
    expect(run('+220 87 712 3456').status).toBe('already-migrated');
  });
});

describe('helpers', () => {
  it('formatNewNational groups a 9-digit number as XX XXX XXXX', () => {
    expect(formatNewNational('877123456')).toBe('87 712 3456');
    expect(formatNewNational('833435355')).toBe('83 343 5355');
    expect(formatNewNational('12345')).toBe('12345'); // not 9 digits — passthrough
  });

  it('toE164 prefixes +220', () => {
    expect(toE164('877123456')).toBe('+220877123456');
  });
});
