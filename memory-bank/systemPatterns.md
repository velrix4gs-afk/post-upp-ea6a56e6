# System Patterns

## Architecture

The application follows a client-server architecture. The frontend is built using React, TypeScript, Vite, and Tailwind CSS. The backend is built using Supabase, which includes Postgres, Auth, RLS, Edge Functions, Storage, Realtime, and `pg_net` for DB-triggered HTTP calls.

## Key Technical Decisions

1. React for the frontend to provide a dynamic and responsive user interface.
2. Supabase for the backend to handle user authentication and data storage.
3. Firebase Cloud Messaging for push notifications.
4. Stream Video SDK for voice/video calls.

## Design Patterns

1. Component-based architecture for the frontend to ensure reusability and maintainability.
2. Model-View-Controller (MVC) pattern for the backend to separate concerns and ensure a clean and organized codebase.