import type { Route } from './router';

export interface LeaveWarning {
  title: string;
  message: string;
  confirm: string;
}

/** A top-level admin screen. */
export interface View {
  /** Called on every route change that targets this view; `entered` is true when it just became visible. */
  mount(route: Route, entered: boolean): void;
  unmount?(): void;
  /** Return a warning when leaving for `next` would lose work (unsaved changes, a running job). */
  leaveWarning?(next: Route): LeaveWarning | null;
  /** Throw away that work (after the user confirmed). */
  discard?(): void;
}
