import uuid
from app.database import engine, SessionLocal
from app.models import Base, User, Material, Document, Video, TrainingNode, Question, Option
from app.auth import get_password_hash

def seed_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        # Clear existing tables to ensure clean seed
        print("Limpando banco de dados para seed...")
        db.query(Option).delete()
        db.query(Question).delete()
        db.query(TrainingNode).delete()
        db.query(Document).delete()
        db.query(Video).delete()
        db.query(Material).delete()
        db.query(User).delete()
        db.commit()

        print("Iniciando seeding de usuários...")

        # 1. Criar Usuários
        users_to_create = [
            {
                "name": "Admin Info",
                "email": "admin@infoej.com.br",
                "password": "admin123",
                "cargo": "Administrador",
                "type": "admin",
                "eixo": None,
                "nota_rotacao": None,
                "pontos_acumulados": 0
            },
            {
                "name": "Organizador PlugInfo",
                "email": "organizador@infoej.com.br",
                "password": "123456",
                "cargo": "Organizador do PlugInfo",
                "type": "organizador",
                "eixo": None,
                "nota_rotacao": None,
                "pontos_acumulados": 0
            },
            {
                "name": "Maria Silva",
                "email": "maria@infoej.com.br",
                "password": "123456",
                "cargo": "Analista de Vendas",
                "type": "membro",
                "eixo": "Vendas",
                "nota_rotacao": None,
                "pontos_acumulados": 450
            },
            {
                "name": "Bruno Mendes",
                "email": "bruno@infoej.com.br",
                "password": "123456",
                "cargo": "Analista de Parcerias",
                "type": "membro",
                "eixo": "Conexões",
                "nota_rotacao": None,
                "pontos_acumulados": 300
            },
            {
                "name": "Carla Ferreira",
                "email": "carla@infoej.com.br",
                "password": "123456",
                "cargo": "Gestora de CX",
                "type": "membro",
                "eixo": "Experiência do Consumidor",
                "nota_rotacao": None,
                "pontos_acumulados": 150
            },
            {
                "name": "João Trainee",
                "email": "joao@gmail.com",
                "password": "123456",
                "cargo": "Trainee",
                "type": "trainee",
                "eixo": None,
                "nota_rotacao": 7.5,
                "pontos_acumulados": 250
            },
            {
                "name": "Gabriel Oliveira",
                "email": "gabriel@gmail.com",
                "password": "123456",
                "cargo": "Trainee",
                "type": "trainee",
                "eixo": None,
                "nota_rotacao": 8.5,
                "pontos_acumulados": 500
            },
            {
                "name": "Helena Rocha",
                "email": "helena@gmail.com",
                "password": "123456",
                "cargo": "Trainee",
                "type": "trainee",
                "eixo": None,
                "nota_rotacao": 9.0,
                "pontos_acumulados": 600
            }
        ]

        for u_data in users_to_create:
            user = User(
                id=str(uuid.uuid4()),
                name=u_data["name"],
                email=u_data["email"],
                password_hash=get_password_hash(u_data["password"]),
                cargo=u_data["cargo"],
                type=u_data["type"],
                eixo=u_data["eixo"],
                photo="",
                nota_rotacao=u_data["nota_rotacao"],
                pontos_acumulados=u_data["pontos_acumulados"]
            )
            db.add(user)
            db.flush()

        print("Seeding de Materiais...")

        # 2. Criar Materiais didáticos
        materials = {
            "spin_intro": Material(
                id="mat-spin-intro",
                name="Metodologia SPIN Selling",
                type="trainee",
                eixo="vendas",
                text="O SPIN Selling é uma técnica de vendas que foca em fazer as perguntas certas na ordem certa para revelar as necessidades do cliente. A sigla significa: S - Situação, P - Problema, I - Implicação, N - Necessidade de Solução. \n\n1. Perguntas de Situação: coletam fatos sobre o contexto do cliente.\n2. Perguntas de Problema: investigam insatisfações ou dificuldades.\n3. Perguntas de Implicação: exploram as consequências financeiras/operacionais das dores.\n4. Perguntas de Necessidade de Solução: revelam o valor de resolver esses problemas, fazendo o cliente explicar os benefícios da solução."
            ),
            "prospecção": Material(
                id="mat-prospeccao",
                name="Técnicas de Prospecção Comercial",
                type="trainee",
                eixo="vendas",
                text="Técnicas essenciais para prospectar novos clientes B2B. A prospecção ativa envolve a pesquisa prévia das dores da empresa parceira, a estruturação de um cold email e técnicas de contorno na primeira abordagem telefônica."
            ),
            "cx_basico": Material(
                id="mat-cx-basico",
                name="Básico de Experiência do Cliente",
                type="trainee",
                eixo="experiencia",
                text="Neste módulo introdutório de Customer Experience (CX), abordamos a importância da comunicação empática, feedbacks construtivos e canais ágeis de atendimento comercial."
            ),
            "vendas_avancado": Material(
                id="mat-vendas-avancado",
                name="Negociação Avançada e Fechamento",
                type="membro",
                eixo="vendas",
                text="Frameworks para negociar contratos complexos. Gerenciamento de concessões, alinhamento de SLA e negociações baseadas em valor, não em preço."
            ),
            "conexoes_networking": Material(
                id="mat-conexoes-net",
                name="Networking Estratégico",
                type="membro",
                eixo="conexoes",
                text="A construção de relacionamentos corporativos de longo prazo. Como criar pontes de valor mútuo e manter contato ativo com parceiros comerciais de destaque."
            ),
            "cx_avancado": Material(
                id="mat-cx-avancado",
                name="CX Avançado e Métricas de Sucesso",
                type="membro",
                eixo="experiencia",
                text="Aprenda a aplicar e metrificar a fidelidade do cliente através do NPS (Net Promoter Score) e do CSAT (Customer Satisfaction Score)."
            ),
            "pluginfo_material": Material(
                id="mat-pluginfo-1",
                name="Manual de Onboarding do PlugInfo",
                type="pluginfo",
                eixo="pluginfo",
                text="Manual de organização do PlugInfo. Contém regras de credenciamento, fluxos de contato rápido com os palestrantes e cronograma das rodadas de negócios do evento."
            )
        }

        for mat in materials.values():
            db.add(mat)
        db.flush()

        # Add docs to materials
        db.add(Document(id=str(uuid.uuid4()), material_id="mat-spin-intro", name="SPIN Selling PDF.pdf", url="https://example.com/spin.pdf"))
        db.add(Document(id=str(uuid.uuid4()), material_id="mat-pluginfo-1", name="Guia do Organizador.pdf", url="https://example.com/pluginfo-guia.pdf"))

        print("Seeding do Grafo de Aprendizado (Training Nodes)...")

        # 3. Criar Trilha de Aprendizado em Grafo (Nodes)
        
        # --- TRILHA TRAINEE ---
        t_node1 = TrainingNode(
            id="node-t1",
            name="1. Conceito do SPIN Selling",
            type="material",
            reference_id="mat-spin-intro",
            eixo="trainee",
            prerequisite_node_id=None,
            x_pos=0.0,
            y_pos=0.0
        )
        t_node2 = TrainingNode(
            id="node-t2",
            name="2. Jogo Mestre do SPIN",
            type="game",
            reference_id=None,
            eixo="trainee",
            prerequisite_node_id="node-t1",
            x_pos=1.0,
            y_pos=1.5
        )
        t_node3 = TrainingNode(
            id="node-t3",
            name="3. Prospecção Avançada",
            type="material",
            reference_id="mat-prospeccao",
            eixo="trainee",
            prerequisite_node_id="node-t2",
            x_pos=-1.0,
            y_pos=3.0
        )
        t_node4 = TrainingNode(
            id="node-t4",
            name="4. Quiz de Qualificação (BANT)",
            type="game",
            reference_id=None,
            eixo="trainee",
            prerequisite_node_id="node-t3",
            x_pos=0.0,
            y_pos=4.5
        )
        t_node5 = TrainingNode(
            id="node-t5",
            name="5. Experiência do Cliente",
            type="material",
            reference_id="mat-cx-basico",
            eixo="trainee",
            prerequisite_node_id="node-t4",
            x_pos=1.0,
            y_pos=6.0
        )

        db.add_all([t_node1, t_node2, t_node3, t_node4, t_node5])
        db.flush()

        # --- TRILHA MEMBRO: VENDAS ---
        v_node1 = TrainingNode(
            id="node-v1",
            name="1. Fechamento de Vendas B2B",
            type="material",
            reference_id="mat-vendas-avancado",
            eixo="vendas",
            prerequisite_node_id=None,
            x_pos=0.0,
            y_pos=0.0
        )
        v_node2 = TrainingNode(
            id="node-v2",
            name="2. Jogo: Contornando Objeções",
            type="game",
            reference_id=None,
            eixo="vendas",
            prerequisite_node_id="node-v1",
            x_pos=1.0,
            y_pos=1.5
        )
        db.add_all([v_node1, v_node2])
        db.flush()

        # --- TRILHA MEMBRO: CONEXÕES ---
        c_node1 = TrainingNode(
            id="node-c1",
            name="1. Parcerias e Negócios",
            type="material",
            reference_id="mat-conexoes-net",
            eixo="conexoes",
            prerequisite_node_id=None,
            x_pos=0.0,
            y_pos=0.0
        )
        c_node2 = TrainingNode(
            id="node-c2",
            name="2. Quiz de Conexões Comerciais",
            type="game",
            reference_id=None,
            eixo="conexoes",
            prerequisite_node_id="node-c1",
            x_pos=-1.0,
            y_pos=1.5
        )
        db.add_all([c_node1, c_node2])
        db.flush()

        # --- TRILHA MEMBRO: EXPERIÊNCIA DO CONSUMIDOR ---
        e_node1 = TrainingNode(
            id="node-e1",
            name="1. CX Avançado",
            type="material",
            reference_id="mat-cx-avancado",
            eixo="experiencia",
            prerequisite_node_id=None,
            x_pos=0.0,
            y_pos=0.0
        )
        e_node2 = TrainingNode(
            id="node-e2",
            name="2. Jogo: Resolvendo Casos de Clientes",
            type="game",
            reference_id=None,
            eixo="experiencia",
            prerequisite_node_id="node-e1",
            x_pos=1.0,
            y_pos=1.5
        )
        db.add_all([e_node1, e_node2])
        db.flush()


        print("Seeding de Perguntas e Opções dos Jogos...")

        # 4. Perguntas e Opções do SPIN Selling (node-t2)
        
        # Pergunta 1: Situação
        q1 = Question(
            id="q-spin-1",
            node_id="node-t2",
            text="Você se reúne com um gerente comercial de uma indústria. Qual pergunta de Situação é a mais adequada para iniciar a conversa?",
            explanation="Perguntas de Situação coletam fatos sobre o cenário atual de forma neutra."
        )
        db.add(q1)
        db.flush()
        db.add_all([
            Option(id=str(uuid.uuid4()), question_id="q-spin-1", text="Quais são seus principais gargalos hoje?", is_correct=False, score=40, feedback="Esta pergunta já investiga o Problema, o que é cedo demais para o início do SPIN."),
            Option(id=str(uuid.uuid4()), question_id="q-spin-1", text="Quantos vendedores você tem na equipe e como eles dividem as metas?", is_correct=True, score=100, feedback="Excelente! Uma ótima pergunta de Situação."),
            Option(id=str(uuid.uuid4()), question_id="q-spin-1", text="O quanto isso afeta sua margem de lucro?", is_correct=False, score=10, feedback="Esta é uma pergunta de Implicação, inadequada para o começo da conversa."),
            Option(id=str(uuid.uuid4()), question_id="q-spin-1", text="Se pudéssemos automatizar esse processo, ajudaria?", is_correct=False, score=20, feedback="Esta é uma pergunta de Necessidade de Solução, pulando etapas fundamentais.")
        ])

        # Pergunta 2: Problema
        q2 = Question(
            id="q-spin-2",
            node_id="node-t2",
            text="Agora que você sabe que ele tem 15 vendedores usando planilhas manuais, qual pergunta de Problema revela melhor a insatisfação dele com esse cenário?",
            explanation="Perguntas de Problema focam em dificuldades, dores e insatisfações com o processo atual."
        )
        db.add(q2)
        db.flush()
        db.add_all([
            Option(id=str(uuid.uuid4()), question_id="q-spin-2", text="Você está satisfeito com o tempo gasto atualizando essas planilhas manuais?", is_correct=True, score=100, feedback="Ótimo! Foca na insatisfação gerada pelas planilhas manuais."),
            Option(id=str(uuid.uuid4()), question_id="q-spin-2", text="Você gostaria de comprar nosso sistema de automação comercial?", is_correct=False, score=10, feedback="Muito direto. Você deve primeiro extrair as dores antes de propor a solução."),
            Option(id=str(uuid.uuid4()), question_id="q-spin-2", text="Qual a receita anual da empresa?", is_correct=False, score=30, feedback="Esta é mais uma pergunta de Situação. O cliente pode achar entediante responder fatos básicos nesta fase."),
            Option(id=str(uuid.uuid4()), question_id="q-spin-2", text="E se eu te desse 15% de desconto para fechar agora?", is_correct=False, score=10, feedback="Desconto prematuro prejudica o fechamento baseado em valor.")
        ])

        # Pergunta 3: Implicação
        q3 = Question(
            id="q-spin-3",
            node_id="node-t2",
            text="O gerente admite que a atualização manual gasta muito tempo e gera erros de digitação. Qual pergunta de Implicação conecta esses erros à dor financeira do negócio?",
            explanation="Implicação faz o cliente perceber a gravidade e o impacto financeiro/emocional do problema."
        )
        db.add(q3)
        db.flush()
        db.add_all([
            Option(id=str(uuid.uuid4()), question_id="q-spin-3", text="Esses erros de digitação na planilha geram gargalos que fazem você perder vendas ou clientes importantes?", is_correct=True, score=100, feedback="Fantástico! Implicação faz o cliente refletir sobre as consequências dos erros no faturamento."),
            Option(id=str(uuid.uuid4()), question_id="q-spin-3", text="Você quer resolver esse problema de planilhas?", is_correct=False, score=20, feedback="Pergunta genérica que não aprofunda o impacto ou consequência do problema."),
            Option(id=str(uuid.uuid4()), question_id="q-spin-3", text="Como funciona a contratação de fornecedores aqui?", is_correct=False, score=30, feedback="Pergunta de Situação. Não ajuda a ampliar a dor do problema descoberto."),
            Option(id=str(uuid.uuid4()), question_id="q-spin-3", text="Nosso sistema é ótimo para resolver erros, sabia?", is_correct=False, score=10, feedback="Evite fazer auto-promoção antes de concluir a fase de Implicação.")
        ])

        # Pergunta 4: Necessidade de Solução
        q4 = Question(
            id="q-spin-4",
            node_id="node-t2",
            text="O cliente concorda que perde cerca de 3 vendas por mês devido a erros e demora nas propostas. Qual pergunta de Necessidade de Solução convida o cliente a explicar o valor da solução?",
            explanation="Perguntas de Necessidade de Solução focam no valor, utilidade e benefícios de resolver a dor."
        )
        db.add(q4)
        db.flush()
        db.add_all([
            Option(id=str(uuid.uuid4()), question_id="q-spin-4", text="Se integrarmos uma solução que elimina erros e reduz o tempo de propostas em 80%, qual seria o impacto na receita e na produtividade da sua equipe?", is_correct=True, score=100, feedback="Perfeito! Coloca o cliente na posição de defender os benefícios da sua solução."),
            Option(id=str(uuid.uuid4()), question_id="q-spin-4", text="Nosso software custa R$2.000 por mês. Vamos fechar?", is_correct=False, score=20, feedback="Apresentação de preço precoce sem consolidar o valor da solução."),
            Option(id=str(uuid.uuid4()), question_id="q-spin-4", text="Você acha que conseguiria treinar sua equipe para usar um sistema?", is_correct=False, score=40, feedback="Pergunta operacional que não foca nos benefícios gerais da resolução da dor."),
            Option(id=str(uuid.uuid4()), question_id="q-spin-4", text="Qual o melhor dia para assinarmos o contrato?", is_correct=False, score=15, feedback="Pressão de fechamento tradicional que pode afastar o cliente B2B.")
        ])

        # 5. Jogo de BANT (node-t4 - Tinder/Swipe de Leads)
        q_bant1 = Question(
            id="q-bant-1",
            node_id="node-t4",
            text="Lead: 'Somos uma empresa de TI, faturamento de R$1.5M/ano. Buscamos um parceiro de marketing para iniciar em 15 dias, e o orçamento está aprovado pela diretoria.' Como qualificar?",
            explanation="Esse lead possui Budget, Autoridade, Necessidade e Tempo claros (BANT completo)."
        )
        db.add(q_bant1)
        db.flush()
        db.add_all([
            Option(id=str(uuid.uuid4()), question_id="q-bant-1", text="Hot Lead (BANT Completo)", is_correct=True, score=100, feedback="Exato! Todos os critérios BANT estão preenchidos. Lead quente!"),
            Option(id=str(uuid.uuid4()), question_id="q-bant-1", text="Warm Lead (Nutrir)", is_correct=False, score=40, feedback="Este lead já tem tudo pronto, nutrir atrasaria a venda."),
            Option(id=str(uuid.uuid4()), question_id="q-bant-1", text="Cold Lead (Descartar)", is_correct=False, score=0, feedback="Lead excelente, jamais deve ser descartado.")
        ])

        q_bant2 = Question(
            id="q-bant-2",
            node_id="node-t4",
            text="Lead: 'Estou estudando marketing digital para um projeto pessoal que vou lançar no ano que vem. Não tenho orçamento ainda.' Como qualificar?",
            explanation="Sem orçamento e sem prazo próximo. Não é uma prioridade comercial atual."
        )
        db.add(q_bant2)
        db.flush()
        db.add_all([
            Option(id=str(uuid.uuid4()), question_id="q-bant-2", text="Hot Lead (BANT Completo)", is_correct=False, score=10, feedback="Incorreto. Falta verba e urgência."),
            Option(id=str(uuid.uuid4()), question_id="q-bant-2", text="Warm Lead (Nutrir)", is_correct=True, score=100, feedback="Excelente! Manter em nutrição com conteúdos automáticos até que o projeto ganhe tração."),
            Option(id=str(uuid.uuid4()), question_id="q-bant-2", text="Cold Lead (Descartar)", is_correct=False, score=50, feedback="Pode ser mantido em nutrição em vez de descartado por completo.")
        ])

        # 6. Jogo de Objeções para Membros (node-v2)
        q_obj1 = Question(
            id="q-obj-1",
            node_id="node-v2",
            text="Cliente diz: 'Seu produto é ótimo, mas achamos muito caro no momento.' Qual o melhor contorno de objeção?",
            explanation="Para contornar o 'caro', é ideal converter preço em retorno sobre investimento (ROI)."
        )
        db.add(q_obj1)
        db.flush()
        db.add_all([
            Option(id=str(uuid.uuid4()), question_id="q-obj-1", text="Entendo. Posso te dar um desconto de 30%?", is_correct=False, score=30, feedback="Desconto direto desvaloriza sua proposta de valor."),
            Option(id=str(uuid.uuid4()), question_id="q-obj-1", text="Entendo a preocupação. Vamos analisar o retorno que a automação trará: ao economizar X horas, o sistema se paga em 3 meses.", is_correct=True, score=100, feedback="Perfeito! Você ancora o preço no valor gerado e no ROI."),
            Option(id=str(uuid.uuid4()), question_id="q-obj-1", text="Infelizmente nosso preço é fixo. Não consigo mudar.", is_correct=False, score=10, feedback="Muito rígido e sem empatia com a preocupação do cliente.")
        ])

        # 7. Jogo de CX para Membros (node-e2)
        q_cx1 = Question(
            id="q-cx-1",
            node_id="node-e2",
            text="Um cliente antigo entra em contato furioso porque o sistema ficou fora do ar por 2 horas durante um pico de vendas. Como você responde?",
            explanation="A resposta ideal de CX deve demonstrar empatia imediata, assumir a responsabilidade e apresentar a solução prática."
        )
        db.add(q_cx1)
        db.flush()
        db.add_all([
            Option(id=str(uuid.uuid4()), question_id="q-cx-1", text="Pedimos desculpas pelo transtorno. Nossa equipe de engenharia resolveu a instabilidade, e criamos um plano de compensação de crédito na sua próxima fatura.", is_correct=True, score=100, feedback="Excelente! Empatia, resolução e reparação proativa."),
            Option(id=str(uuid.uuid4()), question_id="q-cx-1", text="O erro foi de um parceiro de nuvem terceirizado, não nosso.", is_correct=False, score=10, feedback="Terceirizar a culpa irrita ainda mais o cliente."),
            Option(id=str(uuid.uuid4()), question_id="q-cx-1", text="Por favor, abra um chamado no link de suporte que responderemos em até 24 horas.", is_correct=False, score=20, feedback="Resolução burocrática e lenta para um momento de crise.")
        ])

        db.commit()
        print("Seeding completo com sucesso!")
    except Exception as e:
        db.rollback()
        print(f"Erro durante seeding: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
