from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory


def test_alembic_config_loads() -> None:
    root = Path(__file__).resolve().parents[1]
    config = Config(str(root / "alembic.ini"))
    script = ScriptDirectory.from_config(config)
    assert script.get_current_head() is None
    assert list(script.walk_revisions()) == []
