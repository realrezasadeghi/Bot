export function reminderIdempotencyKey(input: {
	subscriptionId: string;
	occurrenceId: string;
	occurrenceStartAtIso: string;
	offsetMinutes: number;
}): string {
	return [
		'class-reminder',
		input.subscriptionId,
		input.occurrenceId,
		input.occurrenceStartAtIso,
		`offset-${input.offsetMinutes}`,
	].join(':');
}

export function dailySummaryIdempotencyKey(input: {
	subscriptionId: string;
	localDate: string;
}): string {
	return ['daily-summary', input.subscriptionId, input.localDate].join(':');
}
