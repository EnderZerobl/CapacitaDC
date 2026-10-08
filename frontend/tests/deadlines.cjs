// Run with a frontend server: BASE_URL=http://127.0.0.1:3017 node frontend/tests/deadlines.cjs
// All API responses are intercepted; no application database is read or written.
const assert = require("node:assert/strict")

let playwright
if (process.env.PLAYWRIGHT_PACKAGE) {
  playwright = require(process.env.PLAYWRIGHT_PACKAGE)
} else {
  try { playwright = require("playwright") }
  catch { throw new Error("Instale playwright no frontend ou defina PLAYWRIGHT_PACKAGE; veja docs/TESTES.md") }
}

const baseURL = process.env.BASE_URL || "http://127.0.0.1:3000"
const admin = { id: "deadline-admin", name: "Pessoa Teste", email: "deadline@example.test", type: "admin", cargo: "admin", pontos_acumulados: 0 }
const activityBase = { id: "deadline-activity", title: "Atividade com prazo", description: "", eixo: "trainee", material_id: null,
  accepts_file: false, is_open: true, effective_open: true, submission_count: 0, weight: 1, allow_retry: true, is_required: true }
const fulfill = (route, status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) })
// Older API responses omitted the suffix even though the stored value was UTC.
const serialize = (value, naive) => naive && value ? value.replace(/(?:\.000)?Z$/, "") : value
const shown = time => new RegExp(`07/10/2026.*${time}`)

async function open(browser, { user = admin, timezoneId = "America/Bahia", handle }) {
  const context = await browser.newContext({ timezoneId, locale: "pt-BR" })
  const page = await context.newPage()
  page.setDefaultTimeout(15000)
  await context.addInitScript(user => {
    localStorage.setItem("token", "deadline-test-token")
    localStorage.setItem("currentUser", JSON.stringify(user))
  }, user)
  await context.route("**/api/**", async route => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (pathname === "/api/auth/me") return fulfill(route, 200, user)
    if (await handle(route, pathname, request)) return
    return fulfill(route, 200, [])
  })
  return { page, context }
}

function patchResponse(page, pathname) {
  return page.waitForResponse(response => response.request().method() === "PATCH" && new URL(response.url()).pathname === pathname)
}

async function checkActivityEdit(browser, timezoneId, naive) {
  const bahia = timezoneId === "America/Bahia"
  const path = `/api/activities/${activityBase.id}`
  let deadline = "2026-10-07T17:00:00Z"
  const patches = []
  const { page, context } = await open(browser, { timezoneId, handle: async (route, pathname, request) => {
    if (pathname === "/api/activities" && request.method() === "GET") {
      await fulfill(route, 200, [{ ...activityBase, deadline: serialize(deadline, naive) }])
    } else if (pathname === path && request.method() === "PATCH") {
      const payload = request.postDataJSON()
      patches.push(payload)
      deadline = payload.deadline
      await fulfill(route, 200, { ...activityBase, ...payload, deadline: serialize(deadline, naive) })
    } else return false
    return true
  } })
  try {
    await page.goto(baseURL)
    await page.getByRole("tab", { name: /Atividades/ }).click()
    const card = page.locator('[data-slot="card"]').filter({ hasText: activityBase.title })
    const input = card.locator('input[type="datetime-local"]')
    const local = bahia ? "14:00" : "22:30"
    assert.match(await card.getByText(/Prazo:/).textContent(), shown(local))
    async function save(value) {
      await card.getByRole("button", { name: "Editar", exact: true }).click()
      assert.equal(await input.inputValue(), `2026-10-07T${local}`)
      if (value) await input.fill(value)
      const response = patchResponse(page, path)
      await card.getByRole("button", { name: "Salvar", exact: true }).click()
      await (await response).finished()
      await input.waitFor({ state: "detached" })
    }
    // Saving the form untouched keeps the same instant, however many times.
    for (let round = 0; round < 2; round++) {
      await save()
      assert.equal(patches.at(-1).deadline, "2026-10-07T17:00:00.000Z")
      assert.match(await card.getByText(/Prazo:/).textContent(), shown(local))
    }
    const changed = bahia ? "16:00" : "23:00"
    await save(`2026-10-07T${changed}`)
    assert.equal(patches.at(-1).deadline, bahia ? "2026-10-07T19:00:00.000Z" : "2026-10-07T17:30:00.000Z")
    assert.match(await card.getByText(/Prazo:/).textContent(), shown(changed))
    await card.getByRole("button", { name: "Editar", exact: true }).click()
    assert.equal(await input.inputValue(), `2026-10-07T${changed}`)
    console.log(`PASS atividade ${timezoneId}: prazo de ${local} exibido e mantido ao salvar sem alterar (${naive ? "legado sem Z" : "UTC explícito"})`)
  } finally { await context.close() }
}

