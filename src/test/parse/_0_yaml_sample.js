/**
 * Sample YAML data for testing Yamd parsing
 */
export function getSampleYaml() {
  return `# Sample Yamd Document
Introduction: Welcome to Yamd
Features[divider,childDisplay=ul]:
  - Flexible styling with square bracket grammar
  - "Support for various display types[selfDisplay=panel]":
    - Panels with expand/collapse
    - Timeline views 
    - Lists and tags
  - Easy to write and read

# Inline LaTeX Math Examples
Math Examples[panel,panelDefault=expand]:
  - "Basic equations[child=ul]": "The famous equation $E = mc^2$ revolutionized physics"
  - "Complex formulas": "For quadratic equations $ax^2 + bx + c = 0$, the solution is $x = \\\\frac{-b \\\\pm \\\\sqrt{b^2-4ac}}{2a}$"
  - "Mixed content": "Temperature conversion: $C = \\\\frac{5}{9}(F - 32)$ where C is Celsius and F is Fahrenheit"
  - "Greek letters": "The area of a circle is $A = \\\\pi r^2$ and circumference is $C = 2\\\\pi r$"

Timeline Example[timeline]:
  - "Project Started[bullet=Check]": Initial planning phase
  - "Development[bullet=Dash]": Core features implementation  
  - "Testing[bullet=Question]": Quality assurance
  - "Release[bullet=UpArrow]": Production deployment

Key Features[key,valueNum=2]:
  - Fast parsing
  - React components
  - Modern UI
  - Extensible architecture
  - Custom styling
  - Type safety

Technical Stack[panel,panelDefault=expand]:
  - "Frontend[childDisplay=ul]":
    - React 18
    - Modern CSS
    - Component architecture
  - "Backend[childDisplay=ul]":  
    - Node.js
    - Express
    - Database integration

# LaTeX Block Examples
LaTeX Blocks[panel,panelDefault=expand]:
  - "[latex]\\\\boldsymbol{\\\\theta}":
    caption: "Parameter vector in bold notation"
    height: "100px"
  
  - test latex block in list[child=ul]:
    # Test no_index attribute - won't be numbered
    - "[latex]x = y":
      no_index: true
      caption: "Simple equation without numbering"
    
    # Test custom caption title and user-defined ID
    - "[latex]\\\\sum_{i=1}^n x_i":
      caption_title: "Formula"
      caption: "Summation notation example"
      id: "summation-formula"
    
    # LaTeX indentation mistake tolerance is handled in code
    # When users write wrong indentation, system auto-corrects it
    # Wrong: [latex]xxx: followed by unindented attributes
    # Right: [latex]xxx: followed by properly indented attributes
    - "[latex]":
        content: "\\\\frac{\\\\partial L}{\\\\partial \\\\theta} = \\\\nabla_{\\\\theta} L(\\\\theta)"
        caption: "Gradient of loss function"
    - "[latex]\\\\mathbf{X} = \\\\begin{bmatrix} x_1 & x_2 \\\\\\\\ x_3 & x_4 \\\\end{bmatrix}":
        caption: "Matrix notation example"

# Image Block Examples  
Image Examples[panel,panelDefault=expand]:
  - "[image]https://picsum.photos/400/200":
    caption: "A sample placeholder image from Picsum"
    alt: "Sample placeholder image"
    width: "300px"
    id: "sample-image"
  
  - "[img]":
    src: "https://httpbin.org/image/jpeg"
    caption: "Another sample image using img shorthand"
    height: "120px"
  
  # Test image indentation mistake tolerance
  - "[image]https://picsum.photos/seed/green/250/125":
    caption: "Image with alternative grammar (indentation mistake tolerance)"
    alt: "Green sample image"

# Video Block Examples
Video Examples[panel,panelDefault=expand]:
  - "[video]https://sample-videos.com/zip/10/mp4/SampleVideo_360x240_1mb.mp4":
    caption: "Sample video with default controls"
    width: "300px"
    id: "sample-video"
  
  - "[vid]":
    # src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
    src: "aaa"
    caption: "Big Buck Bunny sample video with playOnLoad"
    playOnLoad: true
    muted: true
    height: "200px"
  
  # Test video with loop
  - "[video]https://sample-videos.com/zip/10/mp4/SampleVideo_640x360_1mb.mp4":
    caption: "Looping video example"
    loop: true
    controls: true

  # Reference System Examples
  - "Reference Examples[panel,panelDefault=expand]":
    - "Text with references": "As shown in \\\\ref{}{summation-formula}, the mathematical relationship is clear. See also \\\\ref{Figure 1}{sample-image} for visual representation."
    - "Auto-generated references": "The equation \\\\ref{}{summation-formula} demonstrates the concept, while \\\\ref{}{sample-video} provides additional context."
    - "Bibliography citations": "This research builds on previous work \\\\bib{smith2020,jones2019}. The methodology follows \\\\bib{brown2021} and extends the findings of \\\\bib{davis2018,wilson2020}."
    - "Mixed references": "The formula \\\\ref{}{summation-formula} is derived from \\\\bib{einstein1905}, as discussed in \\\\ref{Figure 1}{sample-image}."
  - "Mixed content": "Einstein's famous equation $E = mc^2$ is referenced as \\\\ref{}{summation-formula}, and you can see \\\\ref{Visual example}{sample-image} for more details."
  - "Complex example": "The study shows that \\\\ref{Equation 2}{summation-formula} correlates with the data in \\\\ref{}{sample-image}. For a demonstration, watch \\\\ref{}{sample-video}."`;
}

