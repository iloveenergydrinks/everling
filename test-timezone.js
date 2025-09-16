// Test timezone detection
const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
console.log("Browser would detect:", browserTz);
console.log("Current time:", new Date().toString());
console.log("UTC time:", new Date().toISOString());
