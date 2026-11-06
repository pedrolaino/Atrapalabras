// Plays full games in a real browser (phone and desktop) and saves screenshots to e2e/screenshots/.
// Usage: npm run build, serve it (npx vite preview), then npm run e2e
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const URL = process.env.URL ?? 'http://localhost:4173/Atrapalabras/'
const SCREENSHOTS = path.join(__dirname, 'screenshots')
const DEVICES = [
  { name: 'phone', viewport: { width: 390, height: 844 }, touch: true },
  { name: 'desktop', viewport: { width: 1440, height: 900 }, touch: false },
]

async function run({ name, viewport, touch }, browser) {
  const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (/Content Security Policy/i.test(m.text())) errors.push(m.text()) })
  await page.clock.install() // controllable clock, to test running out of time without waiting

  let n = 0
  const screenshot = async (what, fullPage = false) => {
    await page.waitForTimeout(350) // let color transitions finish
    n++
    await page.screenshot({ path: path.join(SCREENSHOTS, `${name}-${String(n).padStart(2, '0')}-${what}.png`), fullPage })
  }
  const noScroll = async (where) => {
    const [height, viewportHeight, width, viewportWidth] = await page.evaluate(() => [
      document.documentElement.scrollHeight, innerHeight, document.documentElement.scrollWidth, innerWidth,
    ])
    assert.ok(width <= viewportWidth, `${name} ${where}: horizontal scroll`)
    assert.ok(height <= viewportHeight, `${name} ${where}: vertical scroll (${height} > ${viewportHeight})`)
  }
  const letter = (l, status, current = false) =>
    page.getByRole('listitem', { name: `${l}: ${status}${current ? ', letra actual' : ''}`, exact: true })
  const button = (text) => page.getByRole('button', { name: text, exact: typeof text === 'string' })
  // Answers always go through the buttons. On desktop, continue, pause and undo use the keyboard.
  const keys = { Continuar: 'Enter', Pausa: 'Space', Deshacer: 'z' }
  const tap = async (action) => {
    // Right after a question appears the game ignores taps for a moment (double-tap guard).
    if (/^(Correcto|Incorrecto|Pasa)$/.test(action)) await page.waitForTimeout(400)
    if (touch || !keys[action]) await button(new RegExp(`^${action}`)).first().click()
    else await page.keyboard.press(keys[action])
  }
  const turnOf = (player) => page.getByRole('heading', { name: `Turno de ${player}` }).waitFor()

  // 1. Start screen
  await page.goto(URL)
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByRole('heading', { name: 'Atrapalabras' }).waitFor()
  assert.ok(await page.getByText('25 Letras').isVisible(), 'subtitle missing')
  await screenshot('start')
  await page.getByLabel('Jugador 1').fill('Juan')
  await page.getByLabel('Jugador 2').fill('Pedro')
  await button('Jugar').click()

  // 2. Hand the device over
  await turnOf('Juan')
  await page.getByText('Pasale el dispositivo a Pedro para que te lea.').waitFor()
  await screenshot('hand-over')
  await tap('Continuar')

  // 3. Game: Juan gets A and B, undoes B, gets it again and passes C
  await page.getByText('Respuesta:').waitFor()
  await noScroll('game')
  await tap('Correcto')
  await tap('Correcto')
  await letter('B', 'acierto').waitFor()
  // The sound button must not change the height of the top bar
  const barHeight = () => page.locator('.game__bar').evaluate((e) => e.offsetHeight)
  const heightBefore = await barHeight()
  await button('Silenciar').click()
  assert.equal(await barHeight(), heightBefore, 'the sound button changes the bar height')
  await button('Silenciar').click()
  await screenshot('game')
  await tap('Deshacer')
  await letter('B', 'pendiente', true).waitFor()
  await tap('Correcto')
  await tap('Pasa')

  // 4. Between turns: statuses only, never questions
  await turnOf('Pedro')
  assert.equal(await page.getByText('Respuesta:').count(), 0, 'an answer is visible between turns')
  await noScroll('between turns')
  await screenshot('between-turns')
  await tap('Continuar')

  // Pedro misses A; it is undone from the between-turns screen and he misses it again
  await tap('Incorrecto')
  await turnOf('Juan')
  await tap('Deshacer')
  await letter('A', 'pendiente', true).waitFor()
  await tap('Incorrecto')
  await turnOf('Juan')
  await tap('Continuar')

  // 5. Pause (space bar on desktop)
  await letter('D', 'pendiente', true).waitFor()
  await tap('Pausa')
  await page.getByRole('dialog', { name: 'Partida en pausa' }).waitFor()
  assert.ok(await page.getByText('Pregunta oculta durante la pausa.').isVisible())
  await screenshot('pause')
  if (touch) await button(/Continuar/).click()
  else await page.keyboard.press('Space')
  await page.getByRole('dialog').waitFor({ state: 'detached' })

  // 6. Reload mid-game: comes back paused with everything as it was
  await tap('Correcto') // D
  await page.reload()
  await page.getByRole('dialog', { name: 'Partida en pausa' }).waitFor()
  await letter('D', 'acierto').waitFor()
  await letter('C', 'pendiente').waitFor()
  await letter('E', 'pendiente', true).waitFor()
  await screenshot('after-reload')
  await button(/Continuar/).click()

  // Juan gets everything left (E..Z, then the pending C) and finishes his wheel
  for (let i = 0; i < 21; i++) await tap('Correcto')
  await letter('C', 'pendiente', true).waitFor()
  await tap('Correcto')
  await turnOf('Pedro')
  await page.getByText('Juan ya terminó: Pedro sigue solo hasta terminar.').waitFor()
  await screenshot('between-turns-one-done')
  await tap('Continuar')

  // Pedro plays alone: passing stops the clock and waits for Continue (no hand-over)
  await tap('Pasa')
  await turnOf('Pedro')
  assert.equal(await page.getByText(/Pasale el dispositivo/).count(), 0, 'asks to hand the device over with no player change')
  await screenshot('pass-playing-alone')
  await tap('Continuar')
  // a wrong answer does not end the turn
  await tap('Correcto')
  await tap('Incorrecto')
  assert.equal(await page.getByRole('heading', { name: /Turno de/ }).count(), 0, 'a wrong answer ended the turn with the opponent done')

  // 7. Time up: fast-forward the clock to the last seconds
  await page.clock.fastForward('02:55')
  await page.locator('.clock--warning').waitFor()
  await screenshot('last-seconds')
  await page.clock.fastForward('00:10')

  // 8. Final screen
  await page.getByRole('heading', { name: '¡Ganó Juan!' }).waitFor()
  await screenshot('final')
  await screenshot('final-full', true)
  const flag = page.getByRole('button', { name: /Marcar como mala/ }).first()
  await flag.click()
  await page.getByRole('button', { name: /Marcada como mala/ }).first().waitFor()
  await button('Volver al inicio').click()
  await page.getByText('Preguntas marcadas como malas (1)').waitFor()
  await screenshot('start-with-flagged-questions')

  assert.deepEqual(errors, [], `${name}: page errors`)
  await context.close()
  console.log(`✔ ${name}: full game with no problems (${n} screenshots)`)
}

;(async () => {
  fs.mkdirSync(SCREENSHOTS, { recursive: true })
  const browser = await chromium.launch()
  try {
    for (const d of DEVICES) await run(d, browser)
  } finally {
    await browser.close()
  }
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
