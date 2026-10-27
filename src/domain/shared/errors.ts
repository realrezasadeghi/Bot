export class DomainError extends Error {
	readonly code: string;

	constructor(code: string, message: string) {
		super(message);
		this.name = new.target.name;
		this.code = code;
	}
}

export class ValidationError extends DomainError {
	constructor(message: string) {
		super('VALIDATION_ERROR', message);
	}
}

export class NotFoundError extends DomainError {
	constructor(message: string) {
		super('NOT_FOUND', message);
	}
}

export class ConflictError extends DomainError {
	constructor(message: string) {
		super('CONFLICT', message);
	}
}

export class InvariantViolationError extends DomainError {
	constructor(message: string) {
		super('INVARIANT_VIOLATION', message);
	}
}

export class UnresolvedIntegrationRequirementError extends DomainError {
	constructor(message: string) {
		super('UNRESOLVED_INTEGRATION_REQUIREMENT', message);
	}
}

export class ExternalSourceError extends DomainError {
	readonly retryable: boolean;

	constructor(message: string, retryable: boolean) {
		super('EXTERNAL_SOURCE_ERROR', message);
		this.retryable = retryable;
	}
}
