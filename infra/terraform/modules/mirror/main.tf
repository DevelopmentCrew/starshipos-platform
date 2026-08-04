# Hourly Base44 -> RDS data mirror.
#
# A one-shot Fargate task (the export/replace-import/reconcile scripts, containerised)
# runs inside the VPC so it can reach the private database, fired on a schedule by
# EventBridge. The real image + task-def revisions are registered by the
# mirror-deploy workflow; Terraform owns the surrounding infra (ECR, roles, schedule,
# the Base44 token secret placeholder).

variable "name" { type = string }
variable "cluster_name" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "security_group_id" { type = string } # reuse the API service SG (can reach RDS + egress via NAT)
variable "db_secret_arn" { type = string }
variable "schedule_expression" {
  type    = string
  default = "rate(1 hour)"
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  region             = data.aws_region.current.name
  account_id         = data.aws_caller_identity.current.account_id
  cluster_arn        = "arn:aws:ecs:${local.region}:${local.account_id}:cluster/${var.cluster_name}"
  taskdef_family_arn = "arn:aws:ecs:${local.region}:${local.account_id}:task-definition/${var.name}-mirror"
}

# --- image registry ---
resource "aws_ecr_repository" "mirror" {
  name = "${var.name}-mirror"
  image_scanning_configuration { scan_on_push = true }
}

# --- Base44 token secret (Dave sets the real value out of band) ---
resource "aws_secretsmanager_secret" "base44" {
  name        = "${var.name}/base44-token"
  description = "Base44 admin bearer token for the hourly data mirror. Value: {\"token\":\"<jwt>\"}"
}
resource "aws_secretsmanager_secret_version" "base44" {
  secret_id     = aws_secretsmanager_secret.base44.id
  secret_string = jsonencode({ token = "REPLACE_ME" })
  lifecycle { ignore_changes = [secret_string] } # real value updated manually; never revert it
}

# --- logs ---
resource "aws_cloudwatch_log_group" "mirror" {
  name              = "/ecs/${var.name}-mirror"
  retention_in_days = 30
}

# --- task execution role: pull image, read the two secrets, write logs ---
resource "aws_iam_role" "exec" {
  name = "${var.name}-mirror-exec"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "ecs-tasks.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}
resource "aws_iam_role_policy_attachment" "exec_managed" {
  role       = aws_iam_role.exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}
resource "aws_iam_role_policy" "exec_secrets" {
  name = "read-secrets"
  role = aws_iam_role.exec.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "secretsmanager:GetSecretValue"
      Resource = [var.db_secret_arn, aws_secretsmanager_secret.base44.arn]
    }]
  })
}

# --- task role (runtime): the container makes no AWS API calls, so keep it empty ---
resource "aws_iam_role" "task" {
  name = "${var.name}-mirror-task"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "ecs-tasks.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}

# --- bootstrap task def; real revisions come from the mirror-deploy workflow ---
resource "aws_ecs_task_definition" "mirror" {
  family                   = "${var.name}-mirror"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.exec.arn
  task_role_arn            = aws_iam_role.task.arn
  container_definitions = jsonencode([{
    name      = "mirror"
    image     = "${aws_ecr_repository.mirror.repository_url}:bootstrap"
    essential = true
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.mirror.name
        "awslogs-region"        = local.region
        "awslogs-stream-prefix" = "mirror"
      }
    }
  }])
  lifecycle { ignore_changes = [container_definitions] }
}

# --- schedule: run the task hourly ---
resource "aws_cloudwatch_event_rule" "mirror" {
  name                = "${var.name}-mirror"
  description         = "Hourly Base44 -> RDS data mirror"
  schedule_expression = var.schedule_expression
}
resource "aws_iam_role" "events" {
  name = "${var.name}-mirror-events"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "events.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}
resource "aws_iam_role_policy" "events" {
  name = "run-mirror-task"
  role = aws_iam_role.events.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Action    = "ecs:RunTask"
        Resource  = "${local.taskdef_family_arn}:*"
        Condition = { ArnLike = { "ecs:cluster" = local.cluster_arn } }
      },
      {
        Effect   = "Allow"
        Action   = "iam:PassRole"
        Resource = [aws_iam_role.exec.arn, aws_iam_role.task.arn]
      }
    ]
  })
}
resource "aws_cloudwatch_event_target" "mirror" {
  rule     = aws_cloudwatch_event_rule.mirror.name
  arn      = local.cluster_arn
  role_arn = aws_iam_role.events.arn
  ecs_target {
    task_definition_arn = local.taskdef_family_arn # family (no revision) -> latest active
    task_count          = 1
    launch_type         = "FARGATE"
    network_configuration {
      subnets          = var.private_subnet_ids
      security_groups  = [var.security_group_id]
      assign_public_ip = false
    }
  }
}

output "ecr_repository_url" { value = aws_ecr_repository.mirror.repository_url }
output "base44_secret_arn" { value = aws_secretsmanager_secret.base44.arn }
