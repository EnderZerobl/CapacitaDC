# 🚀 Capacita DC - InfoJr UFBA

> Sistema Web de Capacitação para o Departamento Comercial da InfoJr UFBA.

O **Capacita DC** é uma plataforma centralizada para treinamento e onboarding de membros e trainees. O sistema gerencia o acesso a conteúdos exclusivos baseados no nível de permissão do usuário (Trainee vs. Membro Efetivo), integrado ao Prismic CMS para gestão de conteúdo.

## 🛠️ Tech Stack

O projeto utiliza uma arquitetura moderna baseada em **Monorepo**:

| Contexto | Tecnologias |
| :--- | :--- |
| **Frontend** | [Next.js 14](https://nextjs.org/), TypeScript|
| **Backend** | [NestJS](https://nestjs.com/), TypeScript, Prisma ORM, Passport (JWT) |
| **Database** | PostgreSQL 15 (via Docker) |
| **CMS** | [Prismic](https://prismic.io/) (Headless CMS) |
| **Infra/DevOps** | Docker, Docker Compose |

---

## ⚙️ Pré-requisitos

Para rodar o projeto localmente, você precisa ter instalado:

* **Git**
* **Docker & Docker Compose** (Essencial para o Banco de Dados)
* **Node.js (LTS)** (Recomendamos usar o `fnm` ou `nvm` para gerenciar a versão)

---

## 🚀 Como rodar o projeto (Quick Start)

Siga os passos abaixo para levantar o ambiente de desenvolvimento completo.

### 1. Clonar o repositório

```bash
git clone [https://gitlab.com/seu-usuario/capacita-dc.git](https://gitlab.com/seu-usuario/capacita-dc.git)
cd capacita-dc
