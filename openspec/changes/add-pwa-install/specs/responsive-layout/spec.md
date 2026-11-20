# Spec Delta

## MODIFIED Requirements

### Requirement: Compact portrait layout gives the frame the remaining height
On a compact screen the app SHALL show one column, top to bottom: the header (title and
`Choose image`), the settings toggle with the generation status, the view switcher, the frame,
one row with the status line and the zoom controls, the legend toggle, and, while it is shown,
the install bar (app-install) at the bottom. The frame SHALL fill
the height left over in the dynamic viewport (which follows the browser's address bar), and
SHALL be at least 10rem (160 px) tall.

#### Scenario: iPhone SE with collapsed panels
- **WHEN** the screen is 375 × 667, a 1200 × 800 image and its pattern are loaded, both panels are collapsed and no install bar is shown
- **THEN** the page does not scroll vertically and the frame is at least 300 px tall and as wide as the page content

#### Scenario: iPhone SE with the install bar
- **WHEN** the same screen and pattern as above show the install bar
- **THEN** the page does not scroll vertically, the bar is below the legend toggle, and the frame is at least 236 px tall (at most 64 px less than without the bar)

#### Scenario: Address bar hides
- **WHEN** the mobile browser hides its address bar and the visible height grows by 56 px
- **THEN** the frame grows by 56 px and the view stays centred on the same image point

#### Scenario: Both panels expanded on a short screen
- **WHEN** the screen is 375 × 667 and both the settings and the legend are expanded
- **THEN** the frame is at least 160 px tall and the page scrolls vertically to reach the rest

### Requirement: Compact landscape layout puts the panels beside the frame
On a compact landscape screen the app SHALL show the header on top, the frame on the left with
the view switcher, zoom controls and status line in a 9rem (144 px) column right of it, and
the settings and legend panels in a 16rem (256 px) side column at the right edge, scrolling on
their own. The frame SHALL fill the full height below the header, and above the install bar
(app-install) while that bar is shown.

#### Scenario: iPhone SE in landscape
- **WHEN** the screen is 667 × 375 with a pattern and no install bar is shown
- **THEN** the settings and legend toggles are in a 256 px column at the right, the frame is at least 280 px tall and at least 220 px wide, and the page does not scroll vertically while the panels are collapsed

#### Scenario: iPhone SE in landscape with the install bar
- **WHEN** the screen is 667 × 375 with a pattern and the install bar is shown
- **THEN** the bar spans the full width below the frame and the side column, the frame is at least 216 px tall (at most 64 px less than without the bar), and the page does not scroll vertically while the panels are collapsed

#### Scenario: Pixel 7 in landscape
- **WHEN** the screen is 915 × 412 (compact: lower than 480 and narrower than 960)
- **THEN** the compact landscape layout is used, not the medium layout
