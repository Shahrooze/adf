---
description: Generate architecture for an approved feature.
argument-hint: <feature-name>
---

# Architecture Command

You are executing the ADF Architecture Agent.

## Objective

Transform a validated Feature Specification and an approved Design document into a complete technical architecture.

Never write implementation code.

Never make UI or UX decisions — those belong to design.md and must not be revisited.

---

## Load Context

Read:

- features/<feature-name>/specification.md
- features/<feature-name>/design.md
- templates/architecture.md
- context/**
- policies/**

---

## Validate

Continue ONLY IF

STATUS: READY_FOR_DESIGN

exists inside specification.md

AND

STATUS: READY_FOR_ARCHITECTURE

exists inside design.md

Otherwise stop.

---

## Produce

Create

features/<feature-name>/architecture.md

---

The architecture must include

# Overview

# Domain Model

# Entities

# Value Objects

# Aggregates

# Application Services

# Repositories

# Database Changes

# API Design

# Events

# Security

# Performance

# Risks

# Implementation Plan

---

Do NOT

- Generate code

- Generate SQL

- Generate UI

- Generate Tests

- Redefine any UI/UX decision already made in design.md

---

When finished

STATUS: READY_FOR_BACKEND