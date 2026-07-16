---
description: Add a new application-layer use case to a full-hexagonal context
argument-hint: <context-name> <UseCaseName>
---
Add a use case class `$2` to `src/contexts/$1/application/`. It orchestrates domain objects and
ports only — no direct ORM or HTTP concerns. Inject repository/port interfaces via constructor,
not concrete infrastructure classes. Emit a domain event if the use case changes aggregate state.
Write a unit test that mocks every port.
