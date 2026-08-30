import { describe, it, expect } from 'vitest';
import { resolveThemeName, getThemePalette, themeDefinitions } from './theme';

describe('theme helpers', () => {
  it('maps legacy dark theme to the default palette', () => {
    expect(resolveThemeName('dark')).toBe('default');
  });

  it('returns the requested palette definition', () => {
    const palette = getThemePalette('map');
    expect(palette.label).toBe('Map');
    expect(palette.bgDark).toContain('--color-bg-dark-map');
  });

  it('uses polished light and ominous theme labels', () => {
    expect(themeDefinitions.light.label).toBe('Parchment');
    expect(themeDefinitions.ominous.label).toBe('Gloom');
  });
});
