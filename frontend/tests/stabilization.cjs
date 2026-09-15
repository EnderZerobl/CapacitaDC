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
    } else if (pathname === "/api/nodes/smoke-node/content") {
      await fulfill(route, 200, { node: { ...node, completed: sent }, material: null,
        activity: { ...activity, my_submission: sent ? { id: "smoke-submission", comment: "Resposta preservada" } : null } })
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

async function checkUnlockedContent(browser, type) {
  const eixo = type === "trainee" ? "trainee" : "vendas"
  const user = { ...admin, id: `content-${type}`, type, cargo: type, eixo }
  let completed = false
  let failEndpoint = null
  let missing = false
  const material = { id: "next-material", name: "Material liberado", type: type === "trainee" ? "trainee" : "membro", eixo, text: "Texto disponível após concluir a etapa anterior.", videos: [], documents: [] }
  const firstMaterial = { ...material, id: "first-material", name: "Primeiro material" }
  const activity = { id: "next-activity", title: "Atividade liberada", description: "Instruções da próxima etapa.", eixo, material_id: material.id, accepts_file: false, effective_open: true, is_open: true, submission_count: 0 }
  const baseNode = { eixo, completed: false, unlocked: true, is_released: true, user_score: 0, questions: [] }
  const { page, context } = await authenticatedPage(browser, user, async (route, pathname) => {
    if (pathname === "/api/nodes") {
      await fulfill(route, 200, [
        { ...baseNode, id: "first-node", name: "Primeira etapa", type: "material", reference_id: firstMaterial.id, order_index: 0, completed },
        { ...baseNode, id: "next-node", name: "Próxima etapa", type: "activity", activity_id: activity.id, order_index: 1, unlocked: completed },
        { ...baseNode, id: "orphan-node", name: "Etapa antiga sem vínculo", type: "material", reference_id: null, order_index: 2 },
      ])
    } else if (pathname === "/api/nodes/first-node/content") {
      await fulfill(route, 200, { node: { ...baseNode, id: "first-node", type: "material", completed }, material: firstMaterial, activity: null })
    } else if (pathname === "/api/nodes/next-node/content") {
      await fulfill(route, failEndpoint ? 500 : missing ? 404 : 200, failEndpoint
        ? { detail: "Falha temporária" } : missing
        ? { detail: "O conteúdo desta etapa não está disponível." }
        : { node: { ...baseNode, id: "next-node", type: "activity" }, material, activity })
    } else if (pathname === "/api/nodes/orphan-node/content") {
      await fulfill(route, 404, { detail: "Esta etapa está sem conteúdo vinculado. Vincule uma atividade." })
    } else if (pathname === "/api/nodes/first-node/complete") {
      completed = true
      await fulfill(route, 200, { completed: true })
    } else if (pathname === "/api/materials") {
      await fulfill(route, failEndpoint === pathname ? 500 : 200,
        failEndpoint === pathname ? { detail: "Falha temporária nos materiais" } : [firstMaterial])
    } else if (pathname === "/api/activities") {
      await fulfill(route, failEndpoint === pathname ? 500 : 200,
        failEndpoint === pathname ? { detail: "Falha temporária nas atividades" } : completed && !missing ? [activity] : [])
    } else return false
    return true
  })
  try {
    await page.goto(`${baseURL}/${type === "trainee" ? "trainees" : "membros"}`)
    const next = page.getByRole("button", { name: "Próxima etapa", exact: true })
    assert.equal(await next.isDisabled(), true)
    await page.getByRole("button", { name: "Primeira etapa", exact: true }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Concluir etapa", exact: true }).click()
    await page.getByRole("dialog").waitFor({ state: "hidden" })
    await next.click()
    const dialog = page.getByRole("dialog")
    await dialog.getByText(material.text, { exact: true }).waitFor()
    await dialog.getByText(activity.description, { exact: true }).waitFor()
    await dialog.getByRole("button", { name: "Fechar Leitor", exact: true }).click()

    // Access can change while the page is open; retry must fetch fresh lists.
    missing = true
    await next.click()
    await dialog.getByText(/O conteúdo desta etapa não está disponível/).waitFor()
    missing = false
    await dialog.getByRole("button", { name: "Tentar novamente" }).click()
    await dialog.getByText(material.text, { exact: true }).waitFor()
    await dialog.getByText(activity.description, { exact: true }).waitFor()
    await dialog.getByRole("button", { name: "Fechar Leitor", exact: true }).click()

    for (const endpoint of ["/api/materials", "/api/activities"]) {
      failEndpoint = endpoint
      await next.click()
      await dialog.getByRole("alert").waitFor()
      failEndpoint = null
      await dialog.getByRole("button", { name: "Tentar novamente" }).click()
      await dialog.getByText(material.text, { exact: true }).waitFor()
      await dialog.getByText(activity.description, { exact: true }).waitFor()
      assert.equal(await dialog.getByRole("alert").count(), 0)
      await dialog.getByRole("button", { name: "Fechar Leitor", exact: true }).click()
    }

    missing = true
    await next.click()
    await dialog.getByText(/O conteúdo desta etapa não está disponível/).waitFor()
    assert.equal(await dialog.getByText("Carregando conteúdo...", { exact: true }).count(), 0)
    await dialog.getByRole("button", { name: "Close", exact: true }).click()
    await page.getByRole("button", { name: "Etapa antiga sem vínculo", exact: true }).click()
    await dialog.getByText(/Esta etapa está sem conteúdo vinculado/).waitFor()
    const descriptionId = await dialog.getAttribute("aria-describedby")
    assert.ok(descriptionId)
    assert.ok(await page.locator(`[id="${descriptionId}"]`).textContent())
    console.log(`PASS conteúdo ${type}: desbloqueio, atualização ao abrir, erros, conteúdo ausente e etapa sem vínculo`)
  } finally {
    await context.close()
  }
}

async function checkNodeActivityLink(browser) {
  const material = { id: "linked-material", name: "Material da biblioteca", type: "trainee", eixo: "trainee", text: "Texto", videos: [], documents: [] }
  const activity = { id: "linked-activity", title: "Atividade com material", eixo: "trainee", material_id: material.id, weight: 1 }
  let node = { id: "legacy-link", name: "Nó existente", type: "material", eixo: "trainee", activity_id: null, reference_id: null, is_released: true, released_at: null, order_index: 0, questions: [] }
  let saves = 0
  const { page, context } = await authenticatedPage(browser, admin, async (route, pathname, request) => {
    if (pathname === "/api/materials") await fulfill(route, 200, [material])
    else if (pathname === "/api/activities") await fulfill(route, 200, [activity])
    else if (pathname === "/api/nodes") await fulfill(route, 200, [node])
    else if (pathname === "/api/nodes/legacy-link/activity") {
      assert.equal(request.method(), "PATCH")
      assert.deepEqual(request.postDataJSON(), { activity_id: activity.id })
      node = { ...node, type: "activity", activity_id: activity.id, reference_id: null }
      saves++
      await fulfill(route, 200, node)
    } else return false
    return true
  })
  try {
    await page.goto(baseURL)
    await page.getByRole("tab", { name: /Trilha/ }).click()
    await page.getByLabel("Atividade do nó", { exact: true }).selectOption(activity.id)
    await page.getByText(`Material da atividade: ${material.name}`, { exact: true }).waitFor()
    await page.getByRole("button", { name: "Salvar atividade do nó", exact: true }).click()
    await page.waitForFunction(() => document.querySelector('[id="node-activity-legacy-link"]')?.value === "linked-activity"
      && [...document.querySelectorAll('button')].some(button => button.textContent === "Salvar atividade do nó" && button.disabled))
    assert.equal(saves, 1)
    await page.getByRole("button", { name: "Novo Nó", exact: true }).click()
    assert.deepEqual(await page.locator('#node-type option').evaluateAll(options => options.map(option => option.value)), ["activity", "game"])
    await page.getByLabel("Atividade Associada *", { exact: true }).selectOption(activity.id)
    assert.ok((await page.locator('#node-activity option:checked').textContent()).includes(material.name))
    console.log("PASS autoria: nó recebe atividade, mostra o material e permite reparar vínculo antigo")
  } finally { await context.close() }
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
    await checkUnlockedContent(browser, "membro")
    await checkUnlockedContent(browser, "trainee")
    await checkRecovery(browser)
    await checkManagerRoutes(browser)
    await checkNodeActivityLink(browser)
    console.log("10 cenários de estabilização passaram.")
  } finally {
    await browser.close()
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
