// Run with a frontend server: BASE_URL=http://127.0.0.1:3017 node frontend/tests/stabilization.cjs
// API responses are intercepted; these checks never write to the application database.
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
const admin = { id: "smoke-admin", name: "Pessoa Teste", email: "smoke@example.test", type: "admin", cargo: "admin", pontos_acumulados: 0 }
const fulfill = (route, status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) })

async function authenticatedPage(browser, user, handleAPI) {
  const context = await browser.newContext()
  const page = await context.newPage()
  page.setDefaultTimeout(15000)
  await context.addInitScript(user => {
    if (!sessionStorage.getItem("smoke-seeded")) {
      sessionStorage.setItem("smoke-seeded", "1")
      localStorage.setItem("token", "smoke-session-token")
      localStorage.setItem("currentUser", JSON.stringify(user))
    }
  }, user)
  await context.route("**/api/**", async route => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (await handleAPI?.(route, pathname, request)) return
    if (pathname === "/api/auth/me") return fulfill(route, 200, user)
    return fulfill(route, 200, [])
  })
  return { page, context }
}

async function checkSession(browser, status) {
  const { page, context } = await authenticatedPage(browser, admin, async (route, pathname) => {
    if (pathname !== "/api/auth/me") return false
    await fulfill(route, status, { detail: "Falha simulada" })
    return true
  })
  try {
    await page.goto(baseURL)
    if (status === 401) {
      await page.waitForURL("**/login")
      assert.equal(await page.evaluate(() => localStorage.getItem("token")), null)
      assert.equal(await page.evaluate(() => localStorage.getItem("currentUser")), null)
    } else {
      await page.getByRole("tab", { name: /Materiais/ }).waitFor()
      assert.equal(new URL(page.url()).pathname, "/")
      assert.equal(await page.evaluate(() => localStorage.getItem("token")), "smoke-session-token")
    }
    console.log(`PASS sessão: HTTP ${status}`)
  } finally {
    await context.close()
  }
}

async function checkMaterialForm(browser) {
  let fail = true
  let submitted = 0
  let materials = []
  const { page, context } = await authenticatedPage(browser, admin, async (route, pathname, request) => {
    if (pathname !== "/api/materials") return false
    if (request.method() === "GET") {
      await fulfill(route, 200, materials)
    } else if (request.method() === "POST") {
      submitted += 1
      assert.equal(request.headers().authorization, "Bearer smoke-session-token")
      if (fail) {
        await fulfill(route, 403, { detail: "Permissão insuficiente" })
      } else {
        const material = { ...request.postDataJSON(), id: "smoke-material" }
        materials = [material]
        await fulfill(route, 201, material)
      }
    }
    return true
  })
  try {
    await page.goto(baseURL)
    await page.getByRole("tab", { name: /Materiais/ }).click()
    await page.getByRole("button", { name: "Adicionar Conteúdo", exact: true }).click()
    await page.getByLabel("Nome do Conteúdo", { exact: true }).fill("Material de teste")
    await page.locator("#content-text").fill("Rascunho preservado após falha.")
    await page.getByRole("button", { name: "Salvar Alterações", exact: true }).click()
    await page.getByText("Você não tem permissão para realizar esta ação.", { exact: true }).waitFor()
    assert.equal(await page.getByLabel("Nome do Conteúdo", { exact: true }).inputValue(), "Material de teste")
    assert.equal(await page.locator("#content-text").inputValue(), "Rascunho preservado após falha.")
    assert.equal(submitted, 1)
    fail = false
    await page.getByRole("button", { name: "Salvar Alterações", exact: true }).click()
    await page.getByRole("button", { name: "Adicionar Conteúdo", exact: true }).waitFor()
    await page.getByText("Material de teste", { exact: true }).waitFor()
    assert.equal(submitted, 2)
    console.log("PASS material: erro preserva formulário; nova tentativa salva")
  } finally {
    await context.close()
  }
}

