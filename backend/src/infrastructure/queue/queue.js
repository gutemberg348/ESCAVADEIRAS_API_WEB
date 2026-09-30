// Boundary for future asynchronous jobs (alerts, reporting and retention policies).
export const enqueue = async (_name, job) => job();
