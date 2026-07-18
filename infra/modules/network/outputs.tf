output "vpc_id" {
  value       = aws_vpc.this.id
  description = "VPC id."
}

output "vpc_cidr" {
  value       = aws_vpc.this.cidr_block
  description = "VPC CIDR block."
}

output "azs" {
  value       = local.azs
  description = "AZs the VPC spans."
}

output "public_subnet_ids" {
  value       = aws_subnet.public[*].id
  description = "Public subnet ids (ALB, NAT)."
}

output "app_subnet_ids" {
  value       = aws_subnet.app[*].id
  description = "Private-app subnet ids (ECS/EC2)."
}

output "data_subnet_ids" {
  value       = aws_subnet.data[*].id
  description = "Private-data subnet ids (RDS, RDS Proxy)."
}

output "nat_gateway_ids" {
  value       = aws_nat_gateway.this[*].id
  description = "NAT gateway ids."
}

output "app_route_table_ids" {
  value       = aws_route_table.app[*].id
  description = "Private-app route table ids (attach the S3 gateway endpoint here)."
}

output "data_route_table_id" {
  value       = aws_route_table.data.id
  description = "Private-data route table id."
}
