1. What Caused the Double Words (FastFastAPIAPI is is...)?
In your UI screenshot, notice that every word/character was printed twice (e.g. What What is is Fast FastAPIAPI).

Why this happened:

The backend and AI model were generating clean text correctly.
In the frontend (
tutor/page.tsx
), the React state updater was doing:
typescript


// Mutated existing object in-place
const updated = [...prev];
updated[lastIdx].content += eventData.token;
Because Next.js runs React in development/Strict Mode, React invokes state updater functions twice to detect impure mutations. Mutating updated[lastIdx].content in-place caused the second invocation to concatenate each incoming token twice!
Fix Applied: Updated the state setter to create a fresh object copy:
typescript


updatedMsg.content = lastMsg.content + eventData.token;
Now each word streams smoothly once without any duplication.