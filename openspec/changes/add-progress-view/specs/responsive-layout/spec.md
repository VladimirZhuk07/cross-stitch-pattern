# Spec Delta

## MODIFIED Requirements

### Requirement: View switcher is a segmented control on compact screens
On a compact screen the view switcher SHALL show `Original`, `DMC colors`, `Chart` and
`Progress` as four adjacent segments filling the row, with the selected one marked by a thicker
accent border and bold text (not by color alone). Its `View` caption SHALL stay available to
screen readers. It SHALL remain a radio group operable with the keyboard, with a visible focus
ring. Down to 360 px every segment label SHALL fit on one line without horizontal scrolling.

#### Scenario: Selected segment
- **WHEN** a pattern exists at 375 px and the user taps `Chart`
- **THEN** `Chart` is selected, shown with a thicker border and bold text, and the frame shows the Chart layer

#### Scenario: No pattern
- **WHEN** no pattern exists at 375 px
- **THEN** `DMC colors`, `Chart` and `Progress` are visible but disabled, as on desktop

#### Scenario: Four segments on a small phone
- **WHEN** a pattern exists at 360 × 640
- **THEN** the four segments are each at least 44 × 44 px, every label is on one line, and the page's scroll width is 360 px
