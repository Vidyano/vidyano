# Vidyano v4 Migration Guide

Welcome to the Vidyano v4 migration guide. This document will help you choose the right migration path for your project and navigate to the appropriate detailed guide.

## What Changed in v4

Vidyano v4 introduces significant improvements to the component architecture:

- **New Default**: The `WebComponent` export now points to a modern Lit-based implementation
- **Namespace Change**: The previous Polymer-based component is available as `Polymer.WebComponent`
- **Modern Standards**: Lit follows current Web Component best practices with better performance
- **Active Development**: Built on Google's actively maintained Lit framework

## Choose Your Migration Path

### Quick Compatibility Migration
**Best for:** Projects that need immediate v4 compatibility with minimal changes

- **Code Changes:** Import and registration updates only

**When to choose this path:**
- You need to upgrade to v4 quickly
- Your team isn't ready for a major component rewrite
- You want to defer the full migration to a later sprint
- You have a large codebase and need a gradual approach

**[Start Compatibility Migration](./compatibility.md)**

### Full Lit Migration
**Best for:** Projects ready to modernize their component architecture

- **Code Changes:** Complete component rewrite required

**When to choose this path:**
- You want to take advantage of modern Web Component features
- Performance improvements are important for your application
- Your team is ready to learn Lit-based development
- You're starting a new project or have time for a thorough migration

**[Start Lit Migration](./polymer-to-lit.md)**
