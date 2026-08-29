import { MIGRATION, NUMBERING_VERIFICATION, OPERATOR_RULES } from '../numbering';

/** Every 7-digit national number (leading digit 0-9, second digit 0-9). */
function sampleSevenDigitNumbers(): string[] {
  const samples: string[] = [];
  for (let first = 0; first <= 9; first++) {
    for (let second = 0; second <= 9; second++) {
      samples.push(`${first}${second}12345`);
    }
  }
  return samples;
}

describe('OPERATOR_RULES', () => {
  it('never classifies the same number as two operators', () => {
    for (const number of sampleSevenDigitNumbers()) {
      const matches = OPERATOR_RULES.filter((rule) => rule.matches(number));
      expect(matches.length).toBeLessThanOrEqual(1);
    }
  });

  it('only migrating operators carry a 2-digit prefix', () => {
    for (const rule of OPERATOR_RULES) {
      if (rule.migrating) {
        expect(rule.newPrefix).toMatch(/^\d{2}$/);
      } else {
        expect(rule.newPrefix).toBeNull();
      }
    }
  });

  it('every rule declares a confidence level', () => {
    for (const rule of OPERATOR_RULES) {
      expect(['high', 'medium', 'confirmed']).toContain(rule.confidence);
    }
  });

  it('the three migrating operators use the announced prefixes', () => {
    const prefixes = Object.fromEntries(
      OPERATOR_RULES.filter((r) => r.migrating).map((r) => [r.id, r.newPrefix]),
    );
    expect(prefixes).toEqual({ africell: '87', qcell: '83', comium: '86' });
  });

  it('maps the documented leading digits to the right operator + prefix', () => {
    const convert = (seven: string): string | null => {
      const rule = OPERATOR_RULES.find((r) => r.matches(seven));
      return rule?.migrating ? `${rule.newPrefix}${seven}` : null;
    };

    expect(convert('2123456')).toBe('872123456'); // Africell
    expect(convert('4412345')).toBe('874412345'); // Africell (4xxxxxx reallocated from Gamtel)
    expect(convert('7123456')).toBe('877123456'); // Africell (PURA example: 7xx xxxx -> 87 7xx xxxx)
    expect(convert('3123456')).toBe('833123456'); // QCell
    expect(convert('5012345')).toBe('835012345'); // QCell (5xxxxxx reallocated from Gamtel)
    expect(convert('5912345')).toBe('835912345'); // QCell
    expect(convert('6123456')).toBe('866123456'); // Comium

    expect(convert('9123456')).toBeNull(); // Gamcel — not migrating
    expect(convert('8412345')).toBeNull(); // Gamtel fixed
  });

  it('ignores inputs that are not exactly 7 digits', () => {
    for (const rule of OPERATOR_RULES) {
      expect(rule.matches('712345')).toBe(false);
      expect(rule.matches('71234567')).toBe(false);
      expect(rule.matches('')).toBe(false);
    }
  });
});

describe('MIGRATION', () => {
  it('has the dual-run window in the right order', () => {
    expect(MIGRATION.dualRunStart < MIGRATION.sevenDigitCutoff).toBe(true);
    expect(MIGRATION.oldNationalLength).toBe(7);
    expect(MIGRATION.newNationalLength).toBe(9);
  });
});

describe('NUMBERING_VERIFICATION', () => {
  it('is fully confirmed against PURA’s allocation table', () => {
    expect(NUMBERING_VERIFICATION.status).toBe('confirmed');
    expect(NUMBERING_VERIFICATION.needsOfficialConfirmation).toHaveLength(0);
  });
});
