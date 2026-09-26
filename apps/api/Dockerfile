FROM python:3.11-slim

WORKDIR /app

ENV DB_PATH=/data/portal.sqlite3

COPY apps/api/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --disable-pip-version-check -r requirements.txt

COPY fixtures.json ./fixtures.json
COPY apps/api/app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]





