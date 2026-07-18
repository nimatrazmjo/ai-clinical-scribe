# ── ECR module ─────────────────────────────────────────────────────────────
# One repository per image the task runs:
#   api → NestJS backend            (backend/Dockerfile, target production)
#   web → nginx + built SPA sidecar (frontend/Dockerfile, target production)
#
# Tags are IMMUTABLE: a given git-SHA tag always maps to the exact bytes that
# were built, so a rollback to a prior SHA is deterministic and there is no
# moving "latest" that could drift. The lifecycle policy keeps a bounded
# rollback horizon and sweeps untagged layers.

resource "aws_ecr_repository" "this" {
  for_each = toset(var.repositories)

  name                 = "${var.name}/${each.value}"
  image_tag_mutability = var.image_tag_mutability
  force_delete         = var.force_delete

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = merge(var.tags, { Name = "${var.name}/${each.value}" })
}

resource "aws_ecr_lifecycle_policy" "this" {
  for_each   = aws_ecr_repository.this
  repository = each.value.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images after ${var.untagged_expire_days} days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = var.untagged_expire_days
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Keep only the most recent ${var.max_image_count} images (rollback horizon)"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = var.max_image_count
        }
        action = { type = "expire" }
      }
    ]
  })
}
