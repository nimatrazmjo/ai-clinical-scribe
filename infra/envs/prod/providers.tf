provider "aws" {
  region = var.region

  # Applied to every taggable resource in this configuration — satisfies the
  # "tag everything project=ai-clinical-scribe" convention without repeating
  # tags in each module.
  default_tags {
    tags = {
      project     = "ai-clinical-scribe"
      environment = var.environment
      managed_by  = "terraform"
    }
  }
}
