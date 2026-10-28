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

export function selectionReminderIdempotencyKey(input: {
	selectionId: string;
	occurrenceId: string;
	occurrenceStartAtIso: string;
	offsetMinutes: number;
}): string {
	return [
		'class-reminder',
		'selection',
		input.selectionId,
		input.occurrenceId,
		input.occurrenceStartAtIso,
		`offset-${input.offsetMinutes}`,
	].join(':');
}

export function examReminderIdempotencyKey(input: {
	selectionId: string;
	examinationId: string;
	examStartAtIso: string;
	offsetMinutes: number;
}): string {
	return [
		'exam-reminder',
		'selection',
		input.selectionId,
		input.examinationId,
		input.examStartAtIso,
		`offset-${input.offsetMinutes}`,
	].join(':');
}
