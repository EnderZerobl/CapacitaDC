// Run with a frontend server: BASE_URL=http://127.0.0.1:3017 node frontend/tests/progress_journey.cjs
// Covers partial answers, the minimum grade to advance, the trail celebration and
// member gamification. All API responses are intercepted; no database is touched.
const assert = require("node:assert/strict")

let playwright
if (process.env.PLAYWRIGHT_PACKAGE) {
  playwright = require(process.env.PLAYWRIGHT_PACKAGE)
} else {
  try { playwright = require("playwright") }
  catch { throw new Error("Instale playwright no frontend ou defina PLAYWRIGHT_PACKAGE; veja docs/TESTES.md") }
}

const baseURL = process.env.BASE_URL || "http://127.0.0.1:3000"
const member = { id: "progress-member", name: "Pessoa Teste", email: "membro@example.test", type: "membro", cargo: "membro", eixo: "Vendas", pontos_acumulados: 0 }
const trainee = { ...member, id: "progress-trainee", email: "trainee@example.test", type: "trainee", cargo: "trainee", eixo: null }
const fulfill = (route, status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) })
const step = (id, extra = {}) => ({ id, name: `Etapa ${id}`, type: "material", eixo: "trainee", order_index: 0, is_released: true,
  released_at: null, unlocked: true, completed: true, user_score: 0, questions: [], is_required: true, ...extra })

async function open(browser, user, handle, options = {}) {
  const context = await browser.newContext({ locale: "pt-BR", ...options })
  const page = await context.newPage()
  page.setDefaultTimeout(15000)
  const calls = []
  await context.addInitScript(user => {
    localStorage.setItem("token", "progress-test-token")
    localStorage.setItem("currentUser", JSON.stringify(user))
  }, user)
  await context.route("**/api/**", async route => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    calls.push(`${request.method()} ${pathname}`)
    if (pathname === "/api/auth/me") return fulfill(route, 200, user)
    if (await handle(route, pathname, request)) return
    return fulfill(route, 200, [])
  })
  return { page, context, calls }
}

const quizAttempt = id => ({
  id, node_id: "game-node", game_revision_id: "rev", status: "in_progress", format: "quiz", title: "Quiz com nota mínima",
  instructions: "", max_score: 100, current_step: null, board: null, answers: [], can_finish: true, result: null,
  questions: [
    { id: "q1", text: "Escolha única", selection: "single", options: [{ id: "a", text: "Opção A" }, { id: "b", text: "Opção B" }] },
    { id: "q2", text: "Várias corretas", selection: "multiple", options: [{ id: "c", text: "Opção C" }, { id: "d", text: "Opção D" }, { id: "e", text: "Opção E" }] },
  ],
})

