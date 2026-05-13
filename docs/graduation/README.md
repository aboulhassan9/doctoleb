# DoctoLeb Graduation Documentation

## Goal
This folder explains DoctoLeb as a real multi-tenant SaaS clinic system. The documents are short, visual, and split by topic so they can be used in a graduation report or presentation.

## Reading Order
| File | Use It For |
|---|---|
| [00-visual-overview.md](./00-visual-overview.md) | One-page system picture with routing examples. |
| [01-system-design-and-stack.md](./01-system-design-and-stack.md) | Layers, components, technology, and tools. |
| [02-saas-tenancy-and-data-design.md](./02-saas-tenancy-and-data-design.md) | Control plane, tenant databases, branding, features, and domains. |
| [03-core-workflows.md](./03-core-workflows.md) | Patient, staff, SaaS admin, chat, and video-call flows. |
| [04-mobile-ai-realtime-roadmap.md](./04-mobile-ai-realtime-roadmap.md) | Flutter, Firebase FCM, Supabase Realtime, LiveKit, LangGraph, and Gemini. |
| [05-quality-security-and-deployment.md](./05-quality-security-and-deployment.md) | CI/CD, security, testing, deployment, and operations. |

## Status Legend
| Label | Meaning |
|---|---|
| Current | Implemented now or the deployed foundation exists. |
| Planned | Designed and documented, but not fully implemented yet. |
| Deferred | Valid future work, outside the current graduation delivery. |

## Source Baseline
| Platform | Official Source |
|---|---|
| Vercel multi-tenant platform | https://vercel.com/platforms/docs/multi-tenant-platforms/concepts |
| Supabase RLS | https://supabase.com/docs/guides/database/postgres/row-level-security |
| Supabase Edge Functions auth | https://supabase.com/docs/guides/functions/auth |
| Supabase Realtime | https://supabase.com/docs/guides/realtime/postgres-changes |
| Supabase Flutter | https://supabase.com/docs/reference/dart/introduction |
| Firebase FCM for Flutter | https://firebase.google.com/docs/cloud-messaging/flutter/get-started |
| LiveKit tokens/media | https://docs.livekit.io/frontends/reference/tokens-grants/ |
| LangGraph | https://docs.langchain.com/oss/javascript/langgraph/overview |
| Gemini API | https://ai.google.dev/gemini-api/docs |
