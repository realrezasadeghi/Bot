export enum SyncRunStatus {
	Running = 'RUNNING',
	Completed = 'COMPLETED',
	Failed = 'FAILED',
	Rejected = 'REJECTED',
}

export interface SyncRunStats {
	levels: number;
	fields: number;
	terms: number;
	programs: number;
	programOfferings: number;
	courses: number;
	instructors: number;
	courseOfferings: number;
	meetingPatterns: number;
	scheduleExceptions: number;
	examinations: number;
	occurrencesCreated: number;
	occurrencesUpdated: number;
	occurrencesCancelled: number;
	warnings: number;
}

export interface SyncRun {
	id: string;
	sourceKey: string;
	status: SyncRunStatus;
	startedAt: Date;
	finishedAt: Date | null;
	stats: SyncRunStats | null;
	errorSummary: string | null;
}
