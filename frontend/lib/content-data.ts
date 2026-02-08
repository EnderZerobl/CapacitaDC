export type ContentType = "membro" | "trainee"
export type Eixo = "vendas" | "conexoes" | "experiencia"

export interface ContentDocument {
  name: string
  url: string
}

export interface ContentItem {
  id: string
  name: string
  type: ContentType
  eixo: Eixo
  text: string
  documents: ContentDocument[]
  videos: string[]
}

// Shared content data that can be used across the application
export const contentData: ContentItem[] = [
  {
    id: "content-1",
    name: "Técnicas de Prospecção",
    type: "membro",
    eixo: "vendas",
    text: "Material completo sobre técnicas avançadas de prospecção B2B. Este conteúdo aborda estratégias comprovadas para identificar e qualificar leads, incluindo metodologias como SPIN Selling e Challenger Sale. Aprenda a criar scripts eficazes, superar objeções comuns e maximizar sua taxa de conversão.",
    documents: [
      { name: "Guia de Prospecção.pdf", url: "https://example.com/doc1" },
      { name: "Templates de Email.pdf", url: "https://example.com/doc2" },
    ],
    videos: ["https://youtube.com/watch?v=abc123"],
  },
  {
    id: "content-2",
    name: "Onboarding Comercial",
    type: "trainee",
    eixo: "vendas",
    text: "Conteúdo introdutório para novos trainees do setor comercial. Este material abrange os fundamentos da área de vendas, incluindo processos internos, ferramentas utilizadas e métricas de desempenho. Ideal para quem está iniciando na área e precisa entender o funcionamento básico do departamento comercial.",
    documents: [
      { name: "Manual do Trainee.pdf", url: "https://example.com/doc3" },
    ],
    videos: [],
  },
  {
    id: "content-3",
    name: "Networking e Parcerias",
    type: "membro",
    eixo: "conexoes",
    text: "Aprenda as melhores práticas de networking e construção de parcerias estratégicas. Este conteúdo cobre técnicas de aproximação, manutenção de relacionamentos comerciais e desenvolvimento de parcerias de longo prazo.",
    documents: [],
    videos: ["https://youtube.com/watch?v=def456", "https://youtube.com/watch?v=ghi789"],
  },
  {
    id: "content-4",
    name: "Jornada do Cliente",
    type: "membro",
    eixo: "experiencia",
    text: "Técnicas para mapear e otimizar a jornada do cliente. Abordamos estratégias de customer success, pontos de contato críticos e técnicas de encantamento. Aprenda a identificar oportunidades de melhoria e implementar ações que aumentam a satisfação do cliente.",
    documents: [
      { name: "CRM Best Practices.pdf", url: "https://example.com/doc4" },
    ],
    videos: [],
  },
  {
    id: "content-5",
    name: "Introdução a Conexões",
    type: "trainee",
    eixo: "conexoes",
    text: "Fundamentos de networking para trainees. Este módulo introduz os conceitos básicos de construção de relacionamentos profissionais, eventos de networking e primeiros contatos com clientes.",
    documents: [
      { name: "Guia de Networking.pdf", url: "https://example.com/doc5" },
    ],
    videos: ["https://youtube.com/watch?v=jkl012"],
  },
  {
    id: "content-6",
    name: "Customer Experience Avançado",
    type: "membro",
    eixo: "experiencia",
    text: "Metodologias avançadas de experiência do consumidor. Aprenda a implementar pesquisas NPS, mapear touchpoints e criar estratégias de fidelização. Este conteúdo também aborda métricas de satisfação e frameworks de melhoria contínua.",
    documents: [
      { name: "Template NPS.xlsx", url: "https://example.com/doc6" },
      { name: "Guia de CX.pdf", url: "https://example.com/doc7" },
    ],
    videos: ["https://youtube.com/watch?v=mno345"],
  },
  {
    id: "content-7",
    name: "Básico de Experiência do Cliente",
    type: "trainee",
    eixo: "experiencia",
    text: "Introdução às práticas de experiência do consumidor para trainees. Aprenda os fundamentos de atendimento ao cliente, comunicação empática e gestão básica de feedbacks.",
    documents: [],
    videos: ["https://youtube.com/watch?v=pqr678"],
  },
  {
    id: "content-8",
    name: "Fundamentos de Conexões",
    type: "trainee",
    eixo: "conexoes",
    text: "Conceitos básicos de conexões comerciais para trainees. Este módulo apresenta os fundamentos do relacionamento profissional, etiqueta de negócios e primeiros passos no networking.",
    documents: [
      { name: "Conceitos de Networking.pdf", url: "https://example.com/doc8" },
    ],
    videos: [],
  },
]

export const eixoLabels: Record<Eixo, string> = {
  vendas: "Vendas",
  conexoes: "Conexões",
  experiencia: "Experiência do Consumidor",
}

export const eixoColors: Record<Eixo, string> = {
  vendas: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  conexoes: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  experiencia: "bg-amber-500/20 text-amber-400 border-amber-500/30",
}
