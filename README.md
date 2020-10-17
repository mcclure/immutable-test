This is a Typescript web app intended for testing the "SortedList" class in a fork of immutable.js. Code is in `src/`, resources are in `static/` and when built it's installed in `site/`.

Created by Andi McClure.

[Build instructions](run.txt)

[License](LICENSE.txt)

## Usage

When run, the features are:

- Add: Add whatever you typed in the box to the list. Numbers will be retyped as js numbers.
- Shift: Remove least element and print to console
- Pop: Remove greatest element and print to console
- "White box": In this mode the structure internals are visualized.
- "Black box": In this mode the contents are displayed as an iterator.
- "Hide": In this mode the contents are not displayed (good for long random tests)
- "Hist" &lt;/&gt;: The last 20 or so revisions of the list are saved and this lets you visit them. The number shown is how far back in the history you are.
- "Random" [stepcount] +/-: Perform a series of random add, shift and pop operations with numbers between 0 and 10000. + means the operations are twice as likely to be adds as removes, and - means they are twice as likely to be removes as adds. The operations are printed to the console. After each step the list will be tested for correctness, if anything is wrong the test will halt.