/**
 * Corner case YAML data for comprehensive testing
 */
export function getCornerCaseYaml() {
  return `# Corner Cases Test Document

# Empty and special bracket cases
"Empty brackets": "Text with [] empty brackets"
"Double empty": "[][]"
"Multiple brackets": "Text [attr=value] with [class=special] multiple"
"At start": "[panel]Panel content starts here"
"At end": "Content ends here[divider]"
"Nested brackets": "Text [attr=val[nested]] with nested"

# LaTeX Corner Cases - Testing Edge Cases
"LaTeX Edge Cases[panel,panelDefault=expand]":
  - "Empty math": "Empty dollars $$ should not parse as LaTeX"
  - "Unpaired dollars": "Single $ should not break parsing $incomplete"
  - "Reference exclusion": "Citations like $ref{citation1} should not be parsed as math"
  - "Multiple refs": "Multiple $ref{cite1} and $ref{cite2} should be preserved"
  - "Mixed patterns": "Valid $x^2$ and invalid $ref{test} and incomplete $ in one line"
  - "Whitespace math": "Spaces in math $  x + y  $ should be preserved"
  - "Special chars": "Math with symbols $\\alpha + \\beta = \\gamma$ works"
  - "Fractions": "Complex fractions $\\frac{a}{b} + \\frac{c}{d} = \\frac{ad + bc}{bd}$ test"
  - "At boundaries": "$start$ with math at beginning and end $finish$"
  - "Only math": "$E = mc^2$"
  - "Double dollars": "Display math $$x^2 + y^2 = z^2$$ should not parse"
  - "Nested dollars": "Weird case $outer $inner$ math$ should handle gracefully"

# Special grammar tests  
"[key]": Direct shorthand key
"[divider,childDisplay=ul]": Divider with list children
"[panel,ul,panelDefault=expand]": Panel with shorthand and expand
"[none,plain-list]": Anonymous with plain list
"[timeline]": Timeline shorthand

# Value and class tests
"Custom classes[selfClass=my-title,childClass=my-child]":
  - Item 1
  - Item 2
"Number values[valueNum=3]":
  - First sibling
  - Second sibling  
  - Third sibling
  - Fourth child
  - Fifth child

# Display type synonyms
"Unordered list[childDisplay=unordered-list]":
  - Bullet point 1
  - Bullet point 2
"Paragraphs[childDisplay=paragraph]":
  - First paragraph
  - Second paragraph
"Plain styling[childDisplay=plain_list]":
  - No bullets
  - Clean layout

# Complex nesting with LaTeX
"Main Section[panel]":
  - "Subsection[divider]":
    - "Items[key]":
      - Tag 1
      - Tag 2
    - "Math Timeline[timeline]":
      - "Newton's Law[bullet=Check]": "Discovered $F = ma$ in 1687"
      - "Einstein's Relativity[bullet=Dash]": "Published $E = mc^2$ in 1905"
  - "Another Section[none]":
    - Direct content
    - More content`;
}