async function checkActivitySubmission(browser, type) {
  const eixo = type === "trainee" ? "trainee" : "vendas"
  const user = { ...admin, id: `smoke-${type}`, type, cargo: type, eixo }
  let sent = false
  let fail = true
  let completeRequests = 0
  const submissions = []
  const node = { id: "smoke-node", name: "Etapa sem material", type: "activity", eixo, activity_id: "smoke-activity", reference_id: "smoke-activity", completed: false, unlocked: true, is_released: true, released_at: null, released_by: null, user_score: 0, questions: [], order_index: 0 }
  const activity = { id: "smoke-activity", title: "Envio de teste", description: "Atividade sem material vinculado.", eixo, material_id: null, accepts_file: false, is_open: true, effective_open: true, submission_count: 0 }
  const { page, context } = await authenticatedPage(browser, user, async (route, pathname, request) => {
    if (pathname === "/api/nodes") {
      await fulfill(route, 200, [{ ...node, completed: sent }])
    } else if (pathname === "/api/activities") {
      await fulfill(route, 200, [{ ...activity, my_submission: sent ? { id: "smoke-submission", comment: "Resposta preservada" } : null }])
    } else if (pathname === "/api/activities/smoke-activity/submit") {
      const payload = request.postDataJSON()
      submissions.push(payload)
      if (fail) {
        await fulfill(route, 400, { detail: "Envio temporariamente rejeitado" })
      } else {
        sent = true
        await fulfill(route, 200, { id: "smoke-submission", activity_id: activity.id, user_id: user.id, ...payload })
      }
    } else if (pathname.endsWith("/complete")) {
      completeRequests += 1
      await fulfill(route, 400, { detail: "Atividade deve ser enviada pela rota de entregas" })
    } else {
      return false
    }
    return true
  })
  try {
    await page.goto(`${baseURL}/${type === "trainee" ? "trainees" : "membros"}`)
    await page.getByRole("button", { name: node.name, exact: true }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByPlaceholder("Adicione observações...").fill("Resposta preservada")
    await dialog.getByRole("button", { name: "Enviar atividade e concluir etapa", exact: true }).click()
    await dialog.getByRole("alert").getByText("Envio temporariamente rejeitado", { exact: true }).waitFor()
    assert.equal(await dialog.getByPlaceholder("Adicione observações...").inputValue(), "Resposta preservada")
    assert.equal(completeRequests, 0)
    assert.equal(submissions[0].node_id, node.id)
    fail = false
    await dialog.getByRole("button", { name: "Enviar atividade e concluir etapa", exact: true }).click()
    await dialog.waitFor({ state: "hidden" })
    assert.equal(submissions.length, 2)
    assert.equal(submissions[1].node_id, node.id)
    assert.equal(completeRequests, 0)
    await page.getByRole("button", { name: node.name, exact: true }).click()
    await dialog.getByText("✓ Atividade Enviada", { exact: true }).waitFor()
    assert.equal(await dialog.getByRole("button", { name: /Concluir etapa|Já concluído/i }).count(), 0)
    console.log(`PASS ${type}: atividade sem material, erro/reenvio e conclusão pelo node_id`)
  } finally {
    await context.close()
  }
}

async function checkRecovery(browser) {
  const context = await browser.newContext()
  const page = await context.newPage()
  try {
    await page.goto(`${baseURL}/recuperar-senha`)
    await page.getByText("A recuperação de senha por email ainda está indisponível.", { exact: true }).waitFor()
    assert.equal(await page.getByRole("button", { name: "Enviar instruções" }).count(), 0)
    console.log("PASS recuperação: indisponibilidade explícita sem envio simulado")
  } finally {
    await context.close()
  }
}

async function checkManagerRoutes(browser) {
  for (const role of ["admin", "organizador"]) {
    const { page, context } = await authenticatedPage(browser, { ...admin, type: role })
    try {
      for (const route of ["/membros", "/trainees"]) {
        await page.goto(`${baseURL}${route}`)
        await page.waitForURL(url => url.pathname === "/")
      }
    } finally { await context.close() }
  }
  console.log("PASS papéis: gestores voltam ao painel ao acessar páginas de participantes")
}

async function main() {
  const browser = await playwright.chromium.launch({ headless: true })
  try {
    await checkSession(browser, 503)
    await checkSession(browser, 401)
    await checkMaterialForm(browser)
    await checkActivitySubmission(browser, "membro")
    await checkActivitySubmission(browser, "trainee")
    await checkRecovery(browser)
    await checkManagerRoutes(browser)
    console.log("7 cenários de estabilização passaram.")
  } finally {
    await browser.close()
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
