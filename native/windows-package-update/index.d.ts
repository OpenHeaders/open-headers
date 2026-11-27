export interface WindowsPackageUpdateBinding {
  /**
   * Asks Windows to stage the package at the link for this user, its
   * registration left for later while the package is in use. Resolves
   * once Windows has staged it; rejects with Windows' own words — the
   * operation's code, then its text — when it has not.
   *
   * `onPercent` hears every percentage Windows reports, whole numbers
   * from 0 to 100, as they come: in bursts, and not in step with the bytes.
   */
  stage(link: string, onPercent: (percent: number) => void): Promise<void>;
  /**
   * Asks Windows to register the staged version of the package this
   * process runs in, and to start the app again afterwards. Windows
   * closes the package's processes for it, so the promise settles in a
   * process that is still there only when Windows refused: it then
   * rejects with Windows' own words. Rejects at once in a process with
   * no package identity.
   */
  register(): Promise<void>;
}

/** The native binding; null on another platform or where the build is not there. */
export function load(): WindowsPackageUpdateBinding | null;
