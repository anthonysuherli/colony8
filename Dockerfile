FROM public.ecr.aws/lambda/python:3.12
COPY pyproject.toml README.md ./
COPY colony8/ ./colony8/
COPY demo/ ./demo/
RUN pip install --no-cache-dir .
CMD ["colony8.api.app.handler"]
