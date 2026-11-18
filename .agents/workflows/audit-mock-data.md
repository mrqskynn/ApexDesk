# Audit for mock data

1. Search the whole codebase for hardcoded arrays of sample records, fake numbers, `Math.random()`, `"lorem"`, `"John Doe"`, `"example@"`, and static JSON used as data.
2. List every finding with file and line.
3. Replace each with a real API call or DB query.
4. Run the app, perform one chat, and show the matching DB rows and the updated dashboard metric.
