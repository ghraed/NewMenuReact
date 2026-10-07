export function validateQaBrowserEnvironment(env: Record<string, string | undefined>) {
  const run = env.QA_RUN_ID;
  if (!run || !/^[A-Za-z0-9_]{1,40}$/.test(run) || env.APP_ENV !== 'testing') {
    throw new Error('Browser tests require an explicit QA run in APP_ENV=testing. Use the disposable QA runner.');
  }
  for (const key of ['PLAYWRIGHT_BASE_URL', 'QA_API_URL']) {
    const url = new URL(env[key] || 'about:blank');
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port
      || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error(`${key} must be an explicit HTTP loopback origin with a port.`);
    }
  }
  if (env.DB_HOST !== '127.0.0.1' || env.DB_DATABASE !== `menu_test_QA_RUN_${run}_browser`
    || !env.QA_API_ROOT || !env.QA_RUNTIME_DIR || !env.QA_EVIDENCE_DIR) {
    throw new Error('Browser fixtures require the run-owned disposable database and API runtime.');
  }
}
