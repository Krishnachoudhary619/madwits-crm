"""Add COMPLETED job lead status.

Revision ID: b2e1c4a8f091
Revises: 08f9bccd529b
Create Date: 2026-10-11

"""

from typing import Sequence, Union

from alembic import op

revision: str = "b2e1c4a8f091"
down_revision: Union[str, Sequence[str], None] = "08f9bccd529b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_VALUES = (
    "lead_status IN ("
    "'NEW_INQUIRY', 'QUOTATION_PREPARED', 'AWAITING_CONFIRMATION', "
    "'CONFIRMED', 'COMPLETED', 'LOST', 'CANCELLED')"
)
OLD_VALUES = (
    "lead_status IN ("
    "'NEW_INQUIRY', 'QUOTATION_PREPARED', 'AWAITING_CONFIRMATION', "
    "'CONFIRMED', 'LOST', 'CANCELLED')"
)


def upgrade() -> None:
    op.drop_constraint("ck_jobs_lead_status", "jobs", type_="check")
    op.create_check_constraint("ck_jobs_lead_status", "jobs", NEW_VALUES)
    op.execute(
        """
        UPDATE jobs AS j
        SET lead_status = 'COMPLETED', updated_at = now()
        FROM workflow_stages AS ws
        WHERE j.current_stage_id = ws.id
          AND j.lead_status = 'CONFIRMED'
          AND ws.is_final IS TRUE
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE jobs
        SET lead_status = 'CONFIRMED', updated_at = now()
        WHERE lead_status = 'COMPLETED'
        """
    )
    op.drop_constraint("ck_jobs_lead_status", "jobs", type_="check")
    op.create_check_constraint("ck_jobs_lead_status", "jobs", OLD_VALUES)
