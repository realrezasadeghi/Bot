export enum DeliveryAttemptStatus {
	Delivered = 'DELIVERED',
	Failed = 'FAILED',
}

export interface DeliveryAttempt {
	id: string;
	jobId: string;
	attemptNo: number;
	provider: string;
	status: DeliveryAttemptStatus;
	providerMessageId: string | null;
	error: string | null;
	startedAt: Date;
	finishedAt: Date | null;
}
