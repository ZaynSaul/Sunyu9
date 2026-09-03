import { mapContact, mapPhoneNumber, type RawContactInput } from '../contactMapper';

describe('mapPhoneNumber', () => {
  it('keeps the original formatting and derives a digits-only form', () => {
    expect(mapPhoneNumber({ id: '1', label: 'mobile', number: '  +220 712 3456 ' })).toEqual({
      id: '1',
      label: 'mobile',
      original: '+220 712 3456',
      digits: '2207123456',
    });
  });

  it('leaves the label empty when none is stored (display fills in "Other")', () => {
    expect(mapPhoneNumber({ id: '2', number: '7123456' })?.label).toBe('');
    expect(mapPhoneNumber({ id: '3', label: '  ', number: '7123456' })?.label).toBe('');
  });

  it('returns null for entries with no usable number', () => {
    expect(mapPhoneNumber({ id: '4', label: 'home', number: '' })).toBeNull();
    expect(mapPhoneNumber({ id: '5', label: 'home' })).toBeNull();
  });

  it('preserves a null id', () => {
    // @ts-expect-error — exercising a malformed native row
    expect(mapPhoneNumber({ label: 'work', number: '4491234' }).id).toBeNull();
  });
});

describe('mapContact', () => {
  const base: RawContactInput = { id: 'c1', givenName: 'Musa', familyName: 'Jallow' };

  it('maps a contact with multiple numbers, evaluating each independently', () => {
    const result = mapContact({
      ...base,
      phones: [
        { id: 'p1', label: 'mobile', number: '7123456' },
        { id: 'p2', label: 'work', number: '4491234' },
        { id: 'p3', label: 'home', number: '+220 83 7123456' },
      ],
    });

    expect(result?.name).toBe('Musa Jallow');
    expect(result?.phoneNumbers).toHaveLength(3);
    expect(result?.phoneNumbers.map((p) => p.digits)).toEqual([
      '7123456',
      '4491234',
      '220837123456',
    ]);
  });

  it('drops phone entries with no number but keeps the contact', () => {
    const result = mapContact({
      ...base,
      phones: [
        { id: 'p1', label: 'mobile', number: '7123456' },
        { id: 'p2', label: 'work', number: '' },
      ],
    });
    expect(result?.phoneNumbers).toHaveLength(1);
  });

  it('returns null when the contact has no usable phone number', () => {
    expect(mapContact({ ...base, phones: [] })).toBeNull();
    expect(mapContact({ ...base, phones: [{ id: 'p1', label: 'home', number: ' ' }] })).toBeNull();
  });

  it('builds a display name from fullName, then name parts, then company, then number', () => {
    expect(
      mapContact({ id: 'a', fullName: 'Dr. Fatou Ceesay', phones: [{ id: 'p', number: '3123456' }] })
        ?.name,
    ).toBe('Dr. Fatou Ceesay');

    expect(
      mapContact({ id: 'b', givenName: 'Alieu', phones: [{ id: 'p', number: '3123456' }] })?.name,
    ).toBe('Alieu');

    expect(
      mapContact({ id: 'c', company: 'Gamtel', phones: [{ id: 'p', number: '4412345' }] })?.name,
    ).toBe('Gamtel');

    expect(
      mapContact({ id: 'd', phones: [{ id: 'p', label: 'mobile', number: '7123456' }] })?.name,
    ).toBe('7123456');
  });
});
