// Precisa de um banco descartável e vazio: a trilha é sequencial, então etapas
// deixadas por execuções anteriores bloqueiam as criadas agora.
// Browser journey over the real API: an admin authors and publishes a game, links it
// to the trail, and a trainee plays it. Run with both servers up and a disposable
// database, after seeding the two accounts:
//
//   BASE_URL=http://127.0.0.1:3017 ADMIN_EMAIL=... TRAINEE_EMAIL=... PASSWORD=... \
//     node frontend/tests/games_journey.cjs
const assert = require("node:assert/strict")

let playwright
if (process.env.PLAYWRIGHT_PACKAGE) {
  playwright = require(process.env.PLAYWRIGHT_PACKAGE)
} else {
  try {
    playwright = require("playwright")
  } catch {
    throw new Error("Instale playwright no frontend ou defina PLAYWRIGHT_PACKAGE; veja docs/TESTES.md")
  }
}

const baseURL = process.env.BASE_URL || "http://127.0.0.1:3000"
const adminEmail = process.env.ADMIN_EMAIL
const traineeEmail = process.env.TRAINEE_EMAIL
const password = process.env.PASSWORD || "senha-de-teste"
// Nomes únicos por execução: o banco de teste acumula etapas entre rodadas.
const run = process.env.RUN_ID || Date.now().toString(36).slice(-5)
const title = `Sequência de atendimento ${run}`
const steps = ["Receber o contato", "Entender a necessidade", "Registrar o combinado"]
const nodeName = `Etapa de ordenação ${run}`
const nextNodeName = `Etapa seguinte ${run}`

async function signIn(page, email) {
  await page.goto(`${baseURL}/login`)
  await page.getByLabel("Email", { exact: true }).fill(email)
  await page.getByLabel("Senha", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Entrar", exact: true }).click()
  await page.waitForURL(url => !url.pathname.startsWith("/login"))
}

async function authorAndPublish(page) {
  await page.goto(`${baseURL}/jogos`)
  await page.getByRole("button", { name: "Criar ordenação", exact: true }).click()
  await page.getByLabel("Título do jogo").fill(title)
  await page.getByRole("button", { name: "Adicionar item", exact: true }).click()
  for (const [index, step] of steps.entries()) {
    await page.getByLabel(`${index + 1}ª posição`).fill(step)
  }
  await page.getByLabel("Explicação da sequência (opcional)").fill("Ordem combinada com a equipe.")
  await page.getByRole("button", { name: "Publicar versão", exact: true }).click()
  await page.getByText("Versão 1 publicada. Já pode ser adicionada à trilha.").waitFor()
  console.log("PASS autoria: rascunho preenchido e publicado pela interface")
}

async function previewBeforeLeaving(page) {
  await page.getByRole("button", { name: "Pré-visualizar", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByText("Pré-visualização administrativa.", { exact: false }).waitFor()
  await sortBoard(dialog, steps)
  await dialog.getByRole("button", { name: "Concluir prévia", exact: true }).click()
  await dialog.getByText("Resultado da prévia", { exact: true }).waitFor()
  await dialog.getByText("Ordem combinada com a equipe.", { exact: true }).waitFor()
  await page.keyboard.press("Escape")
  await dialog.waitFor({ state: "hidden" })
  console.log("PASS prévia: jogada de teste mostra resultado e explicação do autor")
}

async function linkToTrail(page) {
  await page.goto(baseURL)
  await page.getByRole("tab", { name: /Trilha/ }).click()
  await page.getByRole("button", { name: "Novo Nó", exact: true }).click()
  await page.locator("select").filter({ has: page.locator('option[value="game"]') }).selectOption("game")
  await page.getByPlaceholder("Se vazio, usa o título do conteúdo selecionado").fill(nodeName)
  const games = page.getByLabel("Jogo publicado")
  const option = await games.locator("option").filter({ hasText: title }).first().getAttribute("value")
  assert.ok(option, "o jogo publicado deve aparecer na lista de seleção da trilha")
  await games.selectOption(option)
  await page.getByLabel("Liberar imediatamente").check()
  await page.getByRole("button", { name: "Criar Nó", exact: true }).click()
  await page.getByText(nodeName, { exact: true }).first().waitFor()
  console.log("PASS trilha: etapa criada e liberada com o jogo publicado")
}

/** Reads the arrangement from the move-up buttons and sorts it with the same controls. */
async function sortBoard(scope, expected) {
  const readOrder = async () => Promise.all(
    (await scope.getByRole("button", { name: /^Mover .+ para cima$/ }).all())
      .map(button => button.getAttribute("aria-label").then(label => label.replace(/^Mover | para cima$/g, ""))))
  let order = await readOrder()
  assert.equal(order.length, expected.length)
  for (let target = 0; target < expected.length; target++) {
    for (let current = order.indexOf(expected[target]); current > target; current--) {
      await scope.getByRole("button", { name: `Mover ${expected[target]} para cima`, exact: true }).click()
      order = await readOrder()
    }
  }
  assert.deepEqual(order, expected)
  return order
}

/** Uma segunda etapa no mesmo eixo prova que a trilha liga e tranca em sequência. */
async function addSecondStep(page) {
  const created = await page.evaluate(async ({ first: firstName, name }) => {
    const token = localStorage.getItem("token")
    const nodes = await (await fetch("/api/nodes", { headers: { Authorization: `Bearer ${token}` } })).json()
    const first = nodes.find(node => node.name === firstName)
    const response = await fetch("/api/nodes", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name, type: "game", eixo: "trainee",
        game_revision_id: first.game_revision_id, is_released: true,
      }),
    })
    return response.ok
  }, { first: nodeName, name: nextNodeName })
  assert.ok(created, "a segunda etapa deveria ser criada")
  console.log("PASS trilha: segunda etapa criada no mesmo eixo")
}

