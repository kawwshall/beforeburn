# Lab 23 — Complete the calendar planning slice

## Outcome

Make connection, selection, sync, Day, Week, and Month work as one coherent product area.

## Build

1. Add navigation from an empty Plan screen to Connect Calendar.
2. On disconnect, delete stored credentials and local synced events according to your documented retention choice.
3. Distinguish provider events from beforeburn-created recovery events with a `source_type`; never overwrite a provider event with a local event.
4. Add pull-to-refresh and a visible “last synced” label.
5. Test the journey: connect → choose → sync → view → disconnect → empty state.

## Source-of-truth rule

Google owns Google events. beforeburn owns its recovery blocks. beforeburn may cache Google events for display, but must not pretend its cached copy is the provider’s authoritative record.

## Exercise

Write a one-paragraph product explanation for what happens when the user deletes an event in Google.

## Commit

`git commit -am "feat: complete calendar planning experience"`
