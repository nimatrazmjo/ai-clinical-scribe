---
description: Audit security group rules for over-permissive ingress
---
List every security group and its ingress rules. Flag any rule with a 0.0.0.0/0 source on a port
other than 443, and any rule allowing the EC2 security group to reach RDS on anything but 5432.
Confirm RDS's security group has no public-facing rule at all.