async function checkPartialAnswersAndMinimumGrade(browser) {
  const node = { ...step("game-node"), name: "Jogo com nota mínima", type: "game", eixo: "vendas", game_revision_id: "rev",
    completed: false, allow_retry: true, weight: 1, grade: null }
  let attempts = 0
  const payloads = []
  const feedback = (q2) => [
    { question_id: "q1", text: "Escolha única", option_ids: ["a"], is_correct: true, status: "correct", correct_selected: 1, correct_total: 1, wrong_selected: 0, score: 1, max_score: 1, explanation: "", feedback: "" },
    { question_id: "q2", text: "Várias corretas", explanation: "", feedback: "", max_score: 3, ...q2 },
  ]
  const { page, context } = await open(browser, member, async (route, pathname, request) => {
    if (pathname === "/api/nodes") await fulfill(route, 200, [node])
    else if (pathname === "/api/nodes/game-node/attempts") await fulfill(route, 200, quizAttempt(`attempt-${++attempts}`))
    else if (pathname.startsWith("/api/game-attempts/") && pathname.endsWith("/complete")) {
      payloads.push(request.postDataJSON())
      const passed = payloads.length > 1
      await fulfill(route, 200, { ...quizAttempt(`attempt-${attempts}`), status: "completed", result: passed
        ? { grade: 10, best_grade: 10, min_grade: 7, step_completed: true, attempt_score: 100, max_score: 100, score_added: 0, total_score: 100, user_total_points: 0, note: "",
            feedback: feedback({ option_ids: ["c", "d"], is_correct: true, status: "correct", correct_selected: 2, correct_total: 2, wrong_selected: 0, score: 3 }) }
        : { grade: 2.5, best_grade: 2.5, min_grade: 7, step_completed: false, attempt_score: 25, max_score: 100, score_added: 25, total_score: 25, user_total_points: 0, note: "",
            feedback: feedback({ option_ids: ["c", "e"], is_correct: false, status: "partial", correct_selected: 1, correct_total: 2, wrong_selected: 1, score: 0 }) } })
    } else return false
    return true
  })
  try {
    await page.goto(`${baseURL}/trilha/game-node/jogar`)
    await page.getByText("nota mínima 7 para avançar", { exact: false }).waitFor()
    await page.getByLabel("Opção A").check()
    await page.getByLabel("Opção C").check()
    await page.getByLabel("Opção E").check()
    await page.getByRole("button", { name: "Concluir questionário" }).click()
    await page.getByRole("heading", { name: "Tentativa concluída" }).waitFor()
    assert.deepEqual(payloads[0].answers, [{ question_id: "q1", option_ids: ["a"] }, { question_id: "q2", option_ids: ["c", "e"] }])
    await page.getByText("Parcialmente correta", { exact: true }).waitFor()
    await page.getByText("1 de 2 alternativas corretas marcadas · 1 alternativa incorreta marcada", { exact: true }).waitFor()
    await page.getByText("Resposta correta", { exact: true }).waitFor()
    assert.match(await page.getByRole("alert").filter({ hasText: "Você precisa" }).textContent(), /nota 7,00 ou mais para concluir esta etapa.*melhor nota até agora é 2,50/)
    await page.getByRole("button", { name: "Tentar novamente" }).click()
    await page.getByLabel("Opção A").check()
    await page.getByLabel("Opção C").check()
    await page.getByLabel("Opção D").check()
    await page.getByRole("button", { name: "Concluir questionário" }).click()
    await page.getByRole("heading", { name: "Jogo concluído" }).waitFor()
    assert.equal(attempts, 2)
    await page.getByText("Etapa concluída: sua melhor nota atingiu o mínimo de 7,00.", { exact: true }).waitFor()
    assert.equal(await page.getByText("Parcialmente correta", { exact: true }).count(), 0)
    console.log("PASS jogo: acerto parcial com contagem, aviso de nota mínima e nova tentativa até concluir")
  } finally { await context.close() }
}

async function checkCelebration(browser) {
  let nodes = [step("1"), step("2"), step("opcional", { is_required: false, completed: false })]
  const { page, context, calls } = await open(browser, trainee, async (route, pathname) => {
    if (pathname !== "/api/nodes") return false
    await fulfill(route, 200, nodes)
    return true
  })
  const dialog = page.getByRole("dialog")
  async function settle() {
    await page.getByRole("button", { name: "Etapa 1", exact: true }).waitFor()
    await page.waitForTimeout(300)
  }
  try {
    // Optional steps do not prevent the celebration.
    await page.goto(`${baseURL}/trainees`)
    await dialog.getByRole("heading", { name: "Parabéns, Pessoa!" }).waitFor()
    assert.match(await dialog.textContent(), /concluiu todas as etapas da trilha Trainee/)
    assert.equal(await page.getByTestId("trail-balloons").locator(".trail-balloon").count(), 16)
    await dialog.getByRole("button", { name: "Continuar" }).click()
    await dialog.waitFor({ state: "hidden" })
    assert.equal(await page.getByTestId("trail-balloons").count(), 0)
    // Once per completed set of steps.
    await page.reload()
    await settle()
    assert.equal(await dialog.count(), 0)
    nodes = [...nodes, step("3", { completed: false })]
    await page.reload()
    await settle()
    assert.equal(await dialog.count(), 0)
    nodes = nodes.map(node => node.id === "3" ? { ...node, completed: true } : node)
    await page.reload()
    await dialog.getByRole("heading", { name: "Parabéns, Pessoa!" }).waitFor()
    assert.ok(!calls.some(call => call.endsWith("/api/gamification")), "Trainees não consultam a gamificação")
    console.log("PASS comemoração: ao concluir a trilha, uma vez por conjunto de etapas, sem contar opcionais")
  } finally { await context.close() }
  const reduced = await open(browser, trainee, async (route, pathname) => {
    if (pathname !== "/api/nodes") return false
    await fulfill(route, 200, [step("1")])
    return true
  }, { reducedMotion: "reduce" })
  try {
    await reduced.page.goto(`${baseURL}/trainees`)
    await reduced.page.getByRole("dialog").getByRole("heading", { name: "Parabéns, Pessoa!" }).waitFor()
    const display = await reduced.page.locator(".trail-balloon").first().evaluate(element => getComputedStyle(element).display)
    assert.equal(display, "none")
    console.log("PASS comemoração: sem balões animados com movimento reduzido")
  } finally { await reduced.context.close() }
}

