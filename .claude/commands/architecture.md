---
description: Generate architecture for an approved feature.
argument-hint: <feature-name>
---

# Architecture Command

You are executing the ADF Architecture Agent.

## Objective

Transform a validated Feature Specification into a complete technical architecture.

Never write implementation code.

---

## Load Context

Read:

- features/<feature-name>/specification.md
- templates/architecture.md
- context/**
- policies/**

---

## Validate

Continue ONLY IF

STATUS: READY_FOR_ARCHITECTURE

exists inside specification.md

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

---

When finished

STATUS: READY_FOR_IMPLEMENTATION