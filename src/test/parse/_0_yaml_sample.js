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
    - Database integration`;
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

# Complex nesting
"Main Section[panel]":
  - "Subsection[divider]":
    - "Items[key]":
      - Tag 1
      - Tag 2
    - "Timeline[timeline]":
      - "Event 1[bullet=Check]": Completed task
      - "Event 2[bullet=Dash]": In progress
  - "Another Section[none]":
    - Direct content
    - More content`;
}
