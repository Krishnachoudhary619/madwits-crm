from __future__ import annotations

import argparse
import sys

from app.db.session import SessionLocal
from app.services.exceptions import AdminAlreadyExistsError, UsernameTakenError
from app.services.user_service import provision_initial_admin


def create_admin(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m app.cli",
        description="Provision the initial Madweb CRM Admin account.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)
    create = subparsers.add_parser("create-admin", help="Create the first Admin user.")
    create.add_argument("--username", required=True)
    create.add_argument("--display-name", required=True)
    create.add_argument("--password", required=True)

    args = parser.parse_args(argv)
    session = SessionLocal()
    try:
        user = provision_initial_admin(
            session,
            username=args.username,
            password=args.password,
            display_name=args.display_name,
        )
        session.commit()
        print(f"Created Admin {user.username} ({user.id})")
        return 0
    except (AdminAlreadyExistsError, UsernameTakenError) as exc:
        session.rollback()
        print(exc.message, file=sys.stderr)
        return 1
    finally:
        session.close()


def main() -> None:
    raise SystemExit(create_admin())


if __name__ == "__main__":
    main()
