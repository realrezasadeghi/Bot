import {
	type BotContent,
	renderCourseOfferings,
	renderDailySchedule,
	renderExaminations,
	renderFields,
	renderHelp,
	renderLevels,
	renderMainMenu,
	renderPreferences,
	renderProgramCourses,
	renderPrograms,
	renderStudentPreferences,
	renderSubscription,
	renderTerms,
	renderUnresolvedProgramGrouping,
	renderWeeklySchedule,
	renderWelcome,
} from '../../../application/services/bot-messages.js';
import type { OutboundMessage, OutboundRecipient } from '../../../application/dto/messaging.js';
import type {
	DailyScheduleDto,
	ProgramSummaryDto,
	SubscriptionDto,
	WeeklyScheduleDto,
} from '../../../application/dto/schedule.js';
import type { ExaminationEntryDto, CourseOfferingView } from '../../../application/dto/read-models.js';
import type {
	AcademicLevel,
	AcademicTerm,
	FieldOfStudy,
} from '../../../domain/academic/entities.js';
import type { UserAcademicSelection } from '../../../domain/academic/study-field.js';
import type { ProgramCoursesDto } from '../../../application/use-cases/subscriptions/get-subscription.js';
import type { BotRenderer } from '../../../application/ports/outbound/bot-renderer.js';

function toMessage(content: BotContent, recipient: OutboundRecipient): OutboundMessage {
	return {
		recipient,
		text: content.text,
		buttons: content.buttons,
	};
}

export class DefaultBotRenderer implements BotRenderer {
	welcome(recipient: OutboundRecipient): OutboundMessage {
		return toMessage(renderWelcome(), recipient);
	}

	mainMenu(recipient: OutboundRecipient): OutboundMessage {
		return toMessage(renderMainMenu(), recipient);
	}

	help(recipient: OutboundRecipient): OutboundMessage {
		return toMessage(renderHelp(), recipient);
	}

	dailySchedule(schedule: DailyScheduleDto, recipient: OutboundRecipient): OutboundMessage {
		return toMessage(renderDailySchedule(schedule), recipient);
	}

	weeklySchedule(schedule: WeeklyScheduleDto, recipient: OutboundRecipient): OutboundMessage {
		return toMessage(renderWeeklySchedule(schedule), recipient);
	}

	examinations(
		examinations: ReadonlyArray<ExaminationEntryDto>,
		recipient: OutboundRecipient,
	): OutboundMessage {
		return toMessage(renderExaminations(examinations), recipient);
	}

	subscription(
		subscription: SubscriptionDto | null,
		recipient: OutboundRecipient,
	): OutboundMessage {
		return toMessage(renderSubscription(subscription), recipient);
	}

	preferences(subscription: SubscriptionDto, recipient: OutboundRecipient): OutboundMessage {
		return toMessage(renderPreferences(subscription), recipient);
	}

	studentPreferences(
		selection: UserAcademicSelection,
		recipient: OutboundRecipient,
	): OutboundMessage {
		return toMessage(renderStudentPreferences(selection), recipient);
	}

	fields(fields: ReadonlyArray<FieldOfStudy>, recipient: OutboundRecipient): OutboundMessage {
		return toMessage(renderFields(fields), recipient);
	}

	levels(levels: ReadonlyArray<AcademicLevel>, recipient: OutboundRecipient): OutboundMessage {
		return toMessage(renderLevels(levels), recipient);
	}

	terms(terms: ReadonlyArray<AcademicTerm>, recipient: OutboundRecipient): OutboundMessage {
		return toMessage(renderTerms(terms), recipient);
	}

	programs(
		programs: ReadonlyArray<ProgramSummaryDto>,
		recipient: OutboundRecipient,
	): OutboundMessage {
		return toMessage(renderPrograms(programs), recipient);
	}

	courseOfferings(
		offerings: ReadonlyArray<CourseOfferingView>,
		selectedCourseOfferingIds: ReadonlySet<string>,
		recipient: OutboundRecipient,
	): OutboundMessage {
		return toMessage(renderCourseOfferings(offerings, selectedCourseOfferingIds), recipient);
	}

	programCourses(
		courses: ProgramCoursesDto,
		selectedCourseOfferingIds?: ReadonlySet<string>,
		recipient?: OutboundRecipient,
	): OutboundMessage {
		if (!recipient) {
			throw new Error('programCourses requires a recipient');
		}
		return toMessage(
			renderProgramCourses(courses, selectedCourseOfferingIds),
			recipient,
		);
	}

	unresolvedProgramGrouping(recipient: OutboundRecipient): OutboundMessage {
		return toMessage(renderUnresolvedProgramGrouping(), recipient);
	}

	needSubscription(recipient: OutboundRecipient): OutboundMessage {
		return toMessage(
			{
				text: 'ابتدا یک برنامه تحصیلی انتخاب کنید.',
				buttons: [
					[{ text: 'انتخاب برنامه', callbackData: 'menu:subscribe' }],
					[{ text: 'بازگشت به منو', callbackData: 'menu:home' }],
				],
			},
			recipient,
		);
	}

	restartFlow(recipient: OutboundRecipient): OutboundMessage {
		return toMessage(
			{
				text: 'مرحله انتخاب منقضی شده است. لطفاً از منو دوباره شروع کنید.',
				buttons: [
					[{ text: 'انتخاب برنامه', callbackData: 'menu:subscribe' }],
					[{ text: 'بازگشت به منو', callbackData: 'menu:home' }],
				],
			},
			recipient,
		);
	}

	unsubscribeConfirm(
		subscriptionTitle: string,
		recipient: OutboundRecipient,
	): OutboundMessage {
		return toMessage(
			{
				text: `آیا از برنامه «${subscriptionTitle}» لغو اشتراک می‌کنید؟`,
				buttons: [
					[
						{ text: 'بله، لغو اشتراک', callbackData: 'unsubscribe:confirm' },
						{ text: 'انصراف', callbackData: 'unsubscribe:cancel' },
					],
				],
			},
			recipient,
		);
	}
}