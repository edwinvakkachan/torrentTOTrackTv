export function getErrorDetails(error) {
  if (!error) {
    return {};
  }

  const details = {
    name: error.name,
    message: error.message,
    code: error.code,
    stack: error.stack,
  };

  if (Array.isArray(error.errors)) {
    details.errors = error.errors.map((childError) => ({
      name: childError.name,
      message: childError.message,
      code: childError.code,
      errno: childError.errno,
      syscall: childError.syscall,
      address: childError.address,
      port: childError.port,
    }));
  }

  return Object.fromEntries(
    Object.entries(details).filter(([, value]) => value !== undefined)
  );
}

export function getPostgresConnectionHint(error) {
  const details = getErrorDetails(error);
  const failedAddresses = details.errors
    ?.map((childError) => `${childError.address}:${childError.port}`)
    .filter(Boolean);

  if (error?.code === "ECONNREFUSED") {
    return {
      summary: "Postgres connection refused.",
      failedAddresses,
      likelyFix:
        "Check DATABASE_URL and make sure the Postgres server is running and reachable.",
    };
  }

  return {};
}
