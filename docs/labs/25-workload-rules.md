# Lab 25 — Write simple, explainable workload rules

## Goal

Calculate a workload description from schedule facts using pure Python functions. The first version is transparent rules, not machine learning or medical advice.

## Before you start

Complete Lab 20 or prepare event-block fixtures. The rule function accepts normalized start/end minute values and has no database dependency.

## 1. Define the input/output contract

Create `app/schemas/workload.py`:

```python
from typing import Literal
from pydantic import BaseModel


class WorkloadSummary(BaseModel):
    level: Literal["open", "steady", "busy"]
    reason: str
    suggestion: str
    scheduled_minutes: int
    longest_streak_minutes: int
```

The fixed level set prevents the UI receiving unexpected labels. The reason and suggestion explain the rule's result.

## 2. Keep rule logic separate from HTTP and database

Create `app/services/workload.py`:

```python
from dataclasses import dataclass


@dataclass(frozen=True)
class EventBlock:
    start_minute: int
    end_minute: int


def summarize_workload(blocks: list[EventBlock]) -> dict:
    valid = sorted(
        (b for b in blocks if b.end_minute > b.start_minute),
        key=lambda b: b.start_minute,
    )
    # Merge overlaps so simultaneous calendar entries are not counted twice.
    total = 0
    merged_end = None
    for block in valid:
        if merged_end is None or block.start_minute >= merged_end:
            total += block.end_minute - block.start_minute
        elif block.end_minute > merged_end:
            total += block.end_minute - merged_end
        merged_end = max(merged_end or block.end_minute, block.end_minute)
    streak = 0
    longest = 0
    streak_end = None
    for block in valid:
        if streak_end is None or block.start_minute > streak_end + 30:
            streak = block.end_minute - block.start_minute
        else:
            streak += max(0, block.end_minute - max(block.start_minute, streak_end))
        streak_end = max(streak_end or block.end_minute, block.end_minute)
        longest = max(longest, streak)

    if total >= 360 or longest >= 180:
        return {"level": "busy", "reason": "Several hours of your day are scheduled.",
                "suggestion": "Consider protecting a short open block.",
                "scheduled_minutes": total, "longest_streak_minutes": longest}
    if total >= 180:
        return {"level": "steady", "reason": "You have a few scheduled blocks today.",
                "suggestion": "Leave a little transition time between tasks.",
                "scheduled_minutes": total, "longest_streak_minutes": longest}
    return {"level": "open", "reason": "Your calendar has open space today.",
            "suggestion": "Keep some of that space available if you can.",
            "scheduled_minutes": total, "longest_streak_minutes": longest}
```

This rule counts scheduled time and adjacent blocks with a 30-minute tolerance. It does not say how a person feels or diagnose burnout. The numbers are a first product hypothesis and should be revisited with evidence.

## 3. Test boundaries

Create `tests/test_workload.py`. Cover no events, invalid zero-length event, 179/180 minutes, 359/360 minutes, and blocks with a 30-minute break versus a longer break. Test the returned reason matches the selected level.

Include an overlap case such as 09:00–10:00 and 09:30–10:30. The total should be 90 minutes, not 120. This catches the common mistake of summing event lengths without merging overlaps.

Run:

```bash
python -m pytest tests/test_workload.py
```

Pure functions are cheap to test because no server, database, or network is needed.

Example overlap test:

```python
def test_overlapping_events_are_not_double_counted():
    blocks = [EventBlock(540, 600), EventBlock(570, 630)]
    result = summarize_workload(blocks)
    assert result["scheduled_minutes"] == 90
```

## Common mistakes

- Overlapping events count twice: merge intervals before calculating scheduled minutes.
- Rule labels sound diagnostic: describe calendar facts and offer reversible suggestions.
- Threshold edge behaves inconsistently: write tests for the exact threshold and one minute on each side.

## Exercise

Add a rule for three consecutive meetings with no 30-minute gap. Write the test first and include the factual reason in the output.

## Commit

```bash
git add services/api/app/schemas/workload.py services/api/app/services/workload.py services/api/tests/test_workload.py docs/labs/25-workload-rules.md
git commit -m "feat: add explainable workload rules"
git push
```