async function checkNodeDeadline(browser, naive) {
  const node = { id: "deadline-node", name: "Etapa com prazo", type: "game", eixo: "trainee", order_index: 0,
    is_released: true, released_at: null, released_by: null, unlocked: true, completed: false, user_score: 0,
    questions: [], allow_retry: true, is_required: true, weight: 1 }
  const path = `/api/nodes/${node.id}`
  let deadline = "2026-10-07T17:00:00Z"
  const patches = []
  const { page, context } = await open(browser, { handle: async (route, pathname, request) => {
    if (pathname === "/api/nodes" && request.method() === "GET") {
      await fulfill(route, 200, [{ ...node, deadline: serialize(deadline, naive) }])
    } else if (pathname === path && request.method() === "PATCH") {
      const payload = request.postDataJSON()
      patches.push(payload)
      deadline = payload.deadline
      await fulfill(route, 200, { ...node, ...payload, deadline: serialize(deadline, naive) })
    } else return false
    return true
  } })
  try {
    await page.goto(baseURL)
    await page.getByRole("tab", { name: /Trilha/ }).click()
    const card = page.locator('[data-slot="card"]').filter({ hasText: node.name })
    assert.match(await card.getByText(/Prazo:/).textContent(), shown("14:00"))
    for (const [current, value, expected] of [
      ["14:00", null, "2026-10-07T17:00:00.000Z"],
      ["14:00", "2026-10-07T16:00", "2026-10-07T19:00:00.000Z"],
    ]) {
      await card.getByRole("button", { name: "Editar nó", exact: true }).click()
      const dialog = page.getByRole("dialog")
      const input = dialog.getByLabel("Prazo (opcional)")
      assert.equal(await input.inputValue(), `2026-10-07T${current}`)
      if (value) await input.fill(value)
      const response = patchResponse(page, path)
      await dialog.getByRole("button", { name: "Salvar alterações", exact: true }).click()
      await (await response).finished()
      await dialog.waitFor({ state: "hidden" })
      assert.equal(patches.at(-1).deadline, expected)
    }
    assert.match(await card.getByText(/Prazo:/).textContent(), shown("16:00"))
    console.log(`PASS nó: prazo exibido no fuso local e preservado pelo diálogo de edição (${naive ? "legado sem Z" : "UTC explícito"})`)
  } finally { await context.close() }
}

async function checkParticipant(browser, type, naive) {
  const eixo = type === "trainee" ? "trainee" : "vendas"
  const user = { ...admin, id: `deadline-${type}`, type, cargo: type, eixo }
  const activity = { ...activityBase, eixo, deadline: serialize("2026-10-07T17:00:00Z", naive), my_submission: null }
  const base = { eixo, type: "activity", activity_id: activity.id, reference_id: activity.id, is_released: true,
    released_at: null, unlocked: true, completed: false, user_score: 0, questions: [] }
  const nodes = [
    { ...base, id: "own-deadline", name: "Etapa com prazo próprio", order_index: 0, deadline: serialize("2026-10-07T18:00:00Z", naive) },
    { ...base, id: "activity-deadline", name: "Etapa com prazo da atividade", order_index: 1, deadline: null },
  ]
  const { page, context } = await open(browser, { user, handle: async (route, pathname) => {
    const node = nodes.find(item => pathname === `/api/nodes/${item.id}/content`)
    if (pathname === "/api/nodes") await fulfill(route, 200, nodes)
    else if (pathname === "/api/activities") await fulfill(route, 200, [activity])
    else if (node) await fulfill(route, 200, { node, activity, material: null })
    else return false
    return true
  } })
  try {
    await page.goto(`${baseURL}/${type === "trainee" ? "trainees" : "membros"}`)
    // The step's own deadline takes precedence over the activity's.
    for (const [name, local] of [["Etapa com prazo próprio", "15:00"], ["Etapa com prazo da atividade", "14:00"]]) {
      await page.getByRole("button", { name, exact: true }).click()
      const dialog = page.getByRole("dialog")
      assert.match(await dialog.getByText(/Prazo de entrega:/).textContent(), shown(local))
      await page.keyboard.press("Escape")
      await dialog.waitFor({ state: "hidden" })
    }
    if (type === "trainee") {
      await page.getByRole("tab", { name: /Atividades/ }).click()
      const card = page.locator('[data-slot="card"]').filter({ hasText: activity.title })
      assert.match(await card.getByText(/Prazo:/).textContent(), shown("14:00"))
    }
    console.log(`PASS ${type}: prazos da etapa e da atividade no fuso local (${naive ? "legado sem Z" : "UTC explícito"})`)
  } finally { await context.close() }
}

async function main() {
  const browser = await playwright.chromium.launch({ headless: true })
  try {
    for (const timezone of ["America/Bahia", "Asia/Kolkata"]) {
      for (const naive of [false, true]) await checkActivityEdit(browser, timezone, naive)
    }
    for (const naive of [false, true]) await checkNodeDeadline(browser, naive)
    for (const type of ["trainee", "membro"]) {
      for (const naive of [false, true]) await checkParticipant(browser, type, naive)
    }
    console.log("10 cenários de prazo passaram.")
  } finally { await browser.close() }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
