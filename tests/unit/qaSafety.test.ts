import { describe, expect, it } from 'vitest';
import { validateQaBrowserEnvironment } from '../setup/qaSafety';

const safe = {
  QA_RUN_ID: '20261007_example', APP_ENV: 'testing',
  PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:15173', QA_API_URL: 'http://127.0.0.1:18007',
  DB_HOST: '127.0.0.1', DB_DATABASE: 'menu_test_QA_RUN_20261007_example_browser',
  QA_API_ROOT: '/tmp/api', QA_RUNTIME_DIR: '/tmp/menu-qa-example', QA_EVIDENCE_DIR: '/tmp/evidence',
};

describe('browser QA target guard', () => {
  it('accepts explicit disposable targets', () => {
    expect(() => validateQaBrowserEnvironment(safe)).not.toThrow();
  });
  it.each(['PLAYWRIGHT_BASE_URL', 'QA_API_URL'])( 'rejects remote URLs, credentials and URL paths in %s', (key) => {
    for (const value of ['https://production.invalid', 'http://user:password@127.0.0.1:15173', 'http://127.0.0.1:15173/api']) {
      expect(() => validateQaBrowserEnvironment({ ...safe, [key]: value })).toThrow();
    }
  });
  it('rejects missing identity, normal databases, remote DBs and mismatched run ownership', () => {
    for (const changes of [{ QA_RUN_ID: '' }, { APP_ENV: 'production' }, { DB_DATABASE: 'restaurantdb' },
      { DB_DATABASE: 'menu_test_QA_RUN_other_browser' }, { DB_HOST: 'db' }, { QA_API_ROOT: '' }, { QA_EVIDENCE_DIR: '' }]) {
      expect(() => validateQaBrowserEnvironment({ ...safe, ...changes })).toThrow();
    }
  });
});
