TF_DIR := infra/terraform
ENV    ?= dev

.PHONY: help init plan apply fmt validate export reconcile schema

help:
	@echo "StarshipOS platform — common tasks"
	@echo "  make init ENV=dev|prod     terraform init for an environment"
	@echo "  make plan ENV=dev|prod     terraform plan"
	@echo "  make apply ENV=dev|prod    terraform apply"
	@echo "  make fmt                   terraform fmt"
	@echo "  make validate              terraform validate"
	@echo "  make export                export all Base44 entities (needs BASE44_* env)"
	@echo "  make reconcile             build reconciliation report from the export"
	@echo "  make schema                regenerate schema.sql from schema-baseline/raw"

init:
	terraform -chdir=$(TF_DIR) init \
	  -backend-config="bucket=starshipos-tfstate-$(ENV)" \
	  -backend-config="dynamodb_table=starshipos-tflock-$(ENV)" \
	  -backend-config="key=starshipos/$(ENV)/terraform.tfstate" \
	  -backend-config="region=eu-west-2"

plan:
	terraform -chdir=$(TF_DIR) plan -var-file="environments/$(ENV).tfvars"

apply:
	terraform -chdir=$(TF_DIR) apply -var-file="environments/$(ENV).tfvars"

fmt:
	terraform -chdir=$(TF_DIR) fmt -recursive

validate:
	terraform -chdir=$(TF_DIR) validate

export:
	node scripts/export-base44.mjs

reconcile:
	node scripts/reconcile.mjs

schema:
	python3 db/schema-gen.py
