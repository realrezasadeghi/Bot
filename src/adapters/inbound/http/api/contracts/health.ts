import { z } from 'zod';

/** Response body for `GET /api/health`. */
export const HealthResponseSchema = z
	.object({
		status: z.literal('ok'),
	})
	.meta({
		id: 'HealthResponse',
		description: 'Returned when the database is reachable.',
	});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
