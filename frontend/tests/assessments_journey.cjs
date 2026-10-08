// Precisa de um banco descartável e vazio: a trilha é sequencial e a média esperada
// considera só as notas criadas aqui.
// Browser journey over the real API: an admin sets repetition, requirement and weight on
// a game step and an activity through the UI; a trainee plays and delivers once, the
// weighted average combines both, and enabling repetition later keeps the best grade.
//
//   BASE_URL=http://127.0.0.1:3017 ADMIN_EMAIL=... TRAINEE_EMAIL=... PASSWORD=... \
//     node frontend/tests/assessments_journey.cjs
const assert = require("node:assert/strict")

// Concluir a última etapa abre a comemoração da trilha depois do diálogo da etapa.
async function closeCelebration(page) {
  const celebration = page.getByRole("dialog", { name: /^Parabéns/ })
  await celebration.getByRole("button", { name: "Continuar" }).click()
  await celebration.waitFor({ state: "hidden" })
}

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
const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com"
const traineeEmail = process.env.TRAINEE_EMAIL || "trainee@example.com"
const password = process.env.PASSWORD || "qa-test-password"

const run = Date.now().toString(36).slice(-5)
const gameTitle = `Quiz avaliado ${run}`
const gameNode = `Jogo avaliado ${run}`
const activityTitle = `Entrega única ${run}`

