# Market scheduling

Market venues and names are data, not a hardcoded two-market enum. Small/Large Market examples are fictional initial examples, not verified campus schedules.

## Model and evaluation

A venue has an IANA timezone, active rules, date exceptions and generated dated sessions. Rules store weekday (`0` Sunday through `6` Saturday), local opening/closing `HH:mm`, interval of one or two weeks, and an explicit Monday recurrence anchor date. Week A/B is measured from that anchor; ISO week-number parity is not the business rule.

`MarketScheduleService` uses venue-local calendar dates and converts each opening/closing into UTC instants. It includes yesterday when generating the horizon so overnight sessions can remain active after midnight. Closing at/before opening means next-day closing; equal opening/closing is rejected rather than silently meaning 24 hours. Invalid/nonexistent local times and unsupported recurrence are rejected. Asia/Bangkok is the initial default; the server's current instant determines status, not a customer's device clock.

Date exceptions take precedence: cancellation marks a session cancelled, override hours replace recurring hours, and explicit hours can create a one-off on a normally closed date. An exception without a recurring or explicit interval cannot create an event. One venue has one session per local date; active recurrence rules cannot ambiguously duplicate a weekday.

## Status distinctions

- **SCHEDULED**: a valid future session, not proof that every registered shop will attend.
- **OPEN**: server time is within an uncancelled session interval; venue hours, not a vendor check-in.
- **CANCELLED**: durable cancellation; never inferred back to open by a public read.
- **FINISHED**: time is at/after the closing instant.
- **CLOSED / absent**: no current qualifying session; never invent hours.

Store attendance separately distinguishes planned registration, actual open/check-in, sold out and cancelled. Registered-vendor counts are not confirmed-open-vendor counts.

## Administrator workflow

Select a venue → edit weekdays/hours/interval/anchor → preview calendar → save. Add closures or one-time hours by exact local date. Review already persisted sessions and attendance before schedule changes; do not let a read-side session generator overwrite durable cancellations. A changed future rule must reconcile existing future sessions intentionally rather than changing historical attendance records.

## Verification cases

Normal opening/closing, exact time boundaries, Bangkok UTC-date rollover, overnight market after midnight, weekly/biweekly anchor, cancellation and special opening, invalid timezone/time, duplicate rules and a nonexistent DST local time. Use fixed instants in unit tests; integration tests prove persisted schedule changes/cancellations survive later reads. No real university calendar is implied by seed data.
