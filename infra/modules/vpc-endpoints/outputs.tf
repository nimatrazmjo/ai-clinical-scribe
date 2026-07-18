output "endpoint_security_group_id" {
  value       = aws_security_group.endpoints.id
  description = "SG attached to the interface endpoints."
}

output "interface_endpoint_ids" {
  value       = { for k, e in aws_vpc_endpoint.interface : k => e.id }
  description = "Map of service -> interface endpoint id."
}

output "s3_endpoint_id" {
  value       = aws_vpc_endpoint.s3.id
  description = "S3 gateway endpoint id."
}
