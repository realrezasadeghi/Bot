import pino, { type Logger as PinoLogger } from 'pino';
import type { Logger } from '../../../application/ports/outbound/logger.js';

export class PinoLoggerAdapter implements Logger {
	constructor(private readonly logger: PinoLogger) {}

	debug(bindings: Record<string, unknown>, message: string): void {
		this.logger.debug(bindings, message);
	}

	info(bindings: Record<string, unknown>, message: string): void {
		this.logger.info(bindings, message);
	}

	warn(bindings: Record<string, unknown>, message: string): void {
		this.logger.warn(bindings, message);
	}

	error(bindings: Record<string, unknown>, message: string): void {
		this.logger.error(bindings, message);
	}

	child(bindings: Record<string, unknown>): Logger {
		return new PinoLoggerAdapter(this.logger.child(bindings));
	}
}

/**
 * Builds the raw pino instance used for all application logging.
 *
 * The same instance is shared with the HTTP request logger so there is a
 * single configuration (level, pretty transport, timestamp format) and a
 * single output stream.
 */
export function createPinoLogger(
	level: string,
	logPretty: boolean,
	nodeEnv: 'development' | 'production' | 'test',
): PinoLogger {
	const prettyEnabled = logPretty === true && nodeEnv !== 'production';

	return pino({
		level,

		serializers: {
			err: pino.stdSerializers.err,
		},

		timestamp: pino.stdTimeFunctions.isoTime,

		...(prettyEnabled
			? {
					transport: {
						target: 'pino-pretty',
						options: {
							colorize: true,
							levelFirst: true,
							singleLine: false,
							ignore: 'pid,hostname',
							errorLikeObjectKeys: ['err', 'error'],
							translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
						},
					},
				}
			: {}),
	});
}

export function createLogger(
	level: string,
	logPretty: boolean,
	nodeEnv: 'development' | 'production' | 'test',
): Logger {
	return new PinoLoggerAdapter(createPinoLogger(level, logPretty, nodeEnv));
}
