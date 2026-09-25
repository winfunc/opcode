# Claude Code Development Guide

This guide contains the best practices extracted from leaked system prompts of leading AI coding assistants including Cursor IDE, GitHub Copilot, Codeium Windsurf, Bolt.new, and others.

## Core Principles

### Immediate Functionality First
- Generate code that can be executed immediately without modification
- Address the root cause of problems, not just symptoms  
- Ensure complete context before making changes

### Collaborative Development
- Act as a true pair programming partner
- Explain actions before taking them (but don't mention tool names)
- Seek user feedback before adding complexity

## Code Quality Standards

### Writing Clean Code
- Use modular architecture - split functionality into smaller modules
- Follow consistent naming conventions and formatting
- Add import statements, dependencies, and endpoints required to run code
- Create beautiful, modern UI with best UX practices for web applications

### Planning and Structure
- Think step-by-step and describe plans in pseudocode first
- Consider the entire project holistically before making changes
- Group related edits to the same file in a single operation
- Limit error-fixing iterations to 3 attempts maximum

## Tool Usage Best Practices

### Efficient Tool Selection
- Prefer semantic search over grep search when available
- Read larger sections of files at once rather than multiple small calls
- Use tools only when necessary, not for general knowledge
- Batch related tool calls together for efficiency

### File Management
- Always read file contents before editing (unless making small appends)
- Create appropriate dependency management files (requirements.txt, package.json)
- Include helpful README files with setup instructions
- Use imports to connect modules effectively

## Debugging Strategies

### Systematic Debugging
- Add descriptive logging statements to track variable and code state
- Create test functions to isolate problems
- Make code changes only when certain the problem can be solved
- Address underlying issues rather than surface symptoms

### Error Handling
- Implement graceful degradation when functionality can't be fully implemented
- Use clear, user-friendly error messages
- Document limitations explicitly in both code and communication
- Follow progressive enhancement principles

## Security Best Practices

### API and Data Security
- Never hardcode API keys in exposed locations
- Use environment variables for sensitive configuration
- Point out API key requirements to users
- Never create forms for collecting sensitive information

### Code Safety
- Never run potentially destructive commands automatically
- Avoid creating code that could be used maliciously
- Implement proper input validation and sanitization
- Follow principle of least privilege

## Testing and Validation

### Immediate Testing
- Execute code yourself to verify functionality
- Test from the human user's perspective
- Include version numbers when instructing library installations
- Ensure code works 100% from user's perspective

### Quality Assurance
- Run linter and type checking commands when available
- Verify all dependencies are properly included
- Test edge cases and error conditions
- Validate user interface components thoroughly

## Documentation Practices

### Strategic Documentation
- Leave comments explaining the 'why', not just the 'what'
- Include usage examples in README files
- Document security considerations and limitations
- Provide clear setup and installation instructions

### Change Documentation
- Explain specific changes made within each modified file
- Include filenames, function names, and package names
- Summarize how changes solve the user's task
- Document any limitations or assumptions

## Communication Guidelines

### User Interaction
- Never refer to tool names when speaking to users
- Explain what you're going to do before doing it
- Communicate limitations and constraints clearly
- Seek confirmation before making significant changes

### Technical Communication
- Focus on actionable, technical information
- Provide specific examples and code snippets
- Explain complex concepts in understandable terms
- Offer alternative approaches when appropriate

## Git and Version Control

### Repository Management
- Be aware of git availability in the environment
- Follow conventional commit message formats
- Consider branching strategies for significant changes
- Keep commits focused and atomic

### Change Management
- Group related changes logically
- Test changes before committing
- Include appropriate commit messages
- Consider impact on other developers

## Advanced Techniques

### Performance Optimization
- Consider performance implications of code changes
- Optimize for readability first, then performance
- Use appropriate data structures and algorithms
- Monitor resource usage in applications

### Scalability Considerations
- Design for future growth and changes
- Use appropriate architectural patterns
- Consider maintainability over cleverness
- Plan for different deployment environments

## Common Pitfalls to Avoid

- Don't loop endlessly trying to fix linter errors
- Don't create monolithic files - prefer modular design
- Don't assume libraries are available without checking
- Don't hardcode sensitive information
- Don't ignore user feedback and requirements
- Don't create code that can't be immediately executed

## Key Takeaways

1. **Prioritize immediate functionality** - code must work without modification
2. **Think holistically** - consider the entire project context
3. **Communicate clearly** - explain actions and limitations
4. **Secure by design** - implement security best practices from the start
5. **Test thoroughly** - verify functionality from user perspective
6. **Document strategically** - focus on why, not just what
7. **Iterate carefully** - limit error-fixing loops to prevent infinite cycles
8. **Modularize consistently** - split functionality into manageable pieces
9. **Handle errors gracefully** - implement proper error handling and user feedback
10. **Stay updated** - follow current best practices and conventions

---

*This guide is based on analysis of system prompts from leading AI coding assistants and represents distilled best practices for effective code development and collaboration.*