output "sns_topic_arn" {
  value       = aws_sns_topic.alarms.arn
  description = "Alarm SNS topic ARN (subscribe Slack/PagerDuty/webhooks here)."
}
