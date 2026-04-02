module.exports = {
  apps: [{
    name: 'family-ledger-web',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 3001',
    cwd: '/Users/openclaw/.openclaw/shared/projects/family-ledger-web',
    exec_mode: 'fork',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: '3001'
    }
  }],
}
