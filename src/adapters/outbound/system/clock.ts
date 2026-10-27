import type { Clock } from "../../../application/ports/outbound/clock.js";

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
