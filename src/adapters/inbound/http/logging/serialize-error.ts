export function serializeError(error: unknown): Record<string, unknown> {
	if (!(error instanceof Error)) {
		return {
			value: String(error),
		};
	}

	const result: Record<string, unknown> = {
		name: error.name,
		message: error.message || '(empty error message)',
		stack: error.stack,
	};

	const details = error as Error & {
		code?: unknown;
		cause?: unknown;
	};

	if (details.code !== undefined) {
		result.code = details.code;
	}

	if (details.cause !== undefined) {
		result.cause = serializeError(details.cause);
	}

	if (error instanceof AggregateError) {
		result.errors = Array.from(error.errors, serializeError);
	}

	return result;
}