async function playAsTrainee(page) {
  await page.goto(`${baseURL}/trainees`)
  const lines = page.locator("line.trail-link")
  await lines.first().waitFor()
  // A trilha é uma corrente: cada etapa, menos a primeira, chega por uma linha.
  const drawn = await page.locator("div.absolute.z-10").count()
  assert.equal(await lines.count(), drawn - 1, "cada etapa além da primeira deve ter uma linha de entrada")
  const locked = page.getByRole("button", { name: nextNodeName, exact: true })
  assert.equal(await locked.isDisabled(), true, "a segunda etapa espera a primeira")
  console.log("PASS trilha: linha desenhada entre as etapas e a seguinte bloqueada")
  await page.getByRole("button", { name: nodeName, exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByText(title, { exact: true }).waitFor()
  const shuffled = await dialog.getByRole("button", { name: /^Mover .+ para cima$/ }).first().getAttribute("aria-label")
  await sortBoard(dialog, steps)
  await dialog.getByRole("button", { name: "Concluir ordenação", exact: true }).click()
  await dialog.getByText("Jogo concluído", { exact: true }).waitFor()
  await dialog.getByText("Ordem combinada com a equipe.", { exact: true }).waitFor()
  assert.match(await dialog.getByText("/ 100 pontos").locator("..").innerText(), /^100\b/)
  console.log(`PASS jogo: tabuleiro recebido embaralhado ("${shuffled}") e corrigido pelo servidor com 100 pontos`)
  await dialog.getByRole("button", { name: "Voltar à trilha", exact: true }).click()
  await dialog.waitFor({ state: "hidden" })
  // Concluída a primeira, a seguinte abre: é a sequência, não só o desenho.
  await page.getByRole("button", { name: nextNodeName, exact: true }).waitFor()
  assert.equal(await page.getByRole("button", { name: nextNodeName, exact: true }).isDisabled(), false)
  console.log("PASS trilha: a etapa seguinte abre depois de concluir a anterior")
}

async function confirmProgress(page) {
  const nodes = await page.evaluate(async () => {
    const response = await fetch("/api/nodes", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
    return response.json()
  })
  const node = nodes.find(item => item.name === nodeName)
  assert.ok(node, "a etapa deve aparecer na trilha do trainee")
  assert.equal(node.completed, true)
  assert.equal(node.user_score, 100)
  console.log("PASS progresso: etapa concluída com 100 pontos após voltar à trilha")
}

async function main() {
  assert.ok(adminEmail && traineeEmail, "informe ADMIN_EMAIL e TRAINEE_EMAIL")
  const browser = await playwright.chromium.launch({ headless: true })
  try {
    const context = await browser.newContext()
    const page = await context.newPage()
    page.setDefaultTimeout(20000)
    await signIn(page, adminEmail)
    await authorAndPublish(page)
    await previewBeforeLeaving(page)
    await linkToTrail(page)
    await addSecondStep(page)
    await context.close()

    const playing = await browser.newContext()
    const playerPage = await playing.newPage()
    playerPage.setDefaultTimeout(20000)
    await signIn(playerPage, traineeEmail)
    await playAsTrainee(playerPage)
    await confirmProgress(playerPage)
    await playing.close()
    console.log("Jornada completa: autoria, publicação, vínculo com a trilha e jogada verificados no navegador.")
  } finally {
    await browser.close()
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
