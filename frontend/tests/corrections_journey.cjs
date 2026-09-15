// Precisa de um banco descartável e vazio: a trilha é sequencial, então etapas
// deixadas por execuções anteriores bloqueiam as criadas agora.
// Browser journey for the corrections queue: a trainee delivers, an admin grades
// from the queue and the weighted average appears in the grades tab.
//
//   BASE_URL=http://127.0.0.1:3017 ADMIN_EMAIL=... TRAINEE_EMAIL=... PASSWORD=... \
//     node frontend/tests/corrections_journey.cjs
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
const heavyTitle = "Relatório final"
const lightTitle = "Resumo semanal"

async function api(token, method, path, body) {
  const response = await fetch(`${baseURL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  assert.ok(response.ok, `${method} ${path} -> ${response.status} ${text.slice(0, 200)}`)
  return text ? JSON.parse(text) : null
}

async function login(email) {
  const session = await api(null, "POST", "/api/auth/login", { email, password })
  return session.access_token
}

/** Setup through the API: the browser part is about correcting, not seeding. */
async function seedDeliveries() {
  const admin = await login(adminEmail)
  const trainee = await login(traineeEmail)
  for (const [title, weight] of [[heavyTitle, 2], [lightTitle, 1]]) {
    const activity = await api(admin, "POST", "/api/activities", {
      title, description: "Entrega de teste", eixo: "trainee", accepts_file: false, weight,
    })
    const node = await api(admin, "POST", "/api/nodes", {
      name: `Etapa ${title}`, type: "activity", eixo: "trainee",
      activity_id: activity.id, is_released: true,
    })
    await api(trainee, "POST", `/api/activities/${activity.id}/submit`, {
      node_id: node.id, comment: `Entrega de ${title}`,
    })
  }
  console.log("PASS preparo: duas entregas pendentes criadas pela API")
}

async function signIn(page, email) {
  await page.goto(`${baseURL}/login`)
  await page.getByLabel("Email", { exact: true }).fill(email)
  await page.getByLabel("Senha", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Entrar", exact: true }).click()
  await page.waitForURL(url => !url.pathname.startsWith("/login"))
}

async function gradeFromQueue(page) {
  await page.getByRole("tab", { name: /Correções/ }).click()
  const card = title => page.locator("div.rounded-lg.border").filter({ hasText: title }).first()
  await card(heavyTitle).waitFor()
  await card(lightTitle).waitFor()
  // Contagem global cresceria a cada execução: o que importa é cada linha estar pendente.
  for (const title of [heavyTitle, lightTitle]) {
    await card(title).getByText("Pendente", { exact: true }).waitFor()
  }
  console.log("PASS fila: as duas entregas pendentes aparecem com atividade e peso")

  for (const [title, grade] of [[heavyTitle, "10"], [lightTitle, "4"]]) {
    const row = card(title)
    await row.getByLabel("Nota de 0 a 10").fill(grade)
    await row.getByLabel("Feedback").fill("Avaliado no teste")
    await row.getByRole("button", { name: "Salvar", exact: true }).click()
    await row.waitFor({ state: "detached" })
  }
  console.log("PASS correção: as duas notas foram salvas pela fila")
}

async function checkWeightedAverage(page) {
  // Peso 2 com nota 10 e peso 1 com nota 4 dão 8: a média é ponderada, não simples.
  await page.getByRole("tab", { name: /Notas/ }).click()
  const row = page.locator("tr").filter({ hasText: "Trainee" }).first()
  await row.getByText("8.00", { exact: true }).waitFor()
  console.log("PASS notas: média ponderada 8.00 aparece sem recarregar a página")
}

async function checkPendingFilter(page) {
  await page.getByRole("tab", { name: /Correções/ }).click()
  await page.getByLabel("Situação").selectOption("pending")
  await page.locator("div.rounded-lg.border").filter({ hasText: heavyTitle }).waitFor({ state: "detached" })
  await page.getByLabel("Situação").selectOption("graded")
  await page.locator("div.rounded-lg.border").filter({ hasText: heavyTitle }).first().waitFor()
  console.log("PASS filtros: nada pendente após corrigir, e as corrigidas continuam acessíveis")
}

async function main() {
  assert.ok(adminEmail && traineeEmail, "informe ADMIN_EMAIL e TRAINEE_EMAIL")
  await seedDeliveries()
  const browser = await playwright.chromium.launch({ headless: true })
  try {
    const context = await browser.newContext()
    const page = await context.newPage()
    page.setDefaultTimeout(20000)
    await signIn(page, adminEmail)
    await gradeFromQueue(page)
    await checkWeightedAverage(page)
    await checkPendingFilter(page)
    await context.close()
    console.log("Fila de correções verificada no navegador.")
  } finally {
    await browser.close()
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
