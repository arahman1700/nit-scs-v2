## ADDED Requirements

### Requirement: QueryKey factory per resource
Each React Query hook module SHALL export a queryKey factory object that produces consistent, normalized cache keys. Keys MUST use sorted primitive values, not object references.

#### Scenario: List query key with filters
- **WHEN** hook calls `resourceKeys.list({ status: 'active', page: 2 })`
- **THEN** queryKey is `['resource', 'list', { page: 2, status: 'active' }]` with alphabetically sorted keys

#### Scenario: Detail query key
- **WHEN** hook calls `resourceKeys.detail(id)`
- **THEN** queryKey is `['resource', 'detail', id]`

#### Scenario: All queries key for broad invalidation
- **WHEN** hook calls `resourceKeys.all`
- **THEN** queryKey is `['resource']` matching all resource queries

### Requirement: Selective cache invalidation on mutations
Mutation `onSuccess` callbacks SHALL invalidate only the affected query scopes, not the entire resource namespace.

#### Scenario: Create mutation invalidates list only
- **WHEN** a create mutation succeeds
- **THEN** only `resourceKeys.lists()` queries are invalidated, not detail queries

#### Scenario: Update mutation invalidates specific detail and list
- **WHEN** an update mutation for item ID 5 succeeds
- **THEN** `resourceKeys.detail(5)` and `resourceKeys.lists()` are invalidated

#### Scenario: Delete mutation removes detail and invalidates list
- **WHEN** a delete mutation for item ID 5 succeeds
- **THEN** `resourceKeys.detail(5)` cache is removed and `resourceKeys.lists()` is invalidated

### Requirement: Optimistic updates for common mutations
The system SHALL implement optimistic cache updates for approve, submit, and delete operations to provide instant UI feedback.

#### Scenario: Optimistic delete removes item from list
- **WHEN** user triggers delete on an item
- **THEN** item is immediately removed from the cached list before the API responds
- **THEN** if API fails, the item is restored to its previous position in the list
