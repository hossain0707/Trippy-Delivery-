FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv
COPY pyproject.toml ./
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./
COPY scripts ./scripts
COPY catalog ./catalog
RUN pip install --no-cache-dir . && useradd -u 10001 -r -s /usr/sbin/nologin appuser
USER appuser
EXPOSE 8000
CMD ["python", "scripts/start.py"]
