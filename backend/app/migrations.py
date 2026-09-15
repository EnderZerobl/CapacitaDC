"""Small, versioned migrations for the existing SQLite/PostgreSQL databases.

Run on startup. Legacy quiz rows and accumulated points are preserved; a null
game_revision_id explicitly selects the compatible legacy quiz evaluator.
"""

from sqlalchemy import inspect, text

from app.database import Base


def migrate(engine):
    with engine.begin() as connection:
        if connection.dialect.name == "postgresql":
            # Serialize startup migrations across workers/processes.
            connection.execute(text("SELECT pg_advisory_xact_lock(729143820)"))
        Base.metadata.create_all(bind=connection)
        connection.execute(text(
            "CREATE TABLE IF NOT EXISTS schema_migrations "
            "(version INTEGER PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)"
        ))
        applied = set(connection.execute(text("SELECT version FROM schema_migrations")).scalars())
        if 1 not in applied:
            columns = {column["name"] for column in inspect(connection).get_columns("training_nodes")}
            if "game_revision_id" not in columns:
                connection.execute(text(
                    "ALTER TABLE training_nodes ADD COLUMN game_revision_id VARCHAR "
                    "REFERENCES game_revisions(id) ON DELETE RESTRICT"
                ))
            connection.execute(text("INSERT INTO schema_migrations(version) VALUES (1)"))
        if 2 not in applied:
            # Preserve the best result/completion from old duplicate progress rows.
            # The total points already awarded are deliberately left unchanged.
            duplicates = connection.execute(text(
                "SELECT user_id, node_id FROM user_node_progress "
                "GROUP BY user_id, node_id HAVING COUNT(*) > 1"
            )).mappings().all()
            for pair in duplicates:
                rows = connection.execute(text(
                    "SELECT id, completed, score, completed_at FROM user_node_progress "
                    "WHERE user_id = :user_id AND node_id = :node_id ORDER BY id"
                ), dict(pair)).mappings().all()
                keeper = rows[0]["id"]
                completed_at = next((row["completed_at"] for row in rows if row["completed_at"]), None)
                connection.execute(text(
                    "UPDATE user_node_progress SET completed = :completed, score = :score, "
                    "completed_at = :completed_at WHERE id = :id"
                ), {"completed": any(row["completed"] for row in rows),
                    "score": max(row["score"] for row in rows),
                    "completed_at": completed_at, "id": keeper})
                connection.execute(text(
                    "DELETE FROM user_node_progress WHERE user_id = :user_id "
                    "AND node_id = :node_id AND id <> :id"
                ), {**dict(pair), "id": keeper})
            connection.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_user_node_progress "
                "ON user_node_progress (user_id, node_id)"
            ))
            connection.execute(text("INSERT INTO schema_migrations(version) VALUES (2)"))
        if 3 not in applied:
            # "pluginfo" era um eixo de conteúdo que nenhum participante alcançava.
            # O papel PlugInfo (users.type = "organizador") não é afetado por isto.
            # Cada passo confere as colunas antes de rodar: create_all só cria tabelas
            # que faltam, então um banco antigo pode não ter todas elas.
            def columns_of(table):
                return {column["name"] for column in inspect(connection).get_columns(table)}

            node_columns = columns_of("training_nodes")
            if "eixo" in node_columns:
                if "order_index" in node_columns:
                    # As etapas convertidas entram depois das que já existem no eixo
                    # trainee, para a trilha manter uma ordem única. A renumeração vem
                    # antes da troca de eixo, senão a subconsulta já enxerga as movidas.
                    connection.execute(text(
                        "UPDATE training_nodes SET order_index = order_index + "
                        "(SELECT COALESCE(MAX(order_index), -1) + 1 FROM training_nodes WHERE eixo = 'trainee') "
                        "WHERE eixo = 'pluginfo'"
                    ))
                # Voltam bloqueadas: conteúdo que nunca esteve visível não deve surgir liberado.
                assignments, params = ["eixo = 'trainee'"], {}
                if "is_released" in node_columns:
                    assignments.append("is_released = :closed")
                    params["closed"] = False
                if "released_at" in node_columns:
                    assignments.append("released_at = NULL")
                connection.execute(text(
                    f"UPDATE training_nodes SET {', '.join(assignments)} WHERE eixo = 'pluginfo'"
                ), params)
            for table, column in [("materials", "type"), ("materials", "eixo"),
                                  ("activities", "eixo"), ("games", "eixo")]:
                if column in columns_of(table):
                    connection.execute(text(
                        f"UPDATE {table} SET {column} = 'trainee' WHERE {column} = 'pluginfo'"
                    ))
            connection.execute(text("INSERT INTO schema_migrations(version) VALUES (3)"))
        if 4 not in applied:
            # A nota de rotação deixa de ser digitada e passa a ser a média ponderada
            # das entregas já corrigidas. O valor digitado até aqui é sobrescrito, por
            # isso fica guardado antes: se alguma nota refletia critério de fora da
            # plataforma, ela só existe nesta cópia.
            from collections import defaultdict
            from app.services.activity_service import normalize_weight, weighted_average

            connection.execute(text(
                "CREATE TABLE IF NOT EXISTS nota_rotacao_backup_v4 AS "
                "SELECT id, nota_rotacao FROM users"
            ))
            # A coluna de peso nunca foi criada por migração: em um banco anterior a
            # ela, toda correção quebraria ao consultar activities.weight.
            if "weight" not in {column["name"] for column in inspect(connection).get_columns("activities")}:
                connection.execute(text(
                    "ALTER TABLE activities ADD COLUMN weight FLOAT NOT NULL DEFAULT 1.0"
                ))
            connection.execute(text("UPDATE activities SET weight = 1.0 WHERE weight IS NULL"))
            connection.execute(text("UPDATE users SET nota_rotacao = NULL"))
            # O recálculo é em Python de propósito: ROUND com casas decimais não existe
            # igual nos dois bancos, e assim a migração usa a mesma fórmula do servidor.
            pairs = defaultdict(list)
            for user_id, grade, weight in connection.execute(text(
                "SELECT s.user_id, s.grade, a.weight FROM activity_submissions s "
                "JOIN activities a ON a.id = s.activity_id WHERE s.grade IS NOT NULL"
            )).all():
                pairs[user_id].append((float(grade), normalize_weight(weight)))
            for user_id, graded in pairs.items():
                average = weighted_average(graded)
                if average is not None:
                    connection.execute(
                        text("UPDATE users SET nota_rotacao = :average WHERE id = :id"),
                        {"average": average, "id": user_id},
                    )
            connection.execute(text("INSERT INTO schema_migrations(version) VALUES (4)"))

        if 5 not in applied:
            columns = {column["name"] for column in inspect(connection).get_columns("activity_submissions")}
            if "links" not in columns:
                connection.execute(text("ALTER TABLE activity_submissions ADD COLUMN links JSON"))
            connection.execute(text("UPDATE activity_submissions SET links = '[]' WHERE links IS NULL"))
            connection.execute(text("INSERT INTO schema_migrations(version) VALUES (5)"))
