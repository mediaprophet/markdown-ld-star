
export default {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  transform: { '^.+\\.(ts|mts|tsx)$': ['ts-jest', { useESM: true }] },
  extensionsToTreatAsEsm: ['.ts', '.mts'],
  preset: 'ts-jest/presets/js-with-ts-esm',
  globals: {
    'ts-jest': {
      useESM: true,
      tsconfig: 'tsconfig.json',
    }
  },
  moduleNameMapper: {
    '^(\.{1,2}/.*)\.js$': '$1'
  }
};
