import type { IncomingPlatformEvent } from '../../../../application/dto/incoming.js';
import type {
	OutboundMessage,
	OutboundRecipient,
} from '../../../../application/dto/messaging.js';
import type { BotRenderer as BR } from '../../../../application/ports/outbound/bot-renderer.js';
import type { Clock as Clk } from '../../../../application/ports/outbound/clock.js';
import type { ConversationStateStore as CSS } from '../../../../application/ports/outbound/conversation-state-store.js';
import type { Logger } from '../../../../application/ports/outbound/logger.js';
import type { UnitOfWork as UoW } from '../../../../application/ports/outbound/unit-of-work.js';
import type {
	GetAvailableFields,
	GetAvailableLevels,
	GetAvailablePrograms,
} from '../../academic/get-academic-options.js';
import type { GetAvailableCourseOfferings } from '../../academic/get-available-course-offerings.js';
import type { GetAvailableTerms } from '../../academic/get-available-terms.js';
import type { GetStudyFields } from '../../academic/get-study-fields.js';
import type { GetUpcomingExaminations } from '../../academic/get-upcoming-examinations.js';
import type { SaveStudentCourseSelection } from '../../academic/save-student-course-selection.js';
import type { UpdateStudentNotificationPreferences } from '../../academic/update-student-notification-preferences.js';
import type { RegisterOrResolveUser } from '../../identity/register-or-resolve-user.js';
import type {
	GetDailySchedule,
	GetWeeklySchedule,
} from '../../scheduling/get-schedules.js';
import type {
	CustomizeCourseSelection,
	FollowProgramDefault,
} from '../../subscriptions/customize-course-selection.js';
import type {
	GetCurrentSubscription,
	GetProgramCourses,
} from '../../subscriptions/get-subscription.js';
import type { SubscribeToProgram } from '../../subscriptions/subscribe-to-program.js';
import type { UnsubscribeFromProgram } from '../../subscriptions/unsubscribe-from-program.js';
import type { UpdateNotificationPreferences } from '../../subscriptions/update-notification-preferences.js';

export interface IncomingMessageDependencies {
	uow: UoW;
	clock: Clk;
	logger: Logger;
	stateStore: CSS;
	registerOrResolveUser: RegisterOrResolveUser;
	getAvailableTerms: GetAvailableTerms;
	getAvailableLevels: GetAvailableLevels;
	getAvailableFields: GetAvailableFields;
	getAvailablePrograms: GetAvailablePrograms;
	getDailySchedule: GetDailySchedule;
	getWeeklySchedule: GetWeeklySchedule;
	getUpcomingExaminations: GetUpcomingExaminations;
	getStudyFields: GetStudyFields;
	getAvailableCourseOfferings: GetAvailableCourseOfferings;
	saveStudentCourseSelection: SaveStudentCourseSelection;
	updateStudentNotificationPreferences: UpdateStudentNotificationPreferences;
	getCurrentSubscription: GetCurrentSubscription;
	getProgramCourses: GetProgramCourses;
	subscribeToProgram: SubscribeToProgram;
	customizeCourseSelection: CustomizeCourseSelection;
	followProgramDefault: FollowProgramDefault;
	updateNotificationPreferences: UpdateNotificationPreferences;
	unsubscribeFromProgram: UnsubscribeFromProgram;
}

import type { CommandRouter } from '../command-router.js';

export interface IncomingMessageDependencies {
	uow: UoW;
	clock: Clk;
	logger: Logger;
	stateStore: CSS;
	registerOrResolveUser: RegisterOrResolveUser;
	getAvailableTerms: GetAvailableTerms;
	getAvailableLevels: GetAvailableLevels;
	getAvailableFields: GetAvailableFields;
	getAvailablePrograms: GetAvailablePrograms;
	getDailySchedule: GetDailySchedule;
	getWeeklySchedule: GetWeeklySchedule;
	getUpcomingExaminations: GetUpcomingExaminations;
	getStudyFields: GetStudyFields;
	getAvailableCourseOfferings: GetAvailableCourseOfferings;
	saveStudentCourseSelection: SaveStudentCourseSelection;
	updateStudentNotificationPreferences: UpdateStudentNotificationPreferences;
	getCurrentSubscription: GetCurrentSubscription;
	getProgramCourses: GetProgramCourses;
	subscribeToProgram: SubscribeToProgram;
	customizeCourseSelection: CustomizeCourseSelection;
	followProgramDefault: FollowProgramDefault;
	updateNotificationPreferences: UpdateNotificationPreferences;
	unsubscribeFromProgram: UnsubscribeFromProgram;
}

export interface HandlerDeps extends IncomingMessageDependencies {
	renderer: BR;
	commandRouter: CommandRouter;
}

export interface CommandContext {
	command: string;
	userId: string;
	event: IncomingPlatformEvent;
	recipient: OutboundRecipient;
}

export interface CommandHandler {
	execute(context: CommandContext): Promise<OutboundMessage | null>;
}

export interface CallbackContext {
	userId: string;
	event: IncomingPlatformEvent;
	recipient: OutboundRecipient;
	payload: CallbackPayload;
}

export interface CallbackHandler {
	execute(context: CallbackContext): Promise<OutboundMessage | null>;
}

export interface CallbackPayload {
	action: string;
	rest: string;
	params: ReadonlyArray<string>;
}
