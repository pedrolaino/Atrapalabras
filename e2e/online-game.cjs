// Plays a full online game between a phone (Pedro) and a desktop (Juan) and saves screenshots
// to e2e/screenshots/. Needs the Firebase emulators and a build pointed at them (see the README).
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const URL = process.env.URL ?? 'http://localhost:4173/Atrapalabras/'
const SCREENSHOTS = path.join(__dirname, 'screenshots')
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'L', 'M', 'N', 'Ñ', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'X', 'Y', 'Z']

async function device(browser, name, viewport, touch) {
  const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch })
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  let n = 0
  return {
    page,
    errors,
    button: (text) => page.getByRole('button', { name: text, exact: typeof text === 'string' }),
    // Right after a question appears the game ignores taps for a moment (double-tap guard).
    answer: async (text) => {
      await page.waitForTimeout(400)
      await page.getByRole('button', { name: text }).click()
    },
    letter: (l, status, current = false) =>
      page.getByRole('listitem', { name: `${l}: ${status}${current ? ', letra actual' : ''}`, exact: true }).first(),
    turnOf: (player) => page.getByRole('heading', { name: `Turno de ${player}` }).waitFor(),
    async screenshot(what) {
      await page.waitForTimeout(350)
      n++
      await page.screenshot({ path: path.join(SCREENSHOTS, `online-${name}-${String(n).padStart(2, '0')}-${what}.png`) })
    },
    async noScroll(where) {
      const [height, viewportHeight] = await page.evaluate(() => [document.documentElement.scrollHeight, innerHeight])
      assert.ok(height <= viewportHeight, `${name} ${where}: vertical scroll (${height} > ${viewportHeight})`)
    },
  }
}

