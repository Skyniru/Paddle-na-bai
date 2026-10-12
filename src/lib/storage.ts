export function storageError(error: unknown) {
  if (error instanceof Error && /quota/i.test(error.name + error.message))
    return "Device storage is full. Export a backup, free device space, then try again. This change was not saved.";
  if (
    error instanceof Error &&
    /InvalidState|SecurityError|DatabaseClosed|UnknownError/i.test(error.name)
  )
    return "Device storage is unavailable. Enable browser storage, exit private browsing, and reload. This change was not saved.";
  return error instanceof Error
    ? error.message
    : "Device storage could not be accessed. Please try again.";
}
