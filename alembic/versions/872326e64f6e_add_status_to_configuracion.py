from alembic import op
import sqlalchemy as sa

revision = "872326e64f6e"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "configuracion",
        sa.Column("status", sa.Boolean(), nullable=True)
    )


def downgrade():
    op.drop_column("configuracion", "status")
