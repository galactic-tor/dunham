# You have to define the values in {}
APP_NAME=kermit
PORT=4000

# HELP
# This will output the help for each task
# thanks to https://marmelab.com/blog/2016/02/29/auto-documented-makefile.html
.PHONY: help

# DOCKER TASKS
# Build the container
build: ## Build the container
	docker build -t $(APP_NAME) .

run: ## Run container on port configured in `config.env`
	docker run -i -t --rm --env-file=./.env -p=$(PORT):$(PORT) --name="$(APP_NAME)" $(APP_NAME)

run-local: 
	export $(grep -v '^#' .env | xargs -0) && \
	node index.js

puppeteer-base:
	docker build -f ./Dockerfiles/puppeteer.dockerfile -t docker.io/kwyn/puppeteer ./Dockerfiles

seal-prod-env:
	kubectl create secret generic dunham.env --namespace=dunham-prod --dry-run=client --from-file secrets/.env -o json > .env-secret.json && \
	kubeseal --format=yaml < secrets/.env-secret.json > ./deploy/sealed-env-prod.yaml

seal-dev-env:
	kubectl create secret generic dunham.env --namespace=dunham-dev --dry-run=client --from-file secrets/.env -o json > secrets/.env-secret.json && \
	kubeseal --format=yaml < secrets/.env-secret.json > ./deploy/sealed-env-dev.yaml

