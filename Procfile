web: cd backend && gunicorn --bind 0.0.0.0:${PORT:-8080} --workers=${GUNICORN_WORKERS:-2} --threads=${GUNICORN_THREADS:-4} --timeout=${GUNICORN_TIMEOUT:-120} app:app


