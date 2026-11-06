import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// Tells the browser where the page may load things from: if someone managed to inject a script,
// it could neither run nor send data anywhere. Build only, because the dev server uses inline scripts.
function contentSecurityPolicy(): Plugin {
  const emulator = process.env.VITE_FIREBASE_EMULATOR
  const firebase = ['*.firebaseio.com', '*.firebasedatabase.app']
  // Firebase uses websockets and, when it cannot, falls back to loading data through scripts.
  const scripts = [...firebase.map((h) => `https://${h}`), ...(emulator ? [`http://${emulator}`] : [])]
  // The anonymous identity comes from Google's authentication servers.
  const identity = ['https://identitytoolkit.googleapis.com', 'https://securetoken.googleapis.com']
  const authEmulator = emulator ? [`http://${emulator.split(':')[0]}:9099`] : []
  const connections = [
    ...scripts, ...firebase.map((h) => `wss://${h}`), ...identity,
    ...(emulator ? [`ws://${emulator}`, ...authEmulator] : []),
  ]
  const policy = [
    "default-src 'self'",
    `script-src 'self' ${scripts.join(' ')}`,
    `connect-src 'self' ${connections.join(' ')}`,
    "style-src 'self' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    "img-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' },
      { tag: 'meta', attrs: { name: 'referrer', content: 'strict-origin-when-cross-origin' }, injectTo: 'head-prepend' },
    ],
  }
}

export default defineConfig({
  plugins: [react(), contentSecurityPolicy()],
  // GitHub Pages serves the app at https://pedrolaino.github.io/Atrapalabras/
  base: '/Atrapalabras/',
})
