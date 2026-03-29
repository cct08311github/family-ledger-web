import type { Config } from 'jest'

const config: Config = {
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Use @swc/jest instead of ts-jest: natively supports TypeScript 6,
  // avoids the ts-jest 29 peer-dep constraint of "typescript < 6".
  transform: {
    '^.+\\.tsx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', tsx: true },
          target: 'es2017',
          baseUrl: '.',
          paths: { '@/*': ['src/*'] },
        },
      },
    ],
  },
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
}

export default config