async function signIn(page, email) {
  await page.goto(`${baseURL}/login`)
  await page.getByLabel("Email", { exact: true }).fill(email)
  await page.getByLabel("Senha", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Entrar", exact: true }).click()
  await page.waitForURL(url => !url.pathname.startsWith("/login"))
}

async function call(page, method, path, body) {
  return page.evaluate(async ({ method, path, body }) => {
    const response = await fetch(path, { method, headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`, "Content-Type": "application/json",
    }, body: body ? JSON.stringify(body) : undefined })
    const text = await response.text()
    if (!response.ok) throw new Error(`${method} ${path} ${response.status} ${text}`)
    return text ? JSON.parse(text) : null
  }, { method, path, body })
}

async function main() {
  const browser = await playwright.chromium.launch({ headless: true })
  try {
    const admin = await (await browser.newContext()).newPage()
    admin.setDefaultTimeout(15000)
    await signIn(admin, adminEmail)
    const game = await call(admin, "POST", "/api/games", { title: gameTitle, eixo: "trainee", format: "quiz", config: { questions: [
      { id: "q", text: "Qual a resposta?", options: [{ id: "yes", text: "Certa", is_correct: true }, { id: "no", text: "Errada" }] },
    ] } })
    await call(admin, "POST", `/api/games/${game.id}/publish`, {})

    // Nó de jogo: tentativa única, obrigatório, peso 3.
    await admin.goto(baseURL)
    await admin.getByRole("tab", { name: /Trilha/ }).click()
    await admin.getByRole("button", { name: "Novo Nó", exact: true }).click()
    await admin.locator("#node-type").selectOption("game")
    await admin.getByPlaceholder("Se vazio, usa o título do conteúdo selecionado").fill(gameNode)
    const games = admin.getByLabel("Jogo publicado")
    await games.selectOption(await games.locator("option").filter({ hasText: gameTitle }).first().getAttribute("value"))
    const retry = admin.getByRole("switch", { name: "Permitir repetição" })
    assert.equal(await retry.getAttribute("aria-checked"), "true")
    await retry.click()
    await admin.getByText("Apenas uma entrega ou tentativa concluída por participante.").waitFor()
    await admin.getByLabel("Peso da nota").fill("3")
    await admin.getByLabel("Liberar imediatamente").check()
    await admin.getByRole("button", { name: "Criar Nó", exact: true }).click()
    await admin.getByText(gameNode, { exact: true }).first().waitFor()
    let nodes = await call(admin, "GET", "/api/nodes")
    const created = nodes.find(node => node.name === gameNode)
    assert.deepEqual([created.allow_retry, created.is_required, created.weight], [false, true, 3])
    await admin.locator('[data-slot="card"]').filter({ hasText: gameNode }).getByText("Obrigatória · peso 3 · Sem repetição", { exact: true }).waitFor()
    console.log("PASS admin: nó de jogo criado com tentativa única, obrigatório e peso 3")

    // Atividade: envio único, obrigatória, peso 2.
    await admin.getByRole("tab", { name: "Atividades", exact: true }).click()
    await admin.getByRole("button", { name: "Nova Atividade", exact: true }).click()
    await admin.getByPlaceholder("Ex: Relatório de Prospecção").fill(activityTitle)
    await admin.locator("#activity-axis").selectOption("trainee")
    await admin.getByRole("switch", { name: "Permitir repetição" }).click()
    await admin.getByLabel("Peso da nota").fill("2")
    // Sem anexo obrigatório, a entrega pode ser só um comentário.
    await admin.locator("#accepts_file_check").uncheck()
    await admin.getByRole("button", { name: "Criar Atividade", exact: true }).click()
    const activityCard = admin.locator('[data-slot="card"]').filter({ hasText: activityTitle })
    await activityCard.getByText("Peso 2", { exact: true }).waitFor()
    await activityCard.getByText("Envio único", { exact: true }).waitFor()
    const activity = (await call(admin, "GET", "/api/activities")).find(item => item.title === activityTitle)
    assert.deepEqual([activity.allow_retry, activity.is_required, activity.weight, activity.accepts_file], [false, true, 2, false])
    const activityNode = await call(admin, "POST", "/api/nodes", { type: "activity", eixo: "trainee", activity_id: activity.id, is_released: true })
    console.log("PASS admin: atividade criada com envio único, obrigatória e peso 2")

    // Trainee joga: nota 10, sem repetição, resultado mantido ao recarregar.
    const trainee = await (await browser.newContext()).newPage()
    trainee.setDefaultTimeout(15000)
    await signIn(trainee, traineeEmail)
    await trainee.goto(`${baseURL}/trainees`)
    await trainee.getByRole("button", { name: gameNode, exact: true }).click()
    await trainee.waitForURL(`**/trilha/${created.id}/jogar`)
    await trainee.getByText("Obrigatório · peso 3 · Tentativa única", { exact: true }).waitFor()
    await trainee.getByLabel("Certa", { exact: true }).check()
    await trainee.getByRole("button", { name: "Concluir questionário", exact: true }).click()
    await trainee.getByText("Nota: 10.00 / 10", { exact: true }).waitFor()
    await trainee.getByText("A repetição deste jogo não está permitida.", { exact: true }).waitFor()
    assert.equal(await trainee.getByRole("button", { name: "Repetir jogo" }).count(), 0)
    await trainee.reload()
    await trainee.getByText("Nota: 10.00 / 10", { exact: true }).waitFor()
    assert.equal(await trainee.getByRole("button", { name: "Concluir questionário" }).count(), 0)
    console.log("PASS trainee: jogo dá nota 10/10, não oferece repetição e mantém o resultado ao recarregar")
    await trainee.getByRole("button", { name: "Voltar à trilha", exact: true }).click()
    await trainee.waitForURL("**/trainees")

    // Trainee entrega a atividade uma única vez.
    await trainee.getByRole("button", { name: activityNode.name, exact: true }).click()
    let dialog = trainee.getByRole("dialog").filter({ hasNot: trainee.getByRole("heading", { name: /^Parabéns/ }) })
    await dialog.getByText("Obrigatória · peso 2 · Envio único", { exact: true }).waitFor()
    await dialog.getByPlaceholder("Adicione observações...").fill("Minha entrega")
    await dialog.getByRole("button", { name: "Enviar atividade e concluir etapa", exact: true }).click()
    await dialog.waitFor({ state: "hidden" })
    await closeCelebration(trainee)
    await trainee.getByRole("button", { name: activityNode.name, exact: true }).click()
    await dialog.getByText("Atividade já enviada. A repetição não está permitida.", { exact: true }).waitFor()
    assert.equal(await dialog.getByRole("button", { name: /Atualizar envio|Enviar atividade/ }).count(), 0)
    console.log("PASS trainee: atividade de envio único não mostra novo envio")
    await trainee.keyboard.press("Escape")

    // Média ponderada: (10*3 + 4*2) / 5 = 7.60.
    const [submission] = await call(admin, "GET", `/api/activities/${activity.id}/submissions`)
    await call(admin, "PATCH", `/api/activities/${activity.id}/submissions/${submission.id}`, { grade: 4 })
    await admin.reload()
    await admin.getByRole("tab", { name: /Notas/ }).click()
    await admin.locator("tr").filter({ hasText: "Trainee" }).first().getByText("7.60", { exact: true }).waitFor()
    console.log("PASS notas: jogo (10, peso 3) e entrega (4, peso 2) dão média 7.60")

    // Admin libera a repetição pelo diálogo de edição; o trainee passa a ver "Repetir jogo".
    await admin.getByRole("tab", { name: /Trilha/ }).click()
    const card = admin.locator('[data-slot="card"]').filter({ hasText: gameNode })
    await card.getByRole("button", { name: "Editar nó", exact: true }).click()
    const editor = admin.getByRole("dialog")
    const editRetry = editor.getByRole("switch", { name: "Permitir repetição" })
    assert.equal(await editRetry.getAttribute("aria-checked"), "false")
    await editRetry.click()
    await editor.getByRole("button", { name: "Salvar alterações", exact: true }).click()
    await editor.waitFor({ state: "hidden" })
    nodes = await call(admin, "GET", "/api/nodes")
    assert.equal(nodes.find(node => node.id === created.id).allow_retry, true)
    await trainee.goto(`${baseURL}/trilha/${created.id}/jogar`)
    await trainee.getByText("Obrigatório · peso 3 · Repetição permitida · vale a melhor nota · nota mínima 7 para avançar", { exact: true }).waitFor()
    await trainee.getByLabel("Errada", { exact: true }).check()
    await trainee.getByRole("button", { name: "Concluir questionário", exact: true }).click()
    await trainee.getByText("Nota: 0.00 / 10", { exact: true }).waitFor()
    await trainee.getByText("Melhor nota: 10.00 / 10", { exact: true }).waitFor()
    await trainee.getByRole("button", { name: "Repetir jogo", exact: true }).waitFor()
    await admin.reload()
    await admin.getByRole("tab", { name: /Notas/ }).click()
    await admin.locator("tr").filter({ hasText: "Trainee" }).first().getByText("7.60", { exact: true }).waitFor()
    console.log("PASS edição: repetição liberada pelo editor; tentativa pior mantém a melhor nota e a média")

    // Celular: a página do jogo cabe na largura sem rolagem horizontal.
    await trainee.setViewportSize({ width: 375, height: 800 })
    await trainee.reload()
    await trainee.getByRole("button", { name: "Concluir questionário", exact: true }).waitFor()
    const overflow = await trainee.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    assert.ok(overflow <= 0, `rolagem horizontal de ${overflow}px`)
    console.log("PASS celular: página do jogo sem rolagem horizontal")
    console.log("Repetição, obrigatoriedade, peso e média ponderada verificados no navegador.")
  } finally { await browser.close() }
}

main().catch(error => { console.error(error); process.exit(1) })
