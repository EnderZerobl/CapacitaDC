// Run only against backend/tests/serve.py and a frontend connected to it.
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright')
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:3017'
const password = process.env.PASSWORD || 'qa-test-password'
async function api(token, method, path, body) {
  const response = await fetch(`${baseURL}${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const result = await response.json()
  assert.ok(response.ok, `${method} ${path}: ${response.status} ${JSON.stringify(result)}`)
  return result
}
async function main() {
  const login = email => api(null, 'POST', '/api/auth/login', { email, password })
  const admin = await login('admin@example.com')
  const trainee = await login('trainee@example.com')
  const member = await login('membro@example.com')
  const activity = await api(admin.access_token, 'POST', '/api/activities', {
    title: 'Entrega de PDF com referências', eixo: 'trainee', accepts_file: true,
  })
  const node = await api(admin.access_token, 'POST', '/api/nodes', {
    type: 'activity', eixo: 'trainee', activity_id: activity.id, is_released: true,
  })
  // Exercise the real proxy boundary, not just the browser's file-size check.
  for (const [size, expected] of [[20 * 1024 * 1024, 200], [20 * 1024 * 1024 + 1, 413]]) {
    const form = new FormData()
    form.append('file', new Blob([Buffer.alloc(size)], { type: 'application/pdf' }), 'limite.pdf')
    form.append('node_id', node.id)
    const response = await fetch(`${baseURL}/api/activities/${activity.id}/attachments`, {
      method: 'POST', headers: { Authorization: `Bearer ${trainee.access_token}` }, body: form,
    })
    assert.equal(response.status, expected, await response.text())
  }
  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext()
    await context.addInitScript(session => {
      localStorage.setItem('token', session.access_token)
      localStorage.setItem('currentUser', JSON.stringify(session.user))
    }, trainee)
    const page = await context.newPage()
    page.setDefaultTimeout(15000)
    await page.goto(`${baseURL}/trainees`)
    await page.getByRole('button', { name: activity.title, exact: true }).click()
    const dialog = page.getByRole('dialog')
    const send = dialog.getByRole('button', { name: 'Enviar atividade e concluir etapa', exact: true })
    assert.ok(await send.isDisabled())
    const fileInput = dialog.locator('input[type=file]')
    await fileInput.setInputFiles({ name: 'bloqueado.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('x') })
    await dialog.getByRole('alert').getByText(/formato não permitido/).waitFor()
    await fileInput.setInputFiles(Array.from({ length: 6 }, (_, i) => ({ name: `teste-${i}.pdf`, mimeType: 'application/pdf', buffer: Buffer.from('%PDF test') })))
    await dialog.getByRole('alert').getByText(/no máximo 5 anexos/).waitFor()
    await fileInput.setInputFiles({ name: 'grande.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(20 * 1024 * 1024 + 1) })
    await dialog.getByRole('alert').getByText(/20 MB/).waitFor()
    const pdf = Buffer.from('%PDF-1.4\nConteúdo da entrega\n%%EOF')
    await fileInput.setInputFiles([
      { name: 'trabalho.pdf', mimeType: 'application/pdf', buffer: pdf },
      { name: 'dados.csv', mimeType: 'text/csv', buffer: Buffer.from('nome,valor\nteste,1') },
    ])
    await dialog.getByRole('button', { name: 'Remover dados.csv', exact: true }).waitFor()
    await dialog.getByLabel('Links (opcional)', { exact: true }).fill('https://example.com/referencia\nhttps://example.com/projeto')
    await dialog.getByLabel('Comentários (opcional)', { exact: true }).fill('Seguem o relatório e os dados.')
    const fields = await dialog.locator('input[type=file], textarea').evaluateAll(elements => elements.map(element => element.tagName))
    assert.deepEqual(fields, ['INPUT', 'TEXTAREA', 'TEXTAREA'])
    let failOnce = true
    await page.route(`**/api/activities/${activity.id}/submit`, route => {
      if (failOnce) { failOnce = false; return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }) }
      return route.continue()
    })
    await send.click()
    await dialog.getByRole('alert').getByText(/temporariamente indisponível/).waitFor()
    assert.equal(await dialog.getByLabel('Comentários (opcional)', { exact: true }).inputValue(), 'Seguem o relatório e os dados.')
    assert.equal(await dialog.getByRole('button', { name: /Remover / }).count(), 2)
    await send.click()
    await dialog.waitFor({ state: 'hidden' })
    let [submission] = await api(admin.access_token, 'GET', `/api/activities/${activity.id}/submissions`)
    assert.equal(submission.attachments.length, 2)
    assert.equal(submission.links.length, 2)
    const attachment = submission.attachments.find(file => file.name === 'trabalho.pdf')
    for (const session of [admin, trainee]) {
      const response = await fetch(`${baseURL}${attachment.url}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      assert.equal(response.status, 200)
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), pdf)
    }
    assert.equal((await fetch(`${baseURL}${attachment.url}`, { headers: { Authorization: `Bearer ${member.access_token}` } })).status, 403)
    assert.equal((await fetch(`${baseURL}${attachment.url}`)).status, 401)
    const nodes = await api(trainee.access_token, 'GET', '/api/nodes')
    assert.ok(nodes.find(item => item.id === node.id).completed)
    await api(admin.access_token, 'PATCH', `/api/activities/${activity.id}/submissions/${submission.id}`, { grade: 8, feedback: 'Revisado' })
    await page.getByRole('tab', { name: 'Atividades', exact: true }).click()
    await page.getByLabel('Comentários (opcional)', { exact: true }).fill('Envio atualizado com os mesmos anexos.')
    await page.getByRole('button', { name: 'Atualizar envio', exact: true }).click()
    await page.getByText('Envio atualizado com os mesmos anexos.', { exact: true }).waitFor()
    ;[submission] = await api(admin.access_token, 'GET', `/api/activities/${activity.id}/submissions`)
    assert.equal(submission.grade, null)
    assert.equal(submission.attachments.length, 2)
    const manager = await browser.newContext()
    await manager.addInitScript(session => {
      localStorage.setItem('token', session.access_token)
      localStorage.setItem('currentUser', JSON.stringify(session.user))
    }, admin)
    const review = await manager.newPage()
    await review.goto(baseURL)
    await review.getByRole('tab', { name: /Correções/ }).click()
    await review.getByRole('button', { name: /trabalho.pdf/ }).waitFor()
    await review.getByRole('link', { name: 'https://example.com/referencia', exact: true }).waitFor()
    console.log('PASS anexos reais: PDF/CSV, limites, links/comentários, recuperação de falha, download restrito, conclusão, reenvio e correção.')
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
