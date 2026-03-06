## ADDED Requirements

### Requirement: Real-time field validation feedback
Document forms SHALL display validation errors inline as the user interacts with fields. Errors SHALL appear after a field is touched (blurred) or after a short debounce while typing.

#### Scenario: Required field left empty after blur
- **WHEN** user focuses a required field and then blurs without entering a value
- **THEN** an inline error message appears below the field immediately

#### Scenario: Pattern validation while typing
- **WHEN** user types in a field with format constraints (e.g., email, phone)
- **THEN** validation feedback appears after 500ms debounce if the value is invalid

#### Scenario: Valid input clears error
- **WHEN** user corrects a previously invalid field value
- **THEN** the inline error message is removed immediately

### Requirement: Distinguish blocking errors from warnings
The form validation UI SHALL visually distinguish between blocking errors (red, prevents submission) and warnings (amber, allows submission with confirmation).

#### Scenario: Blocking error prevents submit
- **WHEN** form has one or more blocking validation errors
- **THEN** submit button is disabled and error fields are highlighted with red border

#### Scenario: Warning allows submit with confirmation
- **WHEN** form has warnings but no blocking errors
- **THEN** submit button is enabled but clicking it shows a confirmation dialog listing the warnings

### Requirement: Validation summary at form top
When the user attempts to submit a form with errors, a validation summary SHALL appear at the top of the form listing all errors with links to the offending fields.

#### Scenario: Submit with errors shows summary
- **WHEN** user clicks submit on a form with 3 validation errors
- **THEN** a summary card appears at the top listing all 3 errors
- **THEN** clicking an error in the summary scrolls to and focuses the corresponding field
