"""Canonical role and member-axis values.

Users historically stored display names ("Vendas", "Conexões") while content uses
codes ("vendas", "conexoes"). Permissions always compare the canonical code, and
only exact known aliases are accepted: a partial match could grant an axis by
accident, and an unknown value must deny access instead of guessing.
"""
ROLES = ("admin", "organizador", "gerente", "membro", "trainee")
# Quem entra no painel administrativo. O que cada um gerencia fica em access.py.
STAFF = frozenset({"admin", "organizador", "gerente"})
PARTICIPANTS = frozenset({"membro", "trainee"})

AXIS_LABELS = {
    "vendas": "Vendas",
    "conexoes": "Conexões",
    "experiencia": "Experiência do Consumidor",
}
MEMBER_AXES = frozenset(AXIS_LABELS)
_AXIS_ALIASES = {
    "vendas": "vendas",
    "conexoes": "conexoes",
    "conexões": "conexoes",
    "experiencia": "experiencia",
    "experiência": "experiencia",
    "experiencia do consumidor": "experiencia",
    "experiência do consumidor": "experiencia",
}


def normalize_axis(value) -> str | None:
    """Canonical member-axis code, or None for empty and unknown values."""
    if not isinstance(value, str):
        return None
    return _AXIS_ALIASES.get(value.strip().lower())


def manager_axis(user) -> str | None:
    """The single axis a manager administers; None for other roles or broken data."""
    return normalize_axis(user.eixo) if user is not None and user.type == "gerente" else None
