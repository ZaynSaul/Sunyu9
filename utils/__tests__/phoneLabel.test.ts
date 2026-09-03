import { friendlyPhoneLabel } from '../phoneLabel';

describe('friendlyPhoneLabel', () => {
  it('unwraps iOS Contacts-framework label constants', () => {
    expect(friendlyPhoneLabel('_$!<Mobile>!$_')).toBe('mobile');
    expect(friendlyPhoneLabel('_$!<Home>!$_')).toBe('home');
    expect(friendlyPhoneLabel('_$!<Work>!$_')).toBe('work');
    expect(friendlyPhoneLabel('_$!<Main>!$_')).toBe('main');
    expect(friendlyPhoneLabel('_$!<iPhone>!$_')).toBe('iPhone');
    expect(friendlyPhoneLabel('_$!<HomeFAX>!$_')).toBe('home fax');
    expect(friendlyPhoneLabel('_$!<AppleWatch>!$_')).toBe('Apple Watch');
  });

  it('passes Android friendly names and custom labels straight through', () => {
    expect(friendlyPhoneLabel('mobile')).toBe('mobile');
    expect(friendlyPhoneLabel('work')).toBe('work');
    expect(friendlyPhoneLabel('Grandma')).toBe('Grandma');
    expect(friendlyPhoneLabel('  spaced  ')).toBe('spaced');
  });

  it('returns an empty string for a missing or blank label (no label set)', () => {
    expect(friendlyPhoneLabel(null)).toBe('');
    expect(friendlyPhoneLabel(undefined)).toBe('');
    expect(friendlyPhoneLabel('   ')).toBe('');
  });
});

describe('nativePhoneLabel', () => {
  const load = (os: 'ios' | 'android') => {
    let mod!: typeof import('../phoneLabel');
    jest.isolateModules(() => {
      jest.doMock('react-native', () => ({ Platform: { OS: os } }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      mod = require('../phoneLabel');
    });
    jest.dontMock('react-native');
    return mod;
  };

  it('re-wraps friendly names as the constants iOS localises', () => {
    const { nativePhoneLabel } = load('ios');
    expect(nativePhoneLabel('mobile')).toBe('_$!<Mobile>!$_');
    expect(nativePhoneLabel('home')).toBe('_$!<Home>!$_');
    expect(nativePhoneLabel('iPhone')).toBe('_$!<iPhone>!$_');
    expect(nativePhoneLabel('home fax')).toBe('_$!<HomeFAX>!$_');
    expect(nativePhoneLabel('Grandma')).toBe('Grandma');
  });

  it('leaves labels untouched on Android', () => {
    const { nativePhoneLabel } = load('android');
    expect(nativePhoneLabel('mobile')).toBe('mobile');
    expect(nativePhoneLabel('home fax')).toBe('home fax');
    expect(nativePhoneLabel('Grandma')).toBe('Grandma');
  });

  it('round-trips every standard label back to its exact iOS constant', () => {
    const { friendlyPhoneLabel: friendly, nativePhoneLabel: native } = load('ios');
    for (const constant of [
      '_$!<Mobile>!$_',
      '_$!<iPhone>!$_',
      '_$!<Home>!$_',
      '_$!<Work>!$_',
      '_$!<Main>!$_',
      '_$!<HomeFAX>!$_',
      '_$!<WorkFAX>!$_',
      '_$!<OtherFAX>!$_',
      '_$!<Pager>!$_',
      '_$!<Other>!$_',
      '_$!<AppleWatch>!$_',
    ]) {
      expect(native(friendly(constant))).toBe(constant);
    }
  });
});