;(async () => {
  fs.mkdirSync(SCREENSHOTS, { recursive: true })
  const browser = await chromium.launch()
  try {
    const pedro = await device(browser, 'phone', { width: 390, height: 844 }, true)
    const juan = await device(browser, 'desktop', { width: 1440, height: 900 }, false)

    // 1. Pedro creates the room on his phone
    await pedro.page.goto(URL)
    await pedro.page.evaluate(() => localStorage.clear())
    await pedro.page.reload()
    await pedro.button('Jugar online').click()
    await pedro.page.getByLabel('Tu nombre').fill('Pedro')
    await pedro.button('Crear sala').click()
    const code = (await pedro.page.getByLabel(/^Código de la sala:/).getAttribute('aria-label')).replace(/[^A-Z]/g, '').slice(-4)
    assert.match(code, /^[A-Z]{4}$/)
    assert.ok(await pedro.button('Jugar').isDisabled(), 'can play without the other player')
    await pedro.button('Copiar link').click()
    await pedro.button('Link copiado').waitFor()
    const link = await pedro.page.evaluate(() => navigator.clipboard.readText())
    assert.equal(link, `${URL}?sala=${code}`)
    await pedro.screenshot('room-waiting')

    // 2. Juan joins with the link from his desktop
    await juan.page.goto(link)
    await juan.page.evaluate(() => localStorage.clear())
    assert.equal(await juan.page.getByLabel('Código de la sala').inputValue(), code)
    await juan.screenshot('join-with-link')
    await juan.page.getByLabel('Tu nombre').fill('Juan')
    await juan.button('Entrar').click()
    await juan.page.getByText('Esperando que Pedro toque Jugar.').waitFor()
    assert.equal(new globalThis.URL(juan.page.url()).search, '', 'the room link stayed in the address bar')
    await juan.screenshot('room-guest')
    await pedro.page.getByText('Juan', { exact: true }).waitFor()
    await pedro.screenshot('room-full')
    await pedro.button('Jugar').click()

    // 3. Both see the turn notice, with no device hand-over
    for (const d of [pedro, juan]) {
      await d.turnOf('Pedro')
      await d.page.getByText('Te lee Juan.').waitFor()
    }
    await pedro.screenshot('turn')
    await juan.button('Continuar').click()

    // 4. Pedro answers: he never sees the question. Juan reads and scores.
    await pedro.page.getByText('Te está leyendo Juan').waitFor()
    assert.equal(await pedro.page.getByText('Respuesta:').count(), 0, 'the answering player sees the answer')
    assert.equal(await pedro.button(/Correcto/).count(), 0, 'the answering player has the answer buttons')
    await pedro.noScroll('answering')
    await juan.page.getByText('Respuesta:').waitFor()
    // Both clocks show the same time
    const clock = (d) => d.page.locator('.clock').getAttribute('aria-label')
    assert.equal(await clock(pedro), await clock(juan), 'the clocks do not match')
    await juan.answer(/Correcto/)
    await pedro.letter('A', 'acierto').waitFor()
    await juan.answer(/Correcto/)
    await pedro.letter('B', 'acierto').waitFor()
    await pedro.screenshot('answering')
    await juan.screenshot('reading')
    await juan.page.keyboard.press('z') // undo with the keyboard on desktop
    await pedro.letter('B', 'pendiente', true).waitFor()
    await juan.answer(/Correcto/)
    await juan.answer(/Pasa/)

    // 5. Between turns: either player continues. Now Juan answers and Pedro reads.
    for (const d of [pedro, juan]) await d.turnOf('Juan')
    await pedro.page.getByText('Te lee Pedro.').waitFor()
    await pedro.screenshot('between-turns')
    await pedro.button('Continuar').click()
    await juan.page.getByText('Te está leyendo Pedro').waitFor()
    assert.equal(await juan.page.getByText('Respuesta:').count(), 0, 'the answering player sees the answer')
    await juan.screenshot('answering')
    await pedro.page.getByText('Respuesta:').waitFor()
    await pedro.screenshot('reading')
    await pedro.answer(/Incorrecto/)

    // 6. Pause: the answering player pauses and the reader resumes
    for (const d of [pedro, juan]) await d.turnOf('Pedro')
    await juan.page.keyboard.press('Enter')
    await pedro.letter('D', 'pendiente', true).waitFor()
    await pedro.button(/Pausa/).click()
    await juan.page.getByRole('dialog', { name: 'Partida en pausa' }).waitFor()
    await juan.screenshot('pause')
    await juan.button('Continuar').click()
    await pedro.page.getByRole('dialog').waitFor({ state: 'detached' })

    // 7. Pedro reloads mid-turn: he goes back to the same room and seat on his own
    await juan.answer(/Correcto/) // D
    await pedro.page.reload()
    await pedro.page.getByText('Te está leyendo Juan').waitFor()
    await pedro.letter('D', 'acierto').waitFor()
    await pedro.letter('E', 'pendiente', true).waitFor()
    await pedro.screenshot('after-reload')

    // 8. Pedro gets everything left (E..Z and C) and finishes
    for (const l of [...LETTERS.slice(4), 'C']) {
      await juan.letter(l, 'pendiente', true).waitFor()
      await juan.answer(/Correcto/)
    }
    for (const d of [pedro, juan]) await d.turnOf('Juan')
    await pedro.page.getByText('Pedro ya terminó: Juan sigue solo hasta terminar.').waitFor()
    await juan.button('Continuar').click()
    for (const l of LETTERS.slice(1)) {
      await pedro.letter(l, 'pendiente', true).waitFor()
      await pedro.answer(/Correcto/)
    }

    // 9. Final screen: both see the result and every question
    for (const d of [pedro, juan]) {
      await d.page.getByRole('heading', { name: '¡Ganó Pedro!' }).waitFor()
      assert.equal(await d.page.getByText('Respuesta:').count(), 50, 'questions missing on the final screen')
    }
    await pedro.screenshot('final')
    await juan.screenshot('final')

    // Both recorded the 50 questions; the rematch repeats none of them
    const used = (d) => d.page.evaluate(() => JSON.parse(localStorage.getItem('atrapalabras:usedQuestions') ?? '[]'))
    const first = new Set(await used(pedro))
    assert.equal(first.size, 50)
    assert.deepEqual(new Set(await used(juan)), first)
    await juan.button('Revancha').click()
    for (const d of [pedro, juan]) await d.turnOf('Pedro')
    await pedro.page.waitForFunction(() => JSON.parse(localStorage.getItem('atrapalabras:usedQuestions')).length === 100)
    const all = await used(pedro)
    assert.equal(new Set(all).size, 100, 'the rematch repeated questions')

    // 10. Quitting from the pause sends both back to the room; leaving goes to the start screen
    await pedro.button('Continuar').click()
    await juan.button(/Pausa/).click()
    await juan.button('Abandonar partida').click()
    await juan.button('Sí, abandonar').click()
    await pedro.button('Jugar').waitFor()
    await juan.page.getByText('Esperando que Pedro toque Jugar.').waitFor()
    await juan.button('Salir de la sala').click()
    await juan.button('Jugar online').waitFor()

    for (const d of [pedro, juan]) assert.deepEqual(d.errors, [], 'page errors')
    console.log(`✔ full online game between phone and desktop (room ${code})`)
  } finally {
    await browser.close()
  }
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
