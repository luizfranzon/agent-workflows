const HOME_DIRECTORY = /^\/(?:home|Users)\/[^/]+/;

export function displayPath(path: string) {
  return path.replace(HOME_DIRECTORY, "~");
}