async function checkMemberGamification(browser) {
  const summary = {
    points: 180, eixo: "vendas", level: { number: 2, name: "Aprendiz", min_points: 100, next_points: 250 },
    achievements: [
      { id: "first_step", title: "Primeiro passo", description: "Concluir a primeira etapa.", earned: true },
      { id: "perfect_grade", title: "Nota máxima", description: "Tirar 10.", earned: true },
      { id: "consistent", title: "Consistente", description: "Tirar 7 ou mais em 5 avaliações.", earned: false, progress: { current: 2, target: 5 } },
    ],
    ranking: [
      { user_id: "ana", name: "Ana", eixo: "conexoes", points: 300, level: 3, position: 1, is_me: false },
      { user_id: member.id, name: member.name, eixo: "vendas", points: 180, level: 2, position: 2, is_me: true },
      { user_id: "bia", name: "Bia", eixo: "vendas", points: 180, level: 2, position: 2, is_me: false },
      { user_id: "caio", name: "Caio", eixo: "vendas", points: 50, level: 1, position: 4, is_me: false },
    ],
  }
  const nodes = [step("v1", { eixo: "vendas" }), step("c1", { eixo: "conexoes", completed: false })]
  const { page, context } = await open(browser, member, async (route, pathname) => {
    if (pathname === "/api/gamification") await fulfill(route, 200, summary)
    else if (pathname === "/api/nodes") await fulfill(route, 200, nodes)
    else return false
    return true
  })
  try {
    await page.goto(`${baseURL}/membros`)
    // Only the official trail counts: the other axis is still open.
    const dialog = page.getByRole("dialog")
    await dialog.getByText("concluiu todas as etapas da trilha Vendas", { exact: false }).waitFor()
    await dialog.getByRole("button", { name: "Continuar" }).click()
    await page.getByText("Nível 2 · 180 pts", { exact: true }).waitFor()
    await page.getByRole("tab", { name: /Conquistas/ }).click()
    await page.getByRole("heading", { name: "Aprendiz" }).waitFor()
    await page.getByText("Faltam 70 pontos para o nível 3.", { exact: true }).waitFor()
    await page.getByText("2 de 3", { exact: true }).waitFor()
    assert.equal(await page.locator('[data-achievement="consistent"][data-earned="false"]').count(), 1)
    const rows = () => page.getByRole("list", { name: /Ranking/ }).getByRole("listitem").evaluateAll(items =>
      items.map(item => item.textContent.replace(/\s+/g, " ").trim()))
    assert.deepEqual((await rows()).map(text => text.match(/^\d+º/)[0]), ["1º", "1º", "3º"])
    assert.match((await rows())[0], /Pessoa Teste \(você\)/)
    await page.getByRole("button", { name: "Geral" }).click()
    assert.deepEqual((await rows()).map(text => text.match(/^\d+º/)[0]), ["1º", "2º", "2º", "4º"])
    assert.match((await rows())[0], /Ana.*Conexões/)
    console.log("PASS gamificação: nível, conquistas e ranking por eixo e geral na página do membro")
  } finally { await context.close() }
}

async function main() {
  const browser = await playwright.chromium.launch({ headless: true })
  try {
    await checkPartialAnswersAndMinimumGrade(browser)
    await checkCelebration(browser)
    await checkMemberGamification(browser)
    console.log("4 cenários de progresso passaram.")
  } finally { await browser.close() }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
